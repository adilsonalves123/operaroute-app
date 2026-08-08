"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { PontoEnderecoFields } from "@/components/pontos/PontoEnderecoFields";
import { FotoPontoField } from "@/components/pontos/FotoPontoField";
import { EquipamentosForm } from "@/components/pontos/EquipamentosForm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatEnderecoSalvo } from "@/lib/endereco/brasil";
import { validateEquipamento, type EquipamentoInput } from "@/lib/equipamentos";
import type { PontoFormValues } from "@/lib/pontos/form";
import type { Nicho } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoPonto } from "@/lib/storage/coleta-fotos";
import type { EquipamentoTipo } from "@/lib/equipamentos";
import { matchEquipamentoCriado, salvarFotoEquipamento } from "@/lib/equipamentos/salvar-foto-equipamento";
import {
  LABEL_COMISSAO_NICHO,
  buildComissaoPorNichoPayload,
  nichosComissaoVisiveis,
} from "@/lib/pontos/comissao-nicho";

export type { PontoFormValues };

type Props = {
  mode: "create" | "edit";
  pontoId?: string;
  initial: PontoFormValues;
  fotoUrlInicial?: string | null;
  showEquipamentos?: boolean;
  nichosAtivos?: Nicho[];
};

export function PontoForm({
  mode,
  pontoId,
  initial,
  fotoUrlInicial = null,
  showEquipamentos = mode === "create",
  nichosAtivos,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PontoFormValues>(initial);
  const [equipamentos, setEquipamentos] = useState<EquipamentoInput[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(fotoUrlInicial);
  const [fotoExistenteRemovida, setFotoExistenteRemovida] = useState(false);

  useEffect(() => {
    setFotoPreview(fotoUrlInicial);
    setFotoExistenteRemovida(false);
    setFotoFile(null);
  }, [fotoUrlInicial, pontoId]);

  function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    if (file) {
      setFotoPreview(URL.createObjectURL(file));
      setFotoExistenteRemovida(false);
    } else {
      setFotoPreview(null);
      setFotoExistenteRemovida(Boolean(fotoUrlInicial));
    }
  }

  function update(field: keyof PontoFormValues, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (showEquipamentos) {
      const filled = equipamentos.filter(
        (eq) => eq.tipo || eq.nome.trim() || eq.numero_maquina.trim()
      );
      for (const eq of filled) {
        const err = validateEquipamento(eq);
        if (err) {
          setError(err);
          return;
        }
      }
    }

    setLoading(true);

    const comissaoMap = buildComissaoPorNichoPayload(form.comissao_por_nicho, nichosAtivos);
    // Legado: mantém comissao_percentual alinhada ao cassino/fura (ou primeiro nicho %)
    const legado =
      comissaoMap.maquinas_cassino ??
      comissaoMap.fura_fura ??
      Object.values(comissaoMap)[0] ??
      0;

    const endereco = formatEnderecoSalvo(form.rua, form.numero);
    const lat = parseFloat(form.latitude.replace(",", "."));
    const lng = parseFloat(form.longitude.replace(",", "."));
    const payload = {
      nome: form.nome,
      responsavel: form.responsavel,
      whatsapp: form.whatsapp,
      cidade: form.cidade,
      bairro: form.bairro,
      endereco,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      status: form.status,
      comissao_percentual: legado,
      comissao_por_nicho: comissaoMap,
      consignado_modo_comissao: "tabela",
      observacoes: form.observacoes,
      ...(showEquipamentos ? { equipamentos: equipamentos.filter((eq) => eq.tipo) } : {}),
    };

    try {
      const url = mode === "edit" && pontoId ? `/api/pontos/${pontoId}` : "/api/pontos";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needs_onboarding || res.status === 404) {
          setError("Configuração incompleta. Finalize o onboarding para continuar.");
        } else {
          setError(data.error ?? "Erro ao salvar ponto.");
        }
        return;
      }

      const savedId = mode === "edit" && pontoId ? pontoId : (data.id as string | undefined);
      if (savedId && mode === "create" && data.equipamentos?.length) {
        const criados = data.equipamentos as {
          id: string;
          nome: string;
          numero_maquina: string | null;
          tipo: EquipamentoTipo;
        }[];
        for (const serverEq of criados) {
          const localEq = equipamentos.find((eq) => matchEquipamentoCriado(eq, serverEq));
          if (localEq?.fotoFile) {
            const foto = await salvarFotoEquipamento(serverEq.id, localEq.fotoFile);
            if (!foto.ok) {
              setError(`Ponto salvo, mas falhou a foto de ${serverEq.nome}: ${foto.error}`);
              window.location.href = `/pontos/${savedId}`;
              return;
            }
          }
        }
      }

      if (savedId && (fotoFile || fotoExistenteRemovida)) {
        let fotoUrl: string | null = fotoExistenteRemovida && !fotoFile ? null : null;
        if (fotoFile) {
          const supabase = createClient();
          const empresaId = await getEmpresaIdForUser(supabase);
          if (!empresaId) {
            setError("Ponto salvo, mas empresa não encontrada para enviar a foto.");
            window.location.href = `/pontos/${savedId}`;
            return;
          }
          fotoUrl = await uploadFotoPonto(supabase, empresaId, savedId, fotoFile);
        }
        const fotoRes = await fetch(`/api/pontos/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ foto_url: fotoUrl }),
        });
        if (!fotoRes.ok) {
          const fotoData = await fotoRes.json();
          setError(fotoData.error ?? "Ponto salvo, mas falhou ao gravar a foto.");
          window.location.href = `/pontos/${savedId}`;
          return;
        }
      }

      window.location.href = savedId ? `/pontos/${savedId}` : "/pontos";
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-semibold text-white">Dados do ponto</h3>
          <FotoPontoField preview={fotoPreview} onChange={handleFotoChange} />
          <FormInput
            label="Nome do ponto *"
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Responsável"
              value={form.responsavel}
              onChange={(e) => update("responsavel", e.target.value)}
            />
            <FormInput
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </div>

          <PontoEnderecoFields
            value={{
              cep: form.cep,
              rua: form.rua,
              numero: form.numero,
              bairro: form.bairro,
              cidade: form.cidade,
              latitude: form.latitude,
              longitude: form.longitude,
            }}
            onChange={(addr) =>
              setForm((prev) => ({
                ...prev,
                cep: addr.cep,
                rua: addr.rua,
                numero: addr.numero,
                bairro: addr.bairro,
                cidade: addr.cidade,
                latitude: addr.latitude,
                longitude: addr.longitude,
              }))
            }
          />

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div>
              <p className="text-sm font-medium text-white">Comissão por nicho (%)</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Cada nicho tem o próprio percentual neste ponto — consignado não herda o do cassino.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {nichosComissaoVisiveis(nichosAtivos)
                .filter((key) => key !== "consignado")
                .map((key) => (
                <FormInput
                  key={key}
                  label={`${LABEL_COMISSAO_NICHO[key]} (%)`}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={form.comissao_por_nicho[key] ?? "0"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      comissao_por_nicho: {
                        ...prev.comissao_por_nicho,
                        [key]: e.target.value,
                      },
                    }))
                  }
                />
              ))}
            </div>
            {nichosComissaoVisiveis(nichosAtivos).includes("consignado") && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5 text-xs text-slate-400">
                <p className="font-medium text-amber-200/90">Consignado</p>
                <p className="mt-0.5">
                  Não usa % aqui. O recolhe usa a tabela do produto: custo, valor final e quanto o
                  cliente ganha (R$ por unidade) — cadastrado em Produtos consignados.
                </p>
              </div>
            )}
          </div>
          <FormSelect
            label="Status"
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            options={[
              { value: "ativo", label: "Ativo" },
              { value: "pausado", label: "Pausado" },
              { value: "retirado", label: "Retirado" },
              { value: "inadimplente", label: "Inadimplente" },
            ]}
          />
          <FormTextarea
            label="Observações"
            value={form.observacoes}
            onChange={(e) => update("observacoes", e.target.value)}
          />
        </div>

        {showEquipamentos && (
          <div className="glass-card p-6">
            <EquipamentosForm
              equipamentos={equipamentos}
              onChange={setEquipamentos}
              nichosAtivos={nichosAtivos}
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
            {error}
            {error.includes("Configuração") && (
              <Link href="/configuracao" className="block mt-2 text-primary-neon underline">
                Ir para configuração →
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Cadastrar ponto"}
        </button>
      </form>

      <LoadingOverlay
        show={loading}
        messages={[
          mode === "edit" ? "Salvando ponto..." : "Cadastrando ponto...",
          "Atualizando endereço...",
          "Quase lá...",
        ]}
      />
    </>
  );
}
