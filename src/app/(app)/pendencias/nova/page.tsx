"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { ColetaPontoSearchSelect } from "@/components/coletas/ColetaPontoSearchSelect";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import type { Ponto } from "@/lib/types/database";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatMoneyInput, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";

const TITULOS_PADRAO: Record<string, string> = {
  pagamento_pendente: "Deixei no ponto (sem leitura)",
  parcial: "Pagamento parcial",
  haver: "Haver do ponto",
};

export default function NovaPendenciaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [form, setForm] = useState({
    ponto_id: "",
    tipo: "pagamento_pendente",
    valor: "",
    titulo: TITULOS_PADRAO.pagamento_pendente,
    descricao: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const empresaId = await getEmpresaIdForUser(supabase);
      if (!empresaId) return;
      const { data } = await supabase
        .from("pontos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("status", "ativo")
        .order("nome");
      setPontos(data ?? []);
    }
    load();
  }, []);

  function onTipoChange(tipo: string) {
    setForm((f) => {
      const tituloPadraoAnterior = TITULOS_PADRAO[f.tipo] ?? "";
      const tituloAindaPadrao =
        !f.titulo.trim() || f.titulo.trim() === tituloPadraoAnterior;
      return {
        ...f,
        tipo,
        titulo: tituloAindaPadrao ? TITULOS_PADRAO[tipo] ?? f.titulo : f.titulo,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const valor = parseMoneyInput(form.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Informe um valor válido.");
      setLoading(false);
      return;
    }
    if (!form.ponto_id) {
      setError("Selecione o ponto.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/pendencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          valor,
          titulo:
            form.titulo.trim() ||
            TITULOS_PADRAO[form.tipo] ||
            "Pendência manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar pendência.");
        return;
      }
      router.push("/pendencias");
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pendencias" className="rounded-lg p-2 text-at-muted hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nova pendência</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <ColetaPontoSearchSelect
          label="Ponto *"
          value={form.ponto_id}
          onChange={(id) => setForm((f) => ({ ...f, ponto_id: id }))}
          options={pontos.map((p) => ({ value: p.id, label: p.nome }))}
          placeholder="Digite para buscar o ponto…"
        />
        <FormSelect
          label="Tipo *"
          value={form.tipo}
          onChange={(e) => onTipoChange(e.target.value)}
          options={[
            {
              value: "pagamento_pendente",
              label: "Deixei no ponto (sem leitura)",
            },
            { value: "parcial", label: "Pagamento parcial" },
            { value: "haver", label: "Haver (crédito do ponto)" },
          ]}
        />
        {form.tipo === "pagamento_pendente" && (
          <p className="text-xs text-amber-300/90">
            Use quando repôs o ponto sem leitura (ex.: mandou dinheiro após coleta negativa). Na
            próxima coleta, se o prejuízo da leitura for menor, o sistema abate automaticamente e
            você cobra a diferença do ponto — não soma como débito negativo.
          </p>
        )}
        {form.tipo === "haver" && (
          <p className="text-xs text-emerald-400/90">
            Crédito a favor do ponto — entra nas próximas coletas como haver para abater.
          </p>
        )}
        <FormInput
          label="Valor (R$) *"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00"
          value={form.valor}
          onChange={(e) =>
            setForm((f) => ({ ...f, valor: formatMoneyInput(e.target.value) }))
          }
          onBlur={(e) =>
            setForm((f) => ({
              ...f,
              valor: formatMoneyInputOnBlur(e.target.value),
            }))
          }
          required
        />
        <FormInput
          label="Título"
          value={form.titulo}
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
        />
        <FormTextarea
          label="Descrição"
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Criar pendência"}
        </button>
      </form>

      <LoadingOverlay
        show={loading}
        messages={[
          "Registrando pendência...",
          "Atualizando o ponto...",
          "Quase lá...",
        ]}
      />
    </div>
  );
}
