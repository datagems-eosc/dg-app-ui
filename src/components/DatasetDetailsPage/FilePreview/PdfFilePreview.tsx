"use client";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@ui/Button";
import { Download } from "lucide-react";
import { useCallback, useState } from "react";
import type { PdfFilePreviewData } from "@/types/filePreview";
import FilePreviewMetadata from "./FilePreviewMetadata";
import styles from "./PdfFilePreview.module.scss";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PREVIEW_PAGE_LIMIT = 3;

interface PdfFilePreviewProps {
  data: PdfFilePreviewData;
  onDownload: () => void;
}

export default function PdfFilePreview({
  data,
  onDownload,
}: PdfFilePreviewProps) {
  const [containerWidth, setContainerWidth] = useState<number>(600);

  const { filename, fileSize, description, keywords, fileUrl, totalPages } =
    data;
  // profileRaw has no page count, so prefer the count from the loaded document.
  const [numPages, setNumPages] = useState<number>(totalPages);

  const effectivePages = numPages || totalPages;
  const remainingPages = Math.max(0, effectivePages - PREVIEW_PAGE_LIMIT);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const width = node.getBoundingClientRect().width;
      setContainerWidth(width);
    }
  }, []);

  return (
    <div className={styles.pdfFilePreview}>
      <div className={styles.pdfFilePreview__header}>
        <h3 className={styles.pdfFilePreview__filename}>{filename}</h3>
        <span className={styles.pdfFilePreview__filesize}>({fileSize})</span>
      </div>

      <FilePreviewMetadata description={description} keywords={keywords} />

      <div
        ref={containerRef}
        className={styles.pdfFilePreview__pages}
        data-testid="pdf-preview-pages"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: loadedPages }) =>
            setNumPages(loadedPages)
          }
          loading={
            <div className={styles.pdfFilePreview__loading}>Loading PDF…</div>
          }
          error={
            <div className={styles.pdfFilePreview__error}>
              Failed to load PDF file.
            </div>
          }
        >
          {Array.from(
            { length: Math.min(PREVIEW_PAGE_LIMIT, effectivePages) },
            (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                width={containerWidth}
                className={styles.pdfFilePreview__page}
              />
            ),
          )}
        </Document>

        {remainingPages > 0 && (
          <div
            className={styles.pdfFilePreview__remainingCard}
            data-testid="pdf-remaining-pages-card"
          >
            <p className={styles.pdfFilePreview__remainingText}>
              + {remainingPages} more page{remainingPages !== 1 ? "s" : ""}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onDownload}
              className={styles.pdfFilePreview__downloadBtn}
            >
              <Download className={styles.pdfFilePreview__downloadIcon} />
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
