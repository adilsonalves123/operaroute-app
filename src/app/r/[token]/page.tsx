import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumoPublicView } from "@/components/rascunho/ResumoPublicView";
import { carregarResumoRascunhoPorToken } from "@/lib/rascunho/compartilhar-server";
import { createPublicClient } from "@/lib/supabase/public";

type Props = { params: Promise<{ token: string }> };

async function loadSnapshot(token: string) {
  const supabase = createPublicClient();
  return carregarResumoRascunhoPorToken(supabase, token);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  try {
    const data = await loadSnapshot(token);
    if (!data) return { title: "Resumo · OperaRoute" };
    return {
      title: `${data.snapshot.titulo || "Resumo"} — ${data.snapshot.empresaNome}`,
      description: `Resumo da rota · ${data.snapshot.empresaNome}`,
    };
  } catch {
    return { title: "Resumo · OperaRoute" };
  }
}

export default async function ResumoPublicPage({ params }: Props) {
  const { token } = await params;

  let loaded: Awaited<ReturnType<typeof loadSnapshot>>;
  try {
    loaded = await loadSnapshot(token);
  } catch (e) {
    return (
      <main className="min-h-screen bg-[#0a0e16] px-4 py-16 text-center text-slate-300">
        <p className="text-[15px]">
          {e instanceof Error ? e.message : "Link indisponível no momento."}
        </p>
      </main>
    );
  }

  if (!loaded) notFound();

  return <ResumoPublicView snap={loaded.snapshot} />;
}
