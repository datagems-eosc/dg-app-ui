interface MetadataItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export default function MetadataItem({
  icon,
  label,
  value,
}: MetadataItemProps) {
  return (
    <div className="flex items-center gap-3 px-4">
      <div className="w-5 h-5 text-icon flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-descriptions-12-medium tracking-1p text-slate-850">
          {label}
        </div>
        <div className="text-descriptions-12-regular tracking-1p text-gray-650">
          {value}
        </div>
      </div>
    </div>
  );
}
