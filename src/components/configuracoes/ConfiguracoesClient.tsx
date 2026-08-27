"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Bell,
  Building2,
  ClipboardPen,
  CreditCard,
  LifeBuoy,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import type { Nicho } from "@/lib/types/database";
import type { FaixaPontos, PlanoDefinicao } from "@/lib/pricing";
import {
  diasRestantesTrial,
  estaEmTrial,
  temPagamentoValido,
  trialExpirado,
  trialFimEfetivoIso,
  type AcessoAssinaturaInput,
} from "@/lib/assinatura-acesso";
import { getPlanoByFaixa } from "@/lib/pricing";
import { getNichoConfig } from "@/lib/nicho";
import { DadosOperacaoForm } from "@/components/configuracoes/DadosOperacaoForm";
import { ConfiguracoesAssinaturaCard } from "@/components/configuracoes/ConfiguracoesAssinaturaCard";
import { CancelarAssinaturaCard } from "@/components/configuracoes/CancelarAssinaturaCard";
import { ConfiguracoesContaCard } from "@/components/configuracoes/ConfiguracoesContaCard";
import { ConfiguracoesAtalhosCard } from "@/components/configuracoes/ConfiguracoesAtalhosCard";
import { PushNotificacoesCard } from "@/components/configuracoes/PushNotificacoesCard";
import { ConfigRascunhoCard } from "@/components/configuracoes/ConfigRascunhoCard";
import { ZerarDadosButton } from "@/components/configuracoes/ZerarDadosButton";
import {
  ConfigHero,
  ConfigSection,
  ConfigSectionNav,
  ConfigShell,
  ConfigStatsStrip,
} from "@/components/configuracoes/configuracoes-ui";

type Props = {
  nomeOperacao: string;
  nomeResponsavel: string;
  email: string | null;
  whatsapp: string | null;
  chavePix?: string | null;
  faixa: FaixaPontos;
  nichosAtivos: Nicho[];
  pontosAtivos: number;
  planos?: PlanoDefinicao[];
  acesso: AcessoAssinaturaInput;
  podeCancelar: boolean;
  podeZerar: boolean;
  temCassino: boolean;
  rascunhoDashboardAtivo: boolean;
  podeEditarRascunho: boolean;
};

export function ConfiguracoesClient(props: Props) {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  const plano = getPlanoByFaixa(props.faixa, props.planos);
  const pagamentoOk = temPagamentoValido(props.acesso);
  const emTrial = estaEmTrial(props.acesso);
  const expirado = trialExpirado(props.acesso);
  const trialFim = trialFimEfetivoIso(props.acesso);
  const diasTrial = diasRestantesTrial(trialFim);

  let statusLabel = "Conta configurada";
  let statusTone: "active" | "trial" | "expired" | "neutral" = "neutral";
  if (pagamentoOk) {
    statusLabel = "Assinatura ativa";
    statusTone = "active";
  } else if (emTrial) {
    statusLabel = `Teste · ${diasTrial}d restantes`;
    statusTone = "trial";
  } else if (expirado) {
    statusLabel = "Teste encerrado";
    statusTone = "expired";
  }

  const nichoLabels = props.nichosAtivos
    .filter((n) => n !== "outros")
    .map((n) => getNichoConfig(n).label);

  const navItems = [
    { id: "operacao", label: "Operação" },
    { id: "assinatura", label: "Assinatura" },
    { id: "conta", label: "Conta" },
    { id: "alertas", label: "Alertas" },
    { id: "atalhos", label: "Atalhos" },
    { id: "rascunho", label: "Rascunho" },
  ];
  if (props.temCassino) navItems.push({ id: "cassino", label: "Cassino" });
  if (props.podeZerar) navItems.push({ id: "perigo", label: "Zona crítica" });

  return (
    <ConfigShell>
      <ConfigHero
        nomeOperacao={props.nomeOperacao}
        subtitle="Operação, cobrança e acesso da sua empresa — tudo num lugar só."
        statusLabel={statusLabel}
        statusTone={statusTone}
      />

      <ConfigStatsStrip
        items={[
          {
            label: "Plano",
            value: plano.nome,
            hint: plano.labelPontos,
          },
          {
            label: "Pontos",
            value: String(props.pontosAtivos),
            hint:
              plano.limitePontos >= 9999
                ? "ilimitados"
                : `limite ${plano.limitePontos}`,
          },
          {
            label: "Nichos",
            value: String(nichoLabels.length),
            hint: `até ${plano.maxNichos} no plano`,
          },
          {
            label: "Responsável",
            value: props.nomeResponsavel.split(" ")[0] || "—",
            hint: props.email ?? undefined,
          },
        ]}
      />

      <ConfigSectionNav items={navItems} />

      <ConfigSection
        id="operacao"
        title="Dados da operação"
        description="Nome, responsável, chave Pix e nichos que sua equipe usa no dia a dia."
        icon={Building2}
      >
        <DadosOperacaoForm
          nomeOperacao={props.nomeOperacao}
          nomeResponsavel={props.nomeResponsavel}
          chavePixInicial={props.chavePix}
          faixaInicial={props.faixa}
          nichosIniciais={props.nichosAtivos}
          pontosAtivos={props.pontosAtivos}
          planos={props.planos}
          embedded
        />
      </ConfigSection>

      <ConfigSection
        id="assinatura"
        title="Planos e cobrança"
        description="Upgrade, renovação manual no Mercado Pago e cancelamento."
        icon={CreditCard}
      >
        <div className="divide-y divide-white/[0.06]">
          <ConfiguracoesAssinaturaCard
            acesso={props.acesso}
            faixa={props.faixa}
            planos={props.planos}
            embedded
          />
          <CancelarAssinaturaCard
            id="cancelar-assinatura"
            acesso={props.acesso}
            podeCancelar={props.podeCancelar}
            embedded
          />
        </div>
      </ConfigSection>

      <ConfigSection
        id="conta"
        title="Sua conta"
        description="Identidade de login e contato do responsável."
        icon={User}
      >
        <ConfiguracoesContaCard
          nome={props.nomeResponsavel}
          email={props.email}
          whatsapp={props.whatsapp}
          embedded
        />
      </ConfigSection>

      <ConfigSection
        id="alertas"
        title="Alertas push"
        description="Avisos no celular ou PC quando a equipe opera em campo."
        icon={Bell}
      >
        <PushNotificacoesCard embedded />
      </ConfigSection>

      <ConfigSection
        id="atalhos"
        title="Equipe e suporte"
        description="Permissões da equipe e canal direto com o OperaRoute."
        icon={Users}
      >
        <ConfiguracoesAtalhosCard embedded />
      </ConfigSection>

      <ConfigSection
        id="rascunho"
        title="Rascunho"
        description="Tela opcional para digitar valores dos pontos e ver o resumo."
        icon={ClipboardPen}
      >
        <ConfigRascunhoCard
          ativo={props.rascunhoDashboardAtivo}
          podeEditar={props.podeEditarRascunho}
          embedded
        />
      </ConfigSection>

      {props.temCassino && (
        <ConfigSection
          id="cassino"
          title="Módulo Cassino"
          description="Comissão e abatimento são por ponto, não aqui."
          icon={ShieldAlert}
        >
          <div className="p-5 sm:p-6 text-[13px] leading-relaxed text-slate-400">
            Abatimento de débito e comissão ficam no cadastro de cada cliente.
            Abra{" "}
            <Link
              href="/pontos"
              className="text-[#c4a574] hover:text-[#e8d5b0] underline-offset-2 hover:underline"
            >
              Pontos
            </Link>
            , escolha o estabelecimento e ajuste na aba do equipamento cassino.
          </div>
        </ConfigSection>
      )}

      {props.podeZerar && (
        <ConfigSection
          id="perigo"
          title="Zona crítica"
          description="Ação irreversível — remove histórico operacional, mantém cadastros."
          icon={LifeBuoy}
          variant="danger"
        >
          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Apaga coletas, visitas, pendências e movimentos do caixa. Pontos,
              máquinas, estoque e configurações permanecem intactos.
            </p>
            <ZerarDadosButton embedded />
          </div>
        </ConfigSection>
      )}
    </ConfigShell>
  );
}
