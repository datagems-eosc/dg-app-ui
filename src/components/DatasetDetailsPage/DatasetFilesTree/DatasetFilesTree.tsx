"use client";

import {
  ChevronDown,
  ChevronRight,
  Database,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Table2,
} from "lucide-react";
import { useState } from "react";
import styles from "./DatasetFilesTree.module.scss";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder" | "database" | "schema" | "table" | "excel-sheet";
  children?: FileNode[];
  extension?: string;
}

interface DatasetFilesTreeProps {
  files?: FileNode[];
  defaultExpanded?: string[];
  onFileSelect?: (fileId: string, fileName: string) => void;
}

const defaultFiles: FileNode[] = [
  {
    id: "file1",
    name: "File1.csv",
    type: "file",
    extension: "csv",
  },
  {
    id: "file2",
    name: "File2.xlsx",
    type: "file",
    extension: "xlsx",
  },
  {
    id: "csv-folder",
    name: "CSV",
    type: "folder",
    children: [
      {
        id: "csv-file1",
        name: "File1.csv",
        type: "file",
        extension: "csv",
      },
      {
        id: "csv-file2",
        name: "File2.csv",
        type: "file",
        extension: "csv",
      },
    ],
  },
  {
    id: "excel-folder",
    name: "EXCEL",
    type: "folder",
    children: [
      {
        id: "excel-file1",
        name: "Excel_File_1.xlsx",
        type: "excel-sheet",
        children: [
          {
            id: "table1",
            name: "Table1",
            type: "table",
          },
          {
            id: "table2",
            name: "Table2",
            type: "table",
          },
          {
            id: "table3",
            name: "Table3",
            type: "table",
          },
        ],
      },
    ],
  },
  {
    id: "database-folder",
    name: "DATABASE",
    type: "folder",
    children: [
      {
        id: "meteo-db",
        name: "Meteo_Database",
        type: "database",
        children: [
          {
            id: "schema1",
            name: "Schema1",
            type: "schema",
            children: [
              {
                id: "schema1-table1",
                name: "Table1",
                type: "table",
              },
              {
                id: "schema1-table2",
                name: "Table2",
                type: "table",
              },
            ],
          },
          {
            id: "schema2",
            name: "Schema2",
            type: "schema",
            children: [
              {
                id: "schema2-table1",
                name: "Table1",
                type: "table",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "pdf-folder",
    name: "PDF",
    type: "folder",
    children: [],
  },
];

export default function DatasetFilesTree({
  files = defaultFiles,
  defaultExpanded = [],
  onFileSelect,
}: DatasetFilesTreeProps) {
  const initialExpanded =
    defaultExpanded.length > 0
      ? defaultExpanded
      : [
          "csv-folder",
          "csv-file2",
          "excel-folder",
          "excel-file1",
          "table1",
          "table2",
          "table3",
          "database-folder",
          "meteo-db",
          "schema1",
          "schema2",
        ];

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(initialExpanded),
  );
  const [selectedNode, setSelectedNode] = useState<string | null>("csv-file2");

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getIcon = (node: FileNode) => {
    switch (node.type) {
      case "file":
        if (node.extension === "csv") {
          return File;
        }
        if (node.extension === "xlsx" || node.extension === "xls") {
          return FileSpreadsheet;
        }
        if (node.extension === "pdf") {
          return FileText;
        }
        return File;
      case "folder":
        return Folder;
      case "database":
      case "schema":
        return Database;
      case "table":
        return Table2;
      case "excel-sheet":
        return FileSpreadsheet;
      default:
        return File;
    }
  };

  const hasChildren = (node: FileNode): boolean => {
    return Boolean(node.children && node.children.length > 0);
  };

  const isExpanded = (nodeId: string) => {
    return expandedNodes.has(nodeId);
  };

  const handleNodeClick = (
    nodeId: string,
    nodeName: string,
    nodeType: string,
    isExpandable: boolean,
  ) => {
    if (isExpandable) {
      toggleNode(nodeId);
    }
    setSelectedNode(nodeId);

    // Call onFileSelect for file types (not folders)
    if (onFileSelect && (nodeType === "file" || nodeType === "excel-sheet")) {
      onFileSelect(nodeId, nodeName);
    }
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const Icon = getIcon(node);
    const hasChildrenNodes = hasChildren(node);
    const expanded = isExpanded(node.id);
    const isExpandable = hasChildrenNodes;
    const isSelected = selectedNode === node.id;

    // Generate level class - limit to 5 levels for CSS classes
    const levelClass =
      level <= 4 ? styles[`datasetFilesTree__nodeContent--level-${level}`] : "";

    return (
      <div key={node.id} className={styles.datasetFilesTree__node}>
        <div
          className={`${styles.datasetFilesTree__nodeContent} ${
            expanded ? styles["datasetFilesTree__nodeContent--expanded"] : ""
          } ${isSelected ? styles["datasetFilesTree__nodeContent--selected"] : ""} ${levelClass}`}
          style={
            level > 4 ? { paddingLeft: `${12 + level * 24}px` } : undefined
          }
          onClick={() =>
            handleNodeClick(node.id, node.name, node.type, isExpandable)
          }
        >
          {isExpandable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className={styles.datasetFilesTree__expandButton}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronDown className={styles.datasetFilesTree__chevron} />
              ) : (
                <ChevronRight className={styles.datasetFilesTree__chevron} />
              )}
            </button>
          ) : (
            <span className={styles.datasetFilesTree__spacer} />
          )}
          <Icon className={styles.datasetFilesTree__icon} />
          <span className={styles.datasetFilesTree__name}>{node.name}</span>
        </div>
        {hasChildrenNodes && expanded && (
          <div className={styles.datasetFilesTree__children}>
            {node.children?.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.datasetFilesTree}>
      <div className={styles.datasetFilesTree__header}>
        <Database className={styles.datasetFilesTree__headerIcon} />
        <h3 className={styles.datasetFilesTree__title}>Dataset Files</h3>
      </div>
      <div className={styles.datasetFilesTree__content}>
        {files.map((file) => renderNode(file, 0))}
      </div>
    </div>
  );
}
