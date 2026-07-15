interface FeatureEmptyStateProps {
  message?: string;
  className?: string;
}

export function FeatureEmptyState({
  message = "No results for this feature.",
  className = "",
}: FeatureEmptyStateProps) {
  return (
    <div
      className={`flex items-center justify-center py-10 text-center text-[14px] text-slate-400 ${className}`}
    >
      {message}
    </div>
  );
}
