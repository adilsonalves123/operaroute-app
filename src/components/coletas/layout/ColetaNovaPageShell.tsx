import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function ColetaNovaPageShell({
  title,
  subtitle,
  children,
  className,
  backHref = "/coletas",
  topSlot,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  backHref?: string;
  topSlot?: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl space-y-5 pb-8", className)}>
      {topSlot}
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href={backHref}
          className="mt-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-slate-400 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mt-0.5 text-sm leading-snug text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
