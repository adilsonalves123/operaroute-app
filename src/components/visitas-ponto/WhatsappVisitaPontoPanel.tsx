"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, Download, Loader2, MessageCircle, X, ZoomIn } from "lucide-react";
import { captureElementAsPng } from "@/lib/nichos/cassino/capture-relatorio";
import { downloadBlob, whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import {
  mensagemCobrancaVisitaPonto,
  linkWhatsAppCobrancaVisitaPonto,
} from "@/lib/visitas-ponto/relatorio-whatsapp";
import { totaisComprovanteVisita } from "@/lib/visitas-ponto/comprovante-totais";
import type { VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import { RelatorioVisitaPontoView } from "@/components/visitas-ponto/RelatorioVisitaPontoView";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatCurrency } from "@/lib/utils";
import {
  abrirWhatsAppComComprovante,
  criarLinkComprovante,
} from "@/lib/comprovantes/client";
import { snapshotFromVisitaPonto } from "@/lib/comprovantes/from-visita-ponto";

type Props = {
  resumo: VisitaPontoResumo;
  whatsapp: string | null;
  dividaSaldo?: number;
  desconto?: number;
  pix?: number;
  dinheiro?: number;
  previa?: boolean;
  chavePix?: string | null;
  nomeOperacao?: string | null;
  haverSaldo?: number;
  descontarHaver?: boolean;
  /** Cerimônia de fechamento — tipografia ouro, sem caixa verde. */
  variante?: "default" | "ceremony";
};

export function WhatsappVisitaPontoPanel({
  resumo,
  whatsapp,
  dividaSaldo = 0,
  desconto = 0,
  pix = 0,
  dinheiro = 0,
  previa = false,
  chavePix = null,
  nomeOperacao = null,
  haverSaldo = 0,
  descontarHaver = false,
  variante = "default",
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expandido) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandido(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expandido]);

  const optsMsg = useMemo(
    () => ({
      dividaSaldo,
      desconto,
      pix,
      dinheiro,
      previa,
      chavePix,
      nomeOperacao,
      haverSaldo,
      descontarHaver,
    }),
    [
      dividaSaldo,
      desconto,
      pix,
      dinheiro,
      previa,
      chavePix,
      nomeOperacao,
      haverSaldo,
      descontarHaver,
    ]
  );

  const totais = useMemo(
    () =>
      totaisComprovanteVisita(resumo, {
        dividaSaldo,
        desconto,
        pix,
        dinheiro,
        haverSaldo,
        descontarHaver,
      }),
    [resumo, dividaSaldo, desconto, pix, dinheiro, haverSaldo, descontarHaver]
  );

  /** Só cobra o que ainda falta — se já pagou tudo, não mostrar "Cobrar" de novo. */
  const valorCobrar = totais.restante;
  const mostrarCobrar = valorCobrar > 0.009;
  const visitaQuitada =
    !previa && resumo.status === "finalizada" && !mostrarCobrar;

  if (resumo.itensConcluidos === 0) return null;

  const cobrarLink = linkWhatsAppCobrancaVisitaPonto(whatsapp, resumo, optsMsg);

  const reportProps = {
    resumo,
    dividaSaldo,
    desconto,
    pix,
    dinheiro,
    previa,
    haverSaldo,
    descontarHaver,
  };

  const comprovanteInput = useMemo(() => {
    const snapshot = snapshotFromVisitaPonto(resumo, {
      previa,
      dividaSaldo,
      desconto,
      pix,
      dinheiro,
      haverSaldo,
      descontarHaver,
      nomeOperacao,
      chavePix,
    });
    return {
      visita_ponto_id: resumo.visitaPontoId,
      previa,
      divida_saldo: dividaSaldo,
      desconto,
      pix,
      dinheiro,
      haver_saldo: haverSaldo,
      descontar_haver: descontarHaver,
      nome_operacao: nomeOperacao,
      chave_pix: chavePix,
      snapshot,
    } as const;
  }, [
    resumo,
    previa,
    dividaSaldo,
    desconto,
    pix,
    dinheiro,
    haverSaldo,
    descontarHaver,
    nomeOperacao,
    chavePix,
  ]);

  async function gerarPng() {
    if (!reportRef.current) throw new Error("Relatório não disponível.");
    return captureElementAsPng(reportRef.current);
  }

  async function handleWhatsApp() {
    setErro("");
    setLoading(true);
    try {
      await abrirWhatsAppComComprovante({
        telefone: whatsapp,
        input: comprovanteInput,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPng() {
    setErro("");
    setLoading(true);
    try {
      const blob = await gerarPng();
      downloadBlob(
        blob,
        `${previa ? "previa" : "comprovante"}-visita-${resumo.visitaPontoId.slice(0, 8)}.png`
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar PNG.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCobrar() {
    if (!whatsapp) {
      window.alert("Cadastre o WhatsApp do ponto para cobrar.");
      return;
    }
    if (!chavePix?.trim()) {
      const seguir = window.confirm(
        "Nenhuma chave Pix cadastrada em Configurações. Abrir WhatsApp sem a chave?"
      );
      if (!seguir) return;
    }
    setErro("");
    setLoading(true);
    try {
      const { url } = await criarLinkComprovante(comprovanteInput);
      const base = mensagemCobrancaVisitaPonto(resumo, optsMsg);
      const msg = `${base}\n\nComprovante: ${url}`;
      const link = whatsAppUrl(whatsapp, msg) || cobrarLink;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } catch (err) {
      // Fallback: cobrança sem link se a tabela ainda não existir
      const msg = mensagemCobrancaVisitaPonto(resumo, optsMsg);
      const link = cobrarLink ?? whatsAppUrl(whatsapp, msg);
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      setErro(err instanceof Error ? err.message : "Link indisponível; abriu só a cobrança.");
    } finally {
      setLoading(false);
    }
  }

  const ceremony = variante === "ceremony";

  return (
    <>
      <div
        className={
          ceremony
            ? "space-y-4"
            : visitaQuitada
              ? "rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 space-y-3"
              : "rounded-xl border border-green-500/25 bg-green-500/[0.04] p-4 space-y-3"
        }
      >
        {!ceremony && (
          <div>
            <p className="text-sm font-medium text-green-300">
              {previa
                ? "Prévia / cobrança ao cliente"
                : visitaQuitada
                  ? "Comprovante da visita"
                  : "Enviar comprovante ao cliente"}
            </p>
            <p className="mt-1 text-xs text-at-muted">
              {previa
                ? "Cobrar e enviar abrem o WhatsApp com um link do comprovante (o cliente vê no celular)."
                : visitaQuitada
                  ? "Visita já quitada. Opcional: enviar o comprovante no WhatsApp ou baixar o PNG."
                  : mostrarCobrar
                    ? "Cobrar e enviar abrem o WhatsApp com um link do comprovante (o cliente vê no celular)."
                    : "Abre o WhatsApp com um link do comprovante — sem precisar anexar imagem."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {mostrarCobrar && (
            <button
              type="button"
              disabled={loading}
              onClick={handleCobrar}
              className={
                ceremony
                  ? "inline-flex items-center justify-center gap-2 bg-[#c4a574] px-5 py-3 text-[13px] font-semibold tracking-wide text-[#1a140c] transition hover:bg-[#d4b888] disabled:opacity-50"
                  : "inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
              }
            >
              <Banknote className="h-4 w-4" />
              Cobrar {formatCurrency(valorCobrar)}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={handleWhatsApp}
            className={
              ceremony
                ? "inline-flex items-center justify-center gap-2 border border-[#c4a574]/35 bg-[#c4a574]/10 px-5 py-3 text-[13px] font-medium text-[#e8dcc8] transition hover:bg-[#c4a574]/15 disabled:opacity-50"
                : visitaQuitada
                  ? "inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  : "inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {previa
              ? "WhatsApp · link"
              : ceremony || visitaQuitada
                ? "Enviar comprovante"
                : "Enviar link"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleDownloadPng}
            className={
              ceremony
                ? "inline-flex items-center justify-center gap-2 px-3 py-3 text-[13px] text-at-muted underline-offset-4 transition hover:text-[#e8dcc8] hover:underline disabled:opacity-50"
                : "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-at-primary/85 hover:bg-slate-800 disabled:opacity-50"
            }
          >
            <Download className="h-4 w-4" />
            Baixar PNG
          </button>
        </div>

        {erro && <p className="text-xs text-amber-300/90">{erro}</p>}

        <button
          type="button"
          onClick={() => setExpandido(true)}
          className={
            ceremony
              ? "group relative w-full overflow-x-auto border border-[#c4a574]/20 bg-black/40 p-3 text-left transition hover:border-[#c4a574]/45"
              : "group relative w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-left transition hover:border-primary-neon/40"
          }
          aria-label="Ampliar relatório"
        >
          <RelatorioVisitaPontoView ref={reportRef} {...reportProps} />
          <span
            className={
              ceremony
                ? "pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/75 px-2.5 py-1.5 text-[11px] tracking-wide text-[#e8dcc8] opacity-90 sm:opacity-0 sm:transition sm:group-hover:opacity-100"
                : "pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs text-white opacity-90 shadow-lg sm:opacity-0 sm:transition sm:group-hover:opacity-100"
            }
          >
            <ZoomIn className="h-3.5 w-3.5" />
            Ampliar
          </span>
        </button>
      </div>

      {mounted &&
        expandido &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 sm:p-6"
            onClick={() => setExpandido(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Relatório ampliado"
          >
            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className="max-h-[92vh] w-full max-w-[580px] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <RelatorioVisitaPontoView {...reportProps} expanded />
            </div>
          </div>,
          document.body
        )}

      <LoadingOverlay
        show={loading}
        messages={["Gerando link...", "Preparando WhatsApp...", "Quase lá..."]}
      />
    </>
  );
}
