"use client";

import { MessageCircleQuestion, Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

type SmartSearchExamplesProps = {
  className?: string;
  onPickExample?: (value: string) => void;
  showHeader?: boolean;
};

const HINTS = [
  "What is the fundamental theorem of calculus?",
  "Educational materials mathematics",
  "Rainfall data Central Europe",
  "Climate indicators Mediterranean",
  "What the average weather in Basel in 2000?",
];

export default function SmartSearchExamples({
  className,
  onPickExample,
  showHeader = true,
}: SmartSearchExamplesProps) {
  const handlePick = (value: string) => {
    if (onPickExample) onPickExample(value);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col items-center text-center">
        {showHeader && (
          <>
            <MessageCircleQuestion
              className="w-10 h-10 text-slate-350 mb-2"
              strokeWidth={1.25}
            />
            <div className="text-body-16-semibold text-slate-850 mb-4">
              Example Searches
            </div>
          </>
        )}
        <div className="flex flex-wrap justify-center items-center gap-2">
          {HINTS.map((hint, idx) => (
            <Button
              key={`${hint}-${idx}`}
              variant="tertiary"
              size="smPlus"
              className="!px-3"
              onClick={() => handlePick(hint)}
            >
              <SearchIcon className="w-4 h-4 mr-2" />
              {hint}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
