import { redirect } from "next/navigation";
import { VisaoEquipePainel } from "@/components/equipe/VisaoEquipePainel";
import { PremiumPageHeader } from "@/components/layout/PremiumPageHeader";
import { carregarDadosPainelRestrito } from "@/lib/visao/carregar-admin";
import type { EquipeMember } from "@/lib/types/database";
import Link from "next/link";

export default async function PainelRestritoPage() {
  const { acesso, membros, pontos, visaoPontosPorEquipe } =
    await carregarDadosPainelRestrito();

  if (!acesso?.podeGerenciarEquipe && !acesso?.isOwner) {
    redirect("/dashboard?acesso=negado");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-6 sm:pt-10">
      <PremiumPageHeader
        title="Painel restrito"
        subtitle="Escolha o que cada operador vê. A coleta na rua continua normal."
      />
      <VisaoEquipePainel
        membros={membros as EquipeMember[]}
        pontos={pontos}
        visaoPontosPorEquipe={visaoPontosPorEquipe}
      />
      <p className="text-sm text-slate-500">
        Depois, no{" "}
        <Link href="/rascunho" className="text-[#c4a574] underline-offset-2 hover:underline">
          Rascunho
        </Link>
        , edite os valores e clique em Publicar para o painel.
      </p>
    </div>
  );
}
