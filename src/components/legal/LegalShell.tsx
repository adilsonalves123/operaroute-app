import Link from "next/link";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#05070d] text-[#e8edf5]">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <Link
          href="/login"
          className="text-[12px] tracking-[0.14em] uppercase text-[#7dd3e8]/80 hover:text-[#7dd3e8]"
        >
          ← Voltar ao login
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-[13px] text-[#8b93a3]">
          OperaRoute · Atualizado em {updated}
        </p>
        <div className="prose-legal mt-10 space-y-6 text-[14.5px] leading-relaxed text-[#b8c0ce]">
          {children}
        </div>
      </div>
    </div>
  );
}
