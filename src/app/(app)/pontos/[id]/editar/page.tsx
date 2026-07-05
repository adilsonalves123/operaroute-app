import { createClient, getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditarPontoForm } from "@/components/pontos/EditarPontoForm";

export default async function EditarPontoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile?.empresa_id ?? "")
    .single();

  if (!ponto) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/pontos/${id}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar ponto</h1>
          <p className="text-slate-400 text-sm">{ponto.nome}</p>
        </div>
      </div>

      <EditarPontoForm
        pontoId={id}
        ponto={{
          nome: ponto.nome,
          responsavel: ponto.responsavel,
          whatsapp: ponto.whatsapp,
          cidade: ponto.cidade,
          bairro: ponto.bairro,
          endereco: ponto.endereco,
          status: ponto.status,
          comissao_percentual: ponto.comissao_percentual,
          observacoes: ponto.observacoes,
        }}
      />
    </div>
  );
}
