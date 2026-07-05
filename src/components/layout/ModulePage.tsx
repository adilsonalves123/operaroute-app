import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { Plus } from "lucide-react";

interface ModulePageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  actionHref?: string;
}

export function ModulePage({
  title,
  description,
  emptyTitle,
  emptyDescription,
  actionLabel,
  actionHref,
}: ModulePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-slate-400 mt-1">{description}</p>
        </div>
        {actionLabel && actionHref && actionHref !== "#" && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Link>
        )}
      </div>
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
