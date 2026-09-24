import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModalFocus } from "./useModalFocus";

function Layer({
  name,
  onEscape,
  initialFocus,
  children,
}: {
  name: string;
  onEscape?: () => void;
  initialFocus?: "first-tabbable" | "container";
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus({ active: true, containerRef: ref, onEscape, initialFocus });
  return (
    <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}>
      <button type="button">{`${name} first`}</button>
      <button type="button" disabled>
        {`${name} disabled`}
      </button>
      <button type="button">{`${name} last`}</button>
      {children}
    </div>
  );
}

/** A page with a launcher, a background control, and a dialog it opens. */
function Page({
  nested = false,
  onOuterEscape,
}: {
  nested?: boolean;
  onOuterEscape?: () => void;
}) {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuter(true)}>
        Launch
      </button>
      <button type="button">Background</button>
      {outer && (
        <Layer
          name="Outer"
          onEscape={() => {
            onOuterEscape?.();
            setOuter(false);
          }}
        >
          <button type="button" onClick={() => setInner(true)}>
            Open inner
          </button>
          {nested && inner && (
            <Layer name="Inner" onEscape={() => setInner(false)} />
          )}
        </Layer>
      )}
    </>
  );
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("useModalFocus", () => {
  it("moves focus in on open and back to the launcher on close", async () => {
    const user = userEvent.setup();
    render(<Page />);
    const launch = screen.getByRole("button", { name: "Launch" });
    await user.click(launch);

    expect(screen.getByRole("button", { name: "Outer first" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(launch).toHaveFocus();
  });

  it("can start on the container instead", () => {
    render(<Layer name="Solo" initialFocus="container" />);
    expect(screen.getByRole("dialog", { name: "Solo" })).toHaveFocus();
  });

  it("wraps Tab and Shift+Tab inside the dialog, skipping disabled controls", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    const first = screen.getByRole("button", { name: "Outer first" });
    const last = screen.getByRole("button", { name: "Open inner" });

    await user.tab();
    expect(screen.getByRole("button", { name: "Outer last" })).toHaveFocus();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Background" }),
    ).not.toHaveFocus();
  });

  it("brings focus back when it lands behind the dialog", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Launch" }));

    act(() => screen.getByRole("button", { name: "Background" }).focus());
    expect(screen.getByRole("button", { name: "Outer first" })).toHaveFocus();
  });

  it("lets only the top dialog answer Escape, and returns focus to its launcher", async () => {
    const user = userEvent.setup();
    const onOuterEscape = vi.fn();
    render(<Page nested onOuterEscape={onOuterEscape} />);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    const openInner = screen.getByRole("button", { name: "Open inner" });
    await user.click(openInner);
    expect(screen.getByRole("button", { name: "Inner first" })).toHaveFocus();

    // Tab stays in the inner dialog, never reaching the outer one.
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Inner first" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Inner" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
    expect(onOuterEscape).not.toHaveBeenCalled();
    expect(openInner).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onOuterEscape).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Launch" })).toHaveFocus();
  });

  it("keeps the page scroll-locked until the last dialog closes", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    render(<Page nested />);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    await user.click(screen.getByRole("button", { name: "Open inner" }));
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("auto");
  });

  it("falls back to the dialog underneath when the launcher can no longer take focus", () => {
    function Host({ open, launcherDisabled }: Record<string, boolean>) {
      const ref = useRef<HTMLDivElement>(null);
      useModalFocus({ active: true, containerRef: ref });
      return (
        <div ref={ref} role="dialog" aria-label="Host" tabIndex={-1}>
          <button type="button" disabled={launcherDisabled}>
            Launcher
          </button>
          {open && <Layer name="Top" />}
        </div>
      );
    }
    const { rerender } = render(<Host open={false} launcherDisabled={false} />);
    const launcher = screen.getByRole("button", { name: "Launcher" });
    act(() => launcher.focus());
    rerender(<Host open launcherDisabled={false} />);
    expect(screen.getByRole("button", { name: "Top first" })).toHaveFocus();

    rerender(<Host open={false} launcherDisabled />);
    expect(screen.getByRole("dialog", { name: "Host" })).toHaveFocus();
  });

  it("restores the outer launcher when both dialogs close together", async () => {
    const user = userEvent.setup();
    // The parent closes while its confirmation is open, as losing the
    // rollout flag does: both layers unmount in one commit.
    let closeAll = () => {};
    function Both() {
      const [open, setOpen] = useState(false);
      const [inner, setInner] = useState(false);
      closeAll = () => setOpen(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Launch
          </button>
          {open && (
            <Layer name="Outer">
              <button type="button" onClick={() => setInner(true)}>
                Open inner
              </button>
              {inner && <Layer name="Inner" />}
            </Layer>
          )}
        </>
      );
    }
    render(<Both />);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    await user.click(screen.getByRole("button", { name: "Open inner" }));
    expect(screen.getByRole("button", { name: "Inner first" })).toHaveFocus();
    act(() => closeAll());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("does not refocus when the caller re-renders with a new callback", async () => {
    const user = userEvent.setup();
    function Rerendering() {
      const [count, setCount] = useState(0);
      const ref = useRef<HTMLDivElement>(null);
      // A fresh closure on every render, as an inline prop would be.
      useModalFocus({ active: true, containerRef: ref, onEscape: () => {} });
      return (
        <div ref={ref} tabIndex={-1}>
          <button type="button">Start</button>
          <button type="button" onClick={() => setCount(count + 1)}>
            {`Count ${count}`}
          </button>
        </div>
      );
    }
    render(<Rerendering />);
    const counter = screen.getByRole("button", { name: "Count 0" });
    await user.click(counter);
    await user.click(counter);
    expect(screen.getByRole("button", { name: "Count 2" })).toHaveFocus();
  });

  it("leaves focus with the document when the launcher is gone and nothing is underneath", async () => {
    const user = userEvent.setup();
    function Replacing() {
      const [open, setOpen] = useState(false);
      return (
        <>
          {!open && (
            <button type="button" onClick={() => setOpen(true)}>
              Launch
            </button>
          )}
          {open && <Layer name="Solo" onEscape={() => setOpen(false)} />}
        </>
      );
    }
    render(<Replacing />);
    await user.click(screen.getByRole("button", { name: "Launch" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });
});
