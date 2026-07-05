"use client";

import { useState } from "react";
import Link from "next/link";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { PontoEnderecoFields } from "@/components/pontos/PontoEnderecoFields";
import { EquipamentosForm } from "@/components/pontos/EquipamentosForm";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatEnderecoSalvo } from "@/lib/endereco/brasil";
import { validateEquipamento, type EquipamentoInput } from "@/lib/equipamentos";
import type { PontoFormValues } from "@/lib/pontos/form";
import type { Nicho } from "@/lib/types/database";

export type { PontoFormValues };

type Props = {
  mode: "create" | "edit";
  pontoId?: string;
  initial: PontoFormValues;
  showEquipamentos?: boolean;
  nichosAtivos?: Nicho[];
};

export function PontoForm({
  mode,
  pontoId,
  initial,
  showEquipamentos = mode === "create",
  nichosAtivos,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PontoFormValues>(initial);
  const [equipamentos, setEquipamentos] = useState<EquipamentoInput[]>([]);

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

    const endereco = formatEnderecoSalvo(form.rua, form.numero);
    const payload = {
      nome: form.nome,
      responsavel: form.responsavel,
      whatsapp: form.whatsapp,
      cidade: form.cidade,
      bairro: form.bairro,
      endereco,
      status: form.status,
      comissao_percentual: form.comissao_percentual,
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

      window.location.href =
        mode === "edit" && pontoId ? `/pontos/${pontoId}` : "/pontos";
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
            }}
            onChange={(addr) =>
              setForm((prev) => ({
                ...prev,
                cep: addr.cep,
                rua: addr.rua,
                numero: addr.numero,
                bairro: addr.bairro,
                cidade: addr.cidade,
              }))
            }
          />

          <FormInput
            label="Comissão (%)"
            type="number"
            step="0.01"
            value={form.comissao_percentual}
            onChange={(e) => update("comissao_percentual", e.target.value)}
          />
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
