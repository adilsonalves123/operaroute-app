import { Inbox } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-at bg-at-card-soft text-at-muted">
        {icon ?? <Inbox className="h-8 w-8" />}
      </div>
      <h3
        className="text-lg font-medium text-at-primary"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-at-muted">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/10 px-6 py-2.5 text-sm font-medium text-at-link transition hover:bg-[#c4a574]/20"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
