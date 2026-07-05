"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import type { Ponto } from "@/lib/types/database";
import { useEffect } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export default function NovaPendenciaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [form, setForm] = useState({
    ponto_id: "",
    tipo: "negativo",
    valor: "",
    titulo: "Débito manual",
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/pendencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
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
        <Link href="/pendencias" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nova pendência</h1>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <FormSelect
          label="Ponto *"
          value={form.ponto_id}
          onChange={(e) => setForm((f) => ({ ...f, ponto_id: e.target.value }))}
          options={[
            { value: "", label: "Selecione..." },
            ...pontos.map((p) => ({ value: p.id, label: p.nome })),
          ]}
        />
        <FormSelect
          label="Tipo *"
          value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          options={[
            { value: "negativo", label: "Débito negativo" },
            { value: "pagamento_pendente", label: "Pagamento pendente" },
            { value: "parcial", label: "Pagamento parcial" },
          ]}
        />
        <FormInput
          label="Valor (R$) *"
          type="number"
          step="0.01"
          min="0"
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
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
