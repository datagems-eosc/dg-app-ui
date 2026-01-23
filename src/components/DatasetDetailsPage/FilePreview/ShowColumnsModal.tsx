"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { FileColumn } from "@/types/filePreview";
import styles from "./ShowColumnsModal.module.scss";

interface ShowColumnsModalProps {
  isOpen: boolean;
  columns: FileColumn[];
  onClose: () => void;
  onSave: (updatedColumns: FileColumn[]) => void;
}

export default function ShowColumnsModal({
  isOpen,
  columns,
  onClose,
  onSave,
}: ShowColumnsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localColumns, setLocalColumns] = useState<FileColumn[]>(columns);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return localColumns;
    return localColumns.filter((col) =>
      col.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [localColumns, searchQuery]);

  const allSelected = useMemo(
    () => filteredColumns.every((col) => col.visible),
    [filteredColumns],
  );

  const handleToggleAll = () => {
    const newValue = !allSelected;
    setLocalColumns((prev) =>
      prev.map((col) => {
        if (filteredColumns.some((fc) => fc.id === col.id)) {
          return { ...col, visible: newValue };
        }
        return col;
      }),
    );
  };

  const handleToggleColumn = (columnId: string) => {
    setLocalColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  const handleSave = () => {
    onSave(localColumns);
    onClose();
  };

  const handleCancel = () => {
    setLocalColumns(columns);
    setSearchQuery("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.showColumnsModal}>
      <div
        className={styles.showColumnsModal__overlay}
        onClick={handleCancel}
      />
      <div className={styles.showColumnsModal__content}>
        <div className={styles.showColumnsModal__header}>
          <h3 className={styles.showColumnsModal__title}>Show Columns</h3>
          <button
            type="button"
            onClick={handleCancel}
            className={styles.showColumnsModal__closeButton}
            aria-label="Close"
          >
            <X className={styles.showColumnsModal__closeIcon} />
          </button>
        </div>

        <div className={styles.showColumnsModal__search}>
          <Search className={styles.showColumnsModal__searchIcon} />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.showColumnsModal__searchInput}
          />
        </div>

        <div className={styles.showColumnsModal__selectAll}>
          <label className={styles.showColumnsModal__checkboxLabel}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className={styles.showColumnsModal__checkbox}
            />
            <span>Select All</span>
          </label>
        </div>

        <div className={styles.showColumnsModal__list}>
          {filteredColumns.map((column) => (
            <label
              key={column.id}
              className={styles.showColumnsModal__checkboxLabel}
            >
              <input
                type="checkbox"
                checked={column.visible}
                onChange={() => handleToggleColumn(column.id)}
                className={styles.showColumnsModal__checkbox}
              />
              <span>{column.name}</span>
            </label>
          ))}
        </div>

        <div className={styles.showColumnsModal__footer}>
          <button
            type="button"
            onClick={handleCancel}
            className={styles.showColumnsModal__cancelButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={styles.showColumnsModal__saveButton}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
