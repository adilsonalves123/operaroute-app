"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import { getNichoConfig } from "@/lib/nicho";
import { mensagemNichosTravados } from "@/lib/nichos/nicho-travado";
import {
  getNichoPlanoStatus,
  getPlanoByFaixa,
  NICHOS_PAGOS,
  PLANOS_PADRAO,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import {
  champagneBtn,
  champagneBtnSolid,
  champagneLink,
  ConfigDataGrid,
  ConfigDataRow,
  ConfigNichoPills,
  ConfigPanelBody,
} from "@/components/configuracoes/configuracoes-ui";

type Props = {
  nomeOperacao: string;
  nomeResponsavel: string;
  chavePixInicial?: string | null;
  faixaInicial: FaixaPontos;
  nichosIniciais: Nicho[];
  pontosAtivos: number;
  planos?: PlanoDefinicao[];
  embedded?: boolean;
};

export function DadosOperacaoForm({
  nomeOperacao: nomeInicial,
  nomeResponsavel: responsavelInicial,
  chavePixInicial = null,
  faixaInicial,
  nichosIniciais,
  pontosAtivos,
  planos: planosProp,
  embedded = false,
}: Props) {
  const router = useRouter();
  const planos = planosProp?.length ? planosProp : PLANOS_PADRAO;
  const plano = useMemo(
    () => getPlanoByFaixa(faixaInicial, planos),
    [faixaInicial, planos]
  );

  const nichosTravados = useMemo(
    () => nichosIniciais.filter((n) => NICHOS_PAGOS.includes(n)),
    [nichosIniciais]
  );

  const [editing, setEditing] = useState(false);
  const [nomeOperacao, setNomeOperacao] = useState(nomeInicial);
  const [nomeResponsavel, setNomeResponsavel] = useState(responsavelInicial);
  const [chavePix, setChavePix] = useState(chavePixInicial ?? "");
  const [nichos, setNichos] = useState<Nicho[]>(nichosTravados);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const planoStatus = getNichoPlanoStatus(nichos, faixaInicial, planos);
  const nichoLabels = nichosIniciais
    .filter((n) => n !== "outros")
    .map((n) => getNichoConfig(n).label);

  function resetFromProps() {
    setNomeOperacao(nomeInicial);
    setNomeResponsavel(responsavelInicial);
    setChavePix(chavePixInicial ?? "");
    setNichos(nichosTravados);
    setError("");
    setSuccess("");
  }

  function onChangeNichos(next: Nicho[]) {
    setError("");
    setSuccess("");
    const pagos = next.filter((n) => NICHOS_PAGOS.includes(n));
    const removidos = nichosTravados.filter((n) => !pagos.includes(n));
    if (removidos.length > 0) {
      setError(mensagemNichosTravados(removidos));
      return;
    }
    if (pagos.length === 0) {
      setError("Selecione pelo menos um nicho.");
      return;
    }
    if (pagos.length > plano.maxNichos) {
      setError(
        `O plano ${plano.nome} permite até ${plano.maxNichos} nicho(s). Faça upgrade em Planos.`
      );
      return;
    }
    setNichos(pagos);
  }

  async function handleSalvar() {
    setError("");
    setSuccess("");

    const nome = nomeOperacao.trim();
    const responsavel = nomeResponsavel.trim();
    if (!nome || !responsavel) {
      setError("Preencha nome da operação e responsável.");
      return;
    }
    if (nichos.length === 0) {
      setError("Selecione pelo menos um nicho.");
      return;
    }
    if (pontosAtivos > plano.limitePontos) {
      setError(
        `Você tem ${pontosAtivos} pontos ativos. O plano ${plano.nome} permite até ${
          plano.limitePontos >= 9999 ? "ilimitados" : plano.limitePontos
        }. Ajuste em Planos ou remova pontos.`
      );
      return;
    }

    setLoading(true);
    try {
      const [dadosRes, planoRes] = await Promise.all([
        fetch("/api/empresa/dados", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome_operacao: nome,
            nome_responsavel: responsavel,
            chave_pix: chavePix.trim() || null,
          }),
        }),
        fetch("/api/empresa/plano", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nichos,
            quantidade_pontos: faixaInicial,
          }),
        }),
      ]);

      const dadosData = await dadosRes.json().catch(() => ({}));
      const planoData = await planoRes.json().catch(() => ({}));

      if (!dadosRes.ok) {
        setError(dadosData.error ?? "Erro ao salvar dados.");
        return;
      }
      if (!planoRes.ok) {
        setError(planoData.error ?? "Erro ao salvar nichos.");
        return;
      }

      setSuccess("Alterações salvas.");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const editBtn = !editing ? (
    <button
      type="button"
      onClick={() => {
        resetFromProps();
        setEditing(true);
      }}
      className={champagneBtn}
    >
      <Pencil className="h-3.5 w-3.5" />
      Editar
    </button>
  ) : (
    <button
      type="button"
      onClick={() => {
        resetFromProps();
        setEditing(false);
      }}
      className="text-[12px] text-slate-500 hover:text-slate-300 transition"
    >
      Cancelar
    </button>
  );

  const body = (
    <>
      <LoadingOverlay show={loading} message="Salvando…" />
      {!editing ? (
        <ConfigDataGrid>
          <ConfigDataRow label="Nome da operação" value={nomeInicial || "—"} />
          <ConfigDataRow label="Responsável" value={responsavelInicial || "—"} />
          <ConfigDataRow
            label="Chave Pix"
            value={chavePixInicial?.trim() || "Não cadastrada"}
          />
          <ConfigDataRow
            label="Plano contratado"
            value={`${plano.nome}`}
            highlight
          />
          <div className="flex items-start justify-between gap-6 py-3.5">
            <span className="text-slate-500 shrink-0">Nichos ativos</span>
            <ConfigNichoPills labels={nichoLabels} />
          </div>
          <ConfigDataRow
            label="Vagas no plano"
            value={`${planoStatus.nichosPagosAtivos} de ${planoStatus.maxNichosPagos}${
              planoStatus.vagasRestantes > 0
                ? ` · ${planoStatus.vagasRestantes} livre(s)`
                : ""
            }`}
          />
          <ConfigDataRow
            label="Pontos em uso"
            value={`${pontosAtivos} / ${plano.limitePontos >= 9999 ? "∞" : plano.limitePontos}`}
          />
        </ConfigDataGrid>
      ) : (
        <div className="space-y-5">
          <FormInput
            label="Nome da operação"
            value={nomeOperacao}
            onChange={(e) => setNomeOperacao(e.target.value)}
            placeholder="Ex: Operação Centro SP"
            required
          />
          <FormInput
            label="Responsável"
            value={nomeResponsavel}
            onChange={(e) => setNomeResponsavel(e.target.value)}
            placeholder="Seu nome"
            required
          />
          <FormInput
            label="Chave Pix (cobrança WhatsApp)"
            value={chavePix}
            onChange={(e) => setChavePix(e.target.value)}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          />

          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/25 p-3">
            <NichoCardsCarousel
              key={editing ? "edit-nichos" : "view-nichos"}
              values={nichos}
              onChangeMulti={onChangeNichos}
              lockedValues={nichosTravados}
              confirmBeforeSelect
              onLockedAttempt={(nicho) =>
                setError(mensagemNichosTravados([nicho]))
              }
              title="Nichos ativos"
              subtitle={`Até ${plano.maxNichos} no plano ${plano.nome} (${nichos.length}/${plano.maxNichos})`}
            />
          </div>

          <p className="text-[12px] text-slate-500 leading-relaxed">
            Cada nicho escolhido é definitivo: não dá para trocar depois. Para
            alterar, fale com o{" "}
            <Link href="/suporte" className={champagneLink}>
              suporte
            </Link>
            . Faixa de pontos e pagamento em{" "}
            <Link href="/planos" className={champagneLink}>
              Planos e assinatura
            </Link>
            .
          </p>

          {error && (
            <p className="text-sm text-rose-400" role="alert">{error}</p>
          )}
          {success && (
            <p className="text-sm text-[#c4a574]" role="status">{success}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSalvar()}
            disabled={loading}
            className={`${champagneBtnSolid} w-full`}
          >
            Salvar alterações
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <ConfigPanelBody>
        <div className="mb-4 flex justify-end">{editBtn}</div>
        {body}
      </ConfigPanelBody>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex justify-end">{editBtn}</div>
      {body}
    </div>
  );
}
