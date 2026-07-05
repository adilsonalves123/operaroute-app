import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, MessageCircle } from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { ColetaFuraFuraResumo } from "@/components/coletas/fura-fura/ColetaFuraFuraResumo";
import { ExcluirColetaFuraFuraButton } from "@/components/coletas/fura-fura/ExcluirColetaFuraFuraButton";
import {
  calculoFromColetaSalva,
  mensagemWhatsAppColeta,
  parseBrindesSalvos,
  saldoPendenteColeta,
} from "@/lib/nichos/fura-fura";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function whatsAppUrl(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export default async function ColetaFuraFuraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) notFound();

  const supabase = await createClient();
  const { data: coleta } = await supabase
    .from("coletas")
    .select("*, pontos(nome, whatsapp, cidade, bairro, endereco)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .eq("nicho_modulo", "fura_fura")
    .maybeSingle();

  if (!coleta) notFound();

  const { data: pagamentos } = await supabase
    .from("coleta_pagamentos")
    .select("*")
    .eq("coleta_id", id)
    .order("created_at");

  const ponto = coleta.pontos as {
    nome: string;
    whatsapp: string | null;
    cidade: string | null;
    bairro: string | null;
    endereco: string | null;
  } | null;

  const calculo = calculoFromColetaSalva(coleta);
  const brindes = parseBrindesSalvos(coleta.brindes_entregues);
  const pendente = saldoPendenteColeta(coleta);
  const waLink = whatsAppUrl(
    ponto?.whatsapp,
    mensagemWhatsAppColeta(ponto?.nome ?? "Ponto", calculo)
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">
              {ponto?.nome ?? "Coleta fura-fura"}
            </h1>
            {pendente > 0.009 ? (
              <AlertBadge variant="warning">Pendente</AlertBadge>
            ) : (
              <AlertBadge variant="success">Quitada</AlertBadge>
            )}
          </div>
          <p className="text-sm text-slate-400">{formatDateTime(coleta.created_at)}</p>
        </div>
      </div>

      <ColetaFuraFuraResumo calculo={calculo} />

      <div className="glass-card p-6 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-slate-500">Furos</p>
          <p className="font-medium text-white">
            {coleta.quantidade_furos ?? 0} × {formatCurrency(Number(coleta.preco_furo ?? 0))}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Forma pagamento</p>
          <p className="font-medium text-white capitalize">{coleta.forma_pagamento ?? "—"}</p>
        </div>
        {Number(coleta.desconto ?? 0) > 0.009 && (
          <div>
            <p className="text-slate-500">Desconto</p>
            <p className="font-medium text-white">{formatCurrency(Number(coleta.desconto))}</p>
          </div>
        )}
        {coleta.brindes_repostos != null && (
          <div>
            <p className="text-slate-500">Brindes repostos</p>
            <p className="font-medium text-white">{coleta.brindes_repostos}</p>
          </div>
        )}
      </div>

      {brindes.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h2 className="font-semibold text-white text-sm">Brindes entregues</h2>
          {brindes.map((b, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-slate-800 pb-2 last:border-0">
              <span className="text-slate-300">
                {b.nome} × {b.quantidade}
              </span>
              <span className="text-slate-400 tabular-nums">
                {formatCurrency(b.quantidade * b.custo_unitario)}
              </span>
            </div>
          ))}
        </div>
      )}

      {coleta.foto_url && (
        <div className="glass-card p-6 space-y-2">
          <h2 className="font-semibold text-white text-sm">Foto da máquina</h2>
          <ExpandableImage src={coleta.foto_url} alt="Foto da coleta" className="h-48" />
        </div>
      )}

      {coleta.observacao && (
        <div className="glass-card p-6">
          <p className="text-xs text-slate-500 mb-1">Observação</p>
          <p className="text-sm text-slate-300">{coleta.observacao}</p>
        </div>
      )}

      {(pagamentos ?? []).length > 0 && (
        <div className="glass-card p-6 space-y-2">
          <h2 className="font-semibold text-white text-sm">Pagamentos registrados</h2>
          {pagamentos!.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-slate-400">{formatDateTime(p.created_at)}</span>
              <span className="text-green-400 tabular-nums">{formatCurrency(Number(p.valor))}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        {coleta.latitude && coleta.longitude && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2 py-2">
            <MapPin className="h-3.5 w-3.5" />
            GPS registrado
          </span>
        )}
        <ExcluirColetaFuraFuraButton coletaId={id} />
      </div>
    </div>
  );
}
