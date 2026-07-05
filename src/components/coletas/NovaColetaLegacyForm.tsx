"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { getNichoConfig } from "@/lib/nicho";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { Nicho, Ponto } from "@/lib/types/database";

export function NovaColetaLegacyForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [nicho, setNicho] = useState<Nicho>("outros");
  const [form, setForm] = useState({
    ponto_id: "",
    valor_bruto: "",
    comissao_percentual: "",
    valor_pago_ponto: "",
    quantidade_furos: "",
    brindes_repostos: "",
    brindes_restantes: "",
    entrada: "",
    saida: "",
    forma_pagamento: "dinheiro",
    observacao: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const empresaId = await getEmpresaIdForUser(supabase);
      const { data: profile } = await supabase
        .from("profiles")
        .select("nicho")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      if (profile?.nicho) setNicho(profile.nicho as Nicho);

      if (empresaId) {
        const { data } = await supabase
          .from("pontos")
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("status", "ativo")
          .order("nome");
        setPontos(data ?? []);
      }
    }
    load();
  }, []);

  const config = getNichoConfig(nicho);
  const isFuraFura = nicho === "fura_fura";

  const valorBruto = parseFloat(form.valor_bruto) || 0;
  const comissaoPct = parseFloat(form.comissao_percentual) || 0;
  const valorComissao = (valorBruto * comissaoPct) / 100;
  const valorLiquido = valorBruto - valorComissao;

  function update(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "ponto_id") {
        const ponto = pontos.find((p) => p.id === value);
        if (ponto) next.comissao_percentual = String(ponto.comissao_percentual);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ponto_id) {
      setError("Selecione um ponto.");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const empresaId = await getEmpresaIdForUser(supabase);

    if (!empresaId || !user) {
      setError("Sessão inválida ou empresa não configurada.");
      setLoading(false);
      return;
    }

    const coletaData = {
      empresa_id: empresaId,
      ponto_id: form.ponto_id,
      operador_id: user.id,
      valor_bruto: valorBruto,
      comissao_percentual: comissaoPct,
      valor_comissao: valorComissao,
      valor_liquido: valorLiquido,
      valor_pago_ponto: parseFloat(form.valor_pago_ponto) || valorComissao,
      quantidade_furos: form.quantidade_furos ? parseInt(form.quantidade_furos) : null,
      brindes_repostos: form.brindes_repostos ? parseInt(form.brindes_repostos) : null,
      brindes_restantes: form.brindes_restantes ? parseInt(form.brindes_restantes) : null,
      entrada: null,
      saida: null,
      forma_pagamento: form.forma_pagamento,
      observacao: form.observacao || null,
    };

    const { data: coleta, error: coletaError } = await supabase
      .from("coletas")
      .insert(coletaData)
      .select()
      .single();

    if (coletaError) {
      setError("Erro ao registrar coleta.");
      setLoading(false);
      return;
    }

    await supabase
      .from("pontos")
      .update({ ultima_coleta: new Date().toISOString() })
      .eq("id", form.ponto_id);

    await supabase.from("financeiro").insert({
      empresa_id: empresaId,
      tipo: "entrada",
      categoria: "Coleta",
      valor: coletaData.valor_liquido,
      descricao: `Coleta - ${pontos.find((p) => p.id === form.ponto_id)?.nome}`,
      forma_pagamento: form.forma_pagamento,
      ponto_id: form.ponto_id,
      coleta_id: coleta.id,
      operador_id: user.id,
    });

    router.push("/coletas");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{config.labels.coletaNova}</h1>
          <p className="text-slate-400 text-sm">Registro rápido de coleta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <FormSelect
          label={`${config.labels.ponto} *`}
          value={form.ponto_id}
          onChange={(e) => update("ponto_id", e.target.value)}
          options={[
            { value: "", label: "Selecione..." },
            ...pontos.map((p) => ({ value: p.id, label: p.nome })),
          ]}
        />

        <FormInput
          label="Valor bruto arrecadado"
          type="number"
          step="0.01"
          value={form.valor_bruto}
          onChange={(e) => update("valor_bruto", e.target.value)}
        />

        <FormInput
          label="Comissão (%)"
          type="number"
          step="0.01"
          value={form.comissao_percentual}
          onChange={(e) => update("comissao_percentual", e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-card p-3">
            <p className="text-xs text-slate-400">Comissão</p>
            <p className="font-semibold text-amber-400">R$ {valorComissao.toFixed(2)}</p>
          </div>
          <div className="glass-card p-3">
            <p className="text-xs text-slate-400">Valor líquido</p>
            <p className="font-semibold text-green-400">R$ {valorLiquido.toFixed(2)}</p>
          </div>
        </div>

        {isFuraFura && (
          <>
            <FormInput
              label="Valor pago ao ponto"
              type="number"
              step="0.01"
              value={form.valor_pago_ponto}
              onChange={(e) => update("valor_pago_ponto", e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormInput
                label="Furos vendidos"
                type="number"
                value={form.quantidade_furos}
                onChange={(e) => update("quantidade_furos", e.target.value)}
              />
              <FormInput
                label="Brindes repostos"
                type="number"
                value={form.brindes_repostos}
                onChange={(e) => update("brindes_repostos", e.target.value)}
              />
              <FormInput
                label="Brindes restantes"
                type="number"
                value={form.brindes_restantes}
                onChange={(e) => update("brindes_restantes", e.target.value)}
              />
            </div>
          </>
        )}

        <FormSelect
          label="Forma de recebimento"
          value={form.forma_pagamento}
          onChange={(e) => update("forma_pagamento", e.target.value)}
          options={[
            { value: "dinheiro", label: "Dinheiro" },
            { value: "pix", label: "Pix" },
            { value: "misto", label: "Misto" },
          ]}
        />

        <FormTextarea
          label="Observação"
          value={form.observacao}
          onChange={(e) => update("observacao", e.target.value)}
        />

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar coleta"}
        </button>
      </form>

      <LoadingOverlay
        show={loading}
        messages={[
          "Registrando coleta...",
          "Atualizando financeiro...",
          "Quase lá...",
        ]}
      />
    </div>
  );
}
