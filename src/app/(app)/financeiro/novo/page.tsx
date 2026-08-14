"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";

const categorias = [
  "Coleta", "Comissão", "Estoque", "Combustível", "Manutenção", "Funcionário", "Marketing", "Outros",
];

export default function NovoFinanceiroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tipo: "entrada",
    categoria: "Coleta",
    valor: "",
    valor_pix: "",
    valor_dinheiro: "",
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    forma_pagamento: "pix",
  });
  const ehMisto = form.forma_pagamento === "misto";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const empresaId = await getEmpresaIdForUser(supabase);
    const { data: { user } } = await supabase.auth.getUser();

    if (!empresaId) {
      setError("Empresa não encontrada. Finalize a configuração.");
      setLoading(false);
      return;
    }

    const pixMisto = parseFloat(String(form.valor_pix).replace(",", "."));
    const dinheiroMisto = parseFloat(String(form.valor_dinheiro).replace(",", "."));
    let valor: number;
    let detalheMisto = "";

    if (form.forma_pagamento === "misto") {
      const pixOk = Number.isFinite(pixMisto) && pixMisto > 0.009;
      const dinheiroOk = Number.isFinite(dinheiroMisto) && dinheiroMisto > 0.009;
      if (!pixOk || !dinheiroOk) {
        setError("No misto, informe quanto saiu (ou entrou) em Pix e quanto em dinheiro.");
        setLoading(false);
        return;
      }
      valor = pixMisto + dinheiroMisto;
      detalheMisto = formatPagamentoDetalhe(pixMisto, dinheiroMisto);
    } else {
      valor = parseFloat(String(form.valor).replace(",", "."));
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Informe um valor válido.");
      setLoading(false);
      return;
    }

    let valorFinal = valor;
    if (form.tipo === "saida") {
      const { fetchSaldoCaixa, valorSaidaPermitidaNoCaixa } = await import(
        "@/lib/financeiro/saldo-caixa"
      );
      const saldo = await fetchSaldoCaixa(supabase, empresaId);
      valorFinal = valorSaidaPermitidaNoCaixa(saldo, valor);
      if (valorFinal <= 0.009) {
        setError(
          `Caixa sem saldo (disponível: R$ ${Math.max(0, saldo).toFixed(2).replace(".", ",")}). Não é possível registrar saída.`
        );
        setLoading(false);
        return;
      }
      if (valorFinal + 0.009 < valor) {
        // Cap automático — avisa mas salva o máximo possível
        const ok = window.confirm(
          `Saldo do caixa é R$ ${Math.max(0, saldo).toFixed(2).replace(".", ",")}. ` +
            `A saída será limitada a R$ ${valorFinal.toFixed(2).replace(".", ",")} para o caixa não ficar negativo. Continuar?`
        );
        if (!ok) {
          setLoading(false);
          return;
        }
      }
    }

    const descricaoUsuario = form.descricao.trim();
    const descricao = detalheMisto
      ? descricaoUsuario
        ? `${descricaoUsuario} (${detalheMisto})`
        : detalheMisto
      : descricaoUsuario || null;

    const { error: insertError } = await supabase.from("financeiro").insert({
      empresa_id: empresaId,
      tipo: form.tipo,
      categoria: form.categoria,
      valor: valorFinal,
      data: form.data,
      descricao,
      forma_pagamento: form.forma_pagamento,
      operador_id: user?.id,
    });

    if (insertError) {
      setError("Erro ao salvar lançamento.");
      setLoading(false);
      return;
    }

    void fetch("/api/auditoria/evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao: "financeiro.criar",
        tabela: "financeiro",
        categoria: "financeiro",
        severidade: "medium",
        modulo: "financeiro",
        titulo: `Lançamento ${form.tipo} · ${form.categoria}`,
        resumo: `R$ ${valorFinal.toFixed(2)} · ${form.data}${form.descricao ? ` · ${form.descricao}` : ""}`,
        dados_novos: {
          tipo: form.tipo,
          categoria: form.categoria,
          valor: valorFinal,
          data: form.data,
          forma_pagamento: form.forma_pagamento,
        },
      }),
    });

    router.push("/financeiro");
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/financeiro" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Novo lançamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <FormSelect
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          options={[
            { value: "entrada", label: "Entrada" },
            { value: "saida", label: "Saída" },
          ]}
        />
        <FormSelect
          label="Categoria"
          value={form.categoria}
          onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
          options={categorias.map((c) => ({ value: c, label: c }))}
        />
        <FormSelect
          label="Forma de pagamento"
          value={form.forma_pagamento}
          onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}
          options={[
            { value: "dinheiro", label: "Dinheiro" },
            { value: "pix", label: "Pix" },
            { value: "misto", label: "Misto" },
          ]}
        />
        {ehMisto ? (
          <div className="space-y-3">
            <div className="grid gap-3 grid-cols-2">
              <FormInput
                label="Pix *"
                type="number"
                step="0.01"
                min="0.01"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor_pix}
                onChange={(e) => setForm((f) => ({ ...f, valor_pix: e.target.value }))}
              />
              <FormInput
                label="Dinheiro *"
                type="number"
                step="0.01"
                min="0.01"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor_dinheiro}
                onChange={(e) => setForm((f) => ({ ...f, valor_dinheiro: e.target.value }))}
              />
            </div>
            <p className="text-xs text-slate-500">
              Assim o Financeiro mostra quanto saiu (ou entrou) em cada um.
            </p>
          </div>
        ) : (
          <FormInput
            label="Valor"
            type="number"
            step="0.01"
            required
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          />
        )}
        <FormInput label="Data" type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
        <FormTextarea label="Descrição" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 disabled:opacity-50">
          {loading ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>

      <LoadingOverlay show={loading} message="Salvando lançamento..." />
    </div>
  );
}
