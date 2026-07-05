"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import type { Equipamento } from "@/lib/types/database";

type PontoOpcao = { id: string; nome: string };

export function EquipamentoTransferirButton({
  equipamento,
  pontoAtualId,
  outrosPontos: outrosPontosIniciais,
}: {
  equipamento: Equipamento;
  pontoAtualId: string;
  outrosPontos?: PontoOpcao[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pontos, setPontos] = useState<PontoOpcao[]>(outrosPontosIniciais ?? []);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [destinoId, setDestinoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    if (outrosPontosIniciais) {
      setPontos(outrosPontosIniciais);
      return;
    }

    async function carregarPontos() {
      setCarregandoPontos(true);
      try {
        const res = await fetch(`/api/pontos?excluir=${pontoAtualId}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setPontos(data.pontos ?? []);
        }
      } finally {
        setCarregandoPontos(false);
      }
    }

    void carregarPontos();
  }, [aberto, pontoAtualId, outrosPontosIniciais]);

  async function confirmarTransferencia() {
    if (!destinoId) {
      setErro("Selecione o ponto de destino.");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const res = await fetch(`/api/equipamentos/${equipamento.id}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ponto_destino_id: destinoId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error ?? "Erro ao transferir equipamento.");
        return;
      }

      setAberto(false);
      setDestinoId("");
      router.refresh();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setErro("");
          setDestinoId("");
        }}
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-primary-neon transition"
        title="Transferir para outro ponto"
      >
        <ArrowRightLeft className="h-4 w-4" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="glass-card w-full max-w-md p-6 space-y-4 border border-blue-500/20 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transferir-titulo"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="transferir-titulo" className="font-semibold text-white">
                  Transferir equipamento
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {getEquipamentoDisplayNome(equipamento)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded p-1 text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              A máquina vai com as <strong className="text-slate-300">mesmas leituras</strong>{" "}
              (entrada/saída atual). Não cria pendência na transferência. Débitos e pendências do
              ponto de origem <strong className="text-slate-300">permanecem lá</strong>.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor={`destino-${equipamento.id}`}
                className="block text-sm font-medium text-slate-300"
              >
                Ponto de destino *
              </label>
              {carregandoPontos ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando pontos...
                </div>
              ) : (
                <select
                  id={`destino-${equipamento.id}`}
                  value={destinoId}
                  onChange={(e) => setDestinoId(e.target.value)}
                  className="w-full"
                  disabled={pontos.length === 0}
                >
                  <option value="">Selecione o ponto...</option>
                  {pontos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              )}
              {!carregandoPontos && pontos.length === 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/90 space-y-2">
                  <p>Você só tem este ponto cadastrado. Cadastre outro para transferir a máquina.</p>
                  <Link
                    href="/pontos/novo"
                    className="inline-block text-primary-neon font-medium hover:underline"
                    onClick={() => setAberto(false)}
                  >
                    + Cadastrar novo ponto
                  </Link>
                </div>
              )}
            </div>

            {erro && <p className="text-sm text-red-400">{erro}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="flex-1 rounded-lg border border-slate-500 bg-slate-800/80 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarTransferencia}
                disabled={loading || carregandoPontos || pontos.length === 0}
                className="flex-1 rounded-lg bg-primary-neon py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingOverlay
        show={loading}
        messages={[
          "Transferindo equipamento...",
          "Mantendo leituras atuais...",
          "Quase lá...",
        ]}
      />
    </>
  );
}
