"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

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
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    forma_pagamento: "pix",
  });

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

    const { error: insertError } = await supabase.from("financeiro").insert({
      empresa_id: empresaId,
      tipo: form.tipo,
      categoria: form.categoria,
      valor: parseFloat(form.valor),
      data: form.data,
      descricao: form.descricao || null,
      forma_pagamento: form.forma_pagamento,
      operador_id: user?.id,
    });

    if (insertError) {
      setError("Erro ao salvar lançamento.");
      setLoading(false);
      return;
    }

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
        <FormInput label="Valor" type="number" step="0.01" required value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
        <FormInput label="Data" type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
        <FormTextarea label="Descrição" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 disabled:opacity-50">
          {loading ? "Salvando..." : "Salvar lançamento"}
        </button>
      </form>

      <LoadingOverlay show={loading} message="Salvando lançamento..." />
    </div>
  );
}
