import { cn } from "@/lib/utils";

interface DataCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function DataCard({ title, children, action, className }: DataCardProps) {
  return (
    <div className={cn("glass-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
