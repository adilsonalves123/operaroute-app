import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumoPublicView } from "@/components/rascunho/ResumoPublicView";
import { carregarResumoRascunhoPorToken } from "@/lib/rascunho/compartilhar-server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!isAdminConfigured()) {
    return { title: "Resumo · OperaRoute" };
  }
  try {
    const data = await carregarResumoRascunhoPorToken(createAdminClient(), token);
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

  if (!isAdminConfigured()) {
    return (
      <main className="min-h-screen bg-[#0a0e16] px-4 py-16 text-center text-slate-300">
        <p>Link indisponível no momento.</p>
      </main>
    );
  }

  const loaded = await carregarResumoRascunhoPorToken(createAdminClient(), token);
  if (!loaded) notFound();

  return <ResumoPublicView snap={loaded.snapshot} />;
}
