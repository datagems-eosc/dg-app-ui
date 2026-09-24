import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DatasetUpload, type UploadedFile } from "./DatasetUpload";

type Upload = (
  files: File[],
  onProgress?: (loaded: number, total: number) => void,
) => Promise<string[]>;

/** The uploader is controlled; this holds its file list like the form does. */
const Harness = ({
  onUpload,
  onChange,
}: {
  onUpload: Upload;
  onChange?: (files: UploadedFile[]) => void;
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  return (
    <DatasetUpload
      files={files}
      onFilesChange={(next) => {
        setFiles(next);
        onChange?.(next);
      }}
      onUpload={onUpload}
    />
  );
};

const selectFile = async (container: HTMLElement, file: File) => {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
};

const csv = () => new File(["a,b\n1,2"], "readings.csv", { type: "text/csv" });

describe("DatasetUpload file-transfer feedback", () => {
  it("does not show a thrown transfer error, and retries the same file", async () => {
    const user = userEvent.setup();
    const file = csv();
    const onUpload = vi
      .fn<Upload>()
      .mockRejectedValueOnce(
        new Error('Server error (500): {"trace":"S3 bucket dg-staging"}'),
      )
      .mockResolvedValueOnce(["staging/readings.csv"]);
    const changes: UploadedFile[][] = [];
    const { container } = render(
      <Harness onUpload={onUpload} onChange={(next) => changes.push(next)} />,
    );

    await selectFile(container, file);

    expect(await screen.findByText("Upload failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Retry the upload, or remove this file if you don't need it.",
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Server error|S3 bucket|trace/);

    const failedId = changes.at(-1)?.[0]?.id;
    await user.click(screen.getByRole("button", { name: "Retry upload" }));

    expect(await screen.findByText("File uploaded")).toBeInTheDocument();
    // The existing retry: the same File object, one more transfer, same card.
    expect(onUpload).toHaveBeenCalledTimes(2);
    expect(onUpload.mock.calls[1]?.[0]).toEqual([file]);
    const last = changes.at(-1)?.[0];
    expect(last?.id).toBe(failedId);
    expect(last?.stagedPath).toBe("staging/readings.csv");
  });

  it("does not show the internal missing-location text", async () => {
    const onUpload = vi.fn<Upload>().mockResolvedValue([""]);
    const { container } = render(<Harness onUpload={onUpload} />);

    await selectFile(container, csv());

    expect(await screen.findByText("Upload failed")).toBeInTheDocument();
    expect(container.textContent).not.toContain("No path returned");
    expect(
      screen.getByRole("button", { name: "Retry upload" }),
    ).toBeInTheDocument();
  });

  it("removes a failed file with the existing control", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn<Upload>().mockRejectedValue(new Error("boom"));
    const { container } = render(<Harness onUpload={onUpload} />);

    await selectFile(container, csv());
    await screen.findByText("Upload failed");

    await user.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
