"use client";

import React, { useState, useRef, useEffect } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  position = "top",
  delay = 500,
  className = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      let style: React.CSSProperties = {};

      switch (position) {
        case "top":
          style = {
            left: containerRect.left + containerRect.width / 4 + 20,
            top: containerRect.top - 8,
            transform: "translateX(-50%) translateY(-100%)",
          };
          break;
        case "bottom":
          style = {
            left: containerRect.left + containerRect.width / 4 + 20,
            top: containerRect.bottom + 8,
            transform: "translateX(-50%)",
          };
          break;
        case "left":
          style = {
            left: containerRect.left - 8,
            top: containerRect.top + containerRect.height / 2,
            transform: "translateX(-100%) translateY(-50%)",
          };
          break;
        case "right":
          style = {
            left: containerRect.right + 8,
            top: containerRect.top + containerRect.height / 2,
            transform: "translateY(-50%)",
          };
          break;
      }

      setTooltipStyle(style);
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative inline-block ${className}`}
      ref={containerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          className="fixed z-[70] px-2 py-1 text-sm text-white bg-gray-800 rounded-md shadow-lg pointer-events-none"
          style={{
            ...tooltipStyle,
            maxWidth: "340px",
            wordWrap: "break-word",
            whiteSpace: "normal",
          }}
        >
          {content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-800 transform rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-1"
                : position === "bottom"
                  ? "bottom-full left-1/2 -translate-x-1/2 -mb-1"
                  : position === "left"
                    ? "left-full top-1/2 -translate-y-1/2 -ml-1"
                    : "right-full top-1/2 -translate-y-1/2 -mr-1"
            }`}
          />
        </div>
      )}
    </div>
  );
}
