"use client";

import { Button } from "@ui/Button";
import { Chip } from "@ui/Chip";
import { useRouter } from "next/navigation";
import { getNavigationUrl } from "@/lib/utils";

interface DatasetProposalBlockProps {
  datasets: Array<{ id: string; title: string }>;
  onConfirm: () => void;
  isSubmitting?: boolean;
  isResolved?: boolean;
}

export default function DatasetProposalBlock({
  datasets,
  onConfirm,
  isSubmitting = false,
  isResolved = false,
}: DatasetProposalBlockProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <p className="text-body-16-regular text-gray-750">
        Do you want to answer based on these datasets?
      </p>

      <div className="flex flex-wrap gap-2">
        {datasets.map((dataset) => (
          <button
            key={dataset.id}
            type="button"
            onClick={() =>
              router.push(getNavigationUrl(`/datasets/${dataset.id}`))
            }
            className="cursor-pointer"
            aria-label={`Open dataset ${dataset.title}`}
          >
            <Chip color="info" variant="regular" size="sm">
              {dataset.title}
            </Chip>
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        size="md"
        onClick={onConfirm}
        disabled={isSubmitting || isResolved || datasets.length === 0}
      >
        Yes, answer this question
      </Button>
    </div>
  );
}
