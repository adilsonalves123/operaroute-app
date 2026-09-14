import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { carregarComprovantePorToken } from "@/lib/comprovantes/server";
import { ComprovantePublicView } from "@/components/comprovantes/ComprovantePublicView";
import { PreviaRelatorioPublicView } from "@/components/comprovantes/PreviaRelatorioPublicView";
import { HistoricoVisitaCassinoPublicView } from "@/components/comprovantes/HistoricoVisitaCassinoPublicView";
import { HistoricoColetaNichoPublicView } from "@/components/comprovantes/HistoricoColetaNichoPublicView";

const NICHOS_COMPROVANTE_RELATORIO = new Set([
  "fura_fura",
  "ursinho",
  "diversao",
  "bolinha",
  "consignado",
]);

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!isAdminConfigured()) {
    return { title: "Comprovante · OperaRout" };
  }
  try {
    const data = await carregarComprovantePorToken(createAdminClient(), token);
    if (!data) return { title: "Comprovante · OperaRout" };
    return {
      title: `${data.snapshot.previa ? "Prévia" : "Comprovante"} — ${data.snapshot.pontoNome}`,
      description: `${data.snapshot.empresaNome} · ${data.snapshot.pontoNome}`,
    };
  } catch {
    return { title: "Comprovante · OperaRout" };
  }
}

export default async function ComprovantePublicPage({ params }: Props) {
  const { token } = await params;

  if (!isAdminConfigured()) {
    return (
      <main className="min-h-screen bg-[#070b14] text-at-primary/90">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-white">Comprovante indisponível</h1>
          <p className="mt-2 text-sm text-at-muted">
            Configure SUPABASE_SERVICE_ROLE_KEY para liberar links públicos.
          </p>
        </div>
      </main>
    );
  }

  let loaded: Awaited<ReturnType<typeof carregarComprovantePorToken>> = null;
  try {
    loaded = await carregarComprovantePorToken(createAdminClient(), token);
  } catch {
    loaded = null;
  }

  if (!loaded) notFound();

  const snap = loaded.snapshot;
  const usarHistoricoCassino =
    snap.layout === "historico" &&
    snap.nichoModulo === "cassino" &&
    !!snap.relatorio;
  const usarRelatorioNicho =
    !!snap.nichoModulo &&
    NICHOS_COMPROVANTE_RELATORIO.has(snap.nichoModulo) &&
    !!snap.relatorio;
  const usarHistoricoNicho =
    snap.layout === "historico" &&
    !!snap.nichoModulo &&
    snap.nichoModulo !== "cassino" &&
    !NICHOS_COMPROVANTE_RELATORIO.has(snap.nichoModulo) &&
    !!snap.relatorio;
  const usarRelatorio = (snap.layout === "relatorio" || usarRelatorioNicho) && !!snap.relatorio;

  const relatorioSnap =
    usarRelatorioNicho && snap.layout !== "relatorio"
      ? { ...snap, layout: "relatorio" as const }
      : snap;

  const mainClass = usarRelatorio
    ? "min-h-screen bg-[#faf8f4]"
    : "min-h-screen bg-[#070b14]";

  return (
    <main className={mainClass}>
      {usarHistoricoCassino ? (
        <HistoricoVisitaCassinoPublicView snapshot={snap} />
      ) : usarHistoricoNicho ? (
        <HistoricoColetaNichoPublicView snapshot={snap} />
      ) : usarRelatorio ? (
        <PreviaRelatorioPublicView snapshot={relatorioSnap} />
      ) : (
        <ComprovantePublicView snapshot={snap} />
      )}
    </main>
  );
}
