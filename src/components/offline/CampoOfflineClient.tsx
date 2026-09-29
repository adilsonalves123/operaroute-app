"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff, Loader2, MapPin, RefreshCw, Search, Wifi } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { usePermissoes } from "@/components/layout/PermissoesProvider";
import { horaDoPreparo } from "@/components/offline/CampoOfflineInit";
import {
  EVENTO_CAMPO_MUDOU,
  campoDisponivel,
  lerMeta,
  lerTabela,
  type LinhaRetrato,
  type MetaCampo,
} from "@/lib/offline/campo-db";
import {
  formulariosDosNichos,
  nichoDoEquipamento,
  pontoDoDestino,
  type FormularioCampo,
} from "@/lib/offline/campo-rotas";
import { prepararCampo } from "@/lib/offline/preparar-campo";
import { agregarDividaCobravelPorPonto } from "@/lib/visitas-ponto/divida-ponto";

type PontoCampo = {
  id: string;
  nome: string;
  local: string;
  formularios: FormularioCampo[];
  maquinas: number;
  pendente: number;
};

type Dados = {
  pontos: LinhaRetrato[];
  equipamentos: LinhaRetrato[];
  pendencias: LinhaRetrato[];
  meta: MetaCampo | null;
};

const VAZIO: Dados = { pontos: [], equipamentos: [], pendencias: [], meta: null };

async function carregarDados(): Promise<Dados> {
  const [pontos, equipamentos, pendencias, meta] = await Promise.all([
    lerTabela("pontos"),
    lerTabela("equipamentos"),
    lerTabela("pendencias"),
    lerMeta(),
  ]);
  return {
    pontos: pontos?.linhas ?? [],
    equipamentos: equipamentos?.linhas ?? [],
    pendencias: pendencias?.linhas ?? [],
    meta,
  };
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function montarPontos(dados: Dados, visaoRestrita: boolean, visaoPontoIds: string[]): PontoCampo[] {
  const nichos = dados.meta?.nichos ?? [];
  const formulariosAtivos = formulariosDosNichos(nichos);
  const rotasAtivas = new Set(formulariosAtivos.map((f) => f.rota));
  const permitidos = new Set(visaoPontoIds);

  const nichosPorPonto = new Map<string, Set<string>>();
  const maquinasPorPonto = new Map<string, number>();
  for (const eq of dados.equipamentos) {
    const pontoId = texto(eq.ponto_id);
    if (!pontoId || eq.status !== "ativo") continue;
    const nicho = nichoDoEquipamento(eq.tipo);
    if (nicho) {
      const set = nichosPorPonto.get(pontoId) ?? new Set<string>();
      set.add(nicho);
      nichosPorPonto.set(pontoId, set);
    }
    maquinasPorPonto.set(pontoId, (maquinasPorPonto.get(pontoId) ?? 0) + 1);
  }

  const dividas = agregarDividaCobravelPorPonto(
    dados.pendencias as Parameters<typeof agregarDividaCobravelPorPonto>[0]
  );

  return dados.pontos
    .filter((p) => p.status === "ativo")
    .filter((p) => !visaoRestrita || permitidos.has(texto(p.id)))
    .map((p) => {
      const id = texto(p.id);
      const doPonto = new Set(nichosPorPonto.get(id) ?? []);
      if (p.kit_ativo_id || (p.preco_furo !== null && p.preco_furo !== undefined)) doPonto.add("fura_fura");
      const proprios = formulariosDosNichos([...doPonto]).filter((f) => rotasAtivas.has(f.rota));
      return {
        id,
        nome: texto(p.nome) || "Ponto sem nome",
        local: [texto(p.endereco), texto(p.bairro), texto(p.cidade)].filter(Boolean).join(" · "),
        formularios: proprios.length > 0 ? proprios : formulariosAtivos,
        maquinas: maquinasPorPonto.get(id) ?? 0,
        pendente: dividas.get(id)?.totalPendente ?? 0,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

function CartaoPonto({ ponto, destaque }: { ponto: PontoCampo; destaque: boolean }) {
  return (
    <li
      className={cn(
        "bank-card p-4",
        destaque && "border-[#c4a574]/40 bg-[#c4a574]/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-at-primary">{ponto.nome}</p>
          {ponto.local ? (
            <p className="mt-0.5 flex items-start gap-1 text-[13px] text-at-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{ponto.local}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-at-soft">
            {ponto.maquinas === 1 ? "1 máquina" : `${ponto.maquinas} máquinas`}
            {ponto.pendente > 0 ? (
              <span className="text-amber-200"> · pendente {formatCurrency(ponto.pendente)}</span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ponto.formularios.map((f) => (
          // <a> e não <Link>: sem internet a navegação precisa ser uma página inteira.
          <a
            key={f.rota}
            href={`${f.rota}?ponto=${encodeURIComponent(ponto.id)}`}
            className="rounded-sm border border-at bg-at-card px-3 py-2 text-[13px] font-medium text-at-link transition hover:bg-at-card-soft"
          >
            Coletar {f.rotulo}
          </a>
        ))}
      </div>
    </li>
  );
}

export function CampoOfflineClient() {
  const online = useOnline();
  const { visaoRestrita, visaoPontoIds } = usePermissoes();
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (!campoDisponivel()) {
      Promise.resolve().then(() => setCarregando(false));
      return;
    }
    let vivo = true;
    const recarregar = () => {
      carregarDados()
        .then((d) => {
          if (!vivo) return;
          setDados(d);
          setDestaqueId(pontoDoDestino(new URLSearchParams(window.location.search).get("de")));
        })
        .catch(() => {})
        .finally(() => {
          if (vivo) setCarregando(false);
        });
    };
    recarregar();
    window.addEventListener(EVENTO_CAMPO_MUDOU, recarregar);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_CAMPO_MUDOU, recarregar);
    };
  }, []);

  const pontos = useMemo(
    () => montarPontos(dados, visaoRestrita, visaoPontoIds),
    [dados, visaoRestrita, visaoPontoIds]
  );

  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    const lista = q
      ? pontos.filter((p) => semAcento(`${p.nome} ${p.local}`).includes(q))
      : pontos;
    if (!destaqueId) return lista;
    const idx = lista.findIndex((p) => p.id === destaqueId);
    if (idx <= 0) return lista;
    return [lista[idx], ...lista.slice(0, idx), ...lista.slice(idx + 1)];
  }, [pontos, busca, destaqueId]);

  async function atualizarAgora() {
    const dono = dados.meta?.dono;
    if (!dono) {
      setMensagem("Abra qualquer tela do app com internet para preparar o modo campo.");
      return;
    }
    setAtualizando(true);
    setMensagem(null);
    const r = await prepararCampo(dono);
    setAtualizando(false);
    setMensagem(
      r.ok
        ? `Pronto: ${r.pontos} ponto${r.pontos === 1 ? "" : "s"} guardado${r.pontos === 1 ? "" : "s"} no celular.`
        : r.motivo
    );
  }

  const preparadoEm = dados.meta?.preparado_em ?? null;
  const destaque = destaqueId ? pontos.find((p) => p.id === destaqueId) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-at-link/80">Modo campo</p>
        <h1 className="mt-1.5 text-2xl tracking-tight text-at-primary">Coletar sem internet</h1>
        <p className="mt-1 text-sm text-at-muted">
          Escolha o ponto e o tipo de coleta. O que você salvar fica guardado no celular e vai para o
          sistema sozinho quando o sinal voltar.
        </p>
      </div>

      <div className="bank-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-at-muted">
          {online ? (
            <Wifi className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <CloudOff className="h-4 w-4 shrink-0 text-amber-400" />
          )}
          <span className="min-w-0">
            <span className="text-at-primary">{online ? "Com internet" : "Sem internet"}</span>
            <span className="text-at-soft">
              {" · "}
              {preparadoEm
                ? `dados da rota de ${horaDoPreparo(preparadoEm)}`
                : "rota ainda não baixada neste aparelho"}
            </span>
          </span>
        </p>
        {online ? (
          <button
            type="button"
            onClick={() => void atualizarAgora()}
            disabled={atualizando}
            className="flex items-center gap-1.5 rounded-sm border border-at bg-at-card px-3 py-1.5 text-[12px] font-medium text-at-link transition hover:bg-at-card-soft disabled:opacity-50 sm:text-[13px]"
          >
            {atualizando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Baixar rota agora
          </button>
        ) : null}
        {mensagem ? <p className="w-full text-[13px] text-at-muted">{mensagem}</p> : null}
      </div>

      {destaqueId && !destaque && !carregando ? (
        <p className="rounded-sm border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[13px] text-amber-200">
          Essa tela não estava guardada no celular. Escolha o ponto abaixo para coletar.
        </p>
      ) : null}

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-at-soft" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ponto, bairro ou cidade"
          className="w-full rounded-sm border border-at bg-at-card py-2.5 pl-9 pr-3 text-sm text-at-primary placeholder:text-at-soft focus:outline-none focus:ring-1 focus:ring-[#c4a574]/40"
        />
      </label>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando pontos guardados…
        </p>
      ) : pontos.length === 0 ? (
        <p className="text-sm text-at-muted">
          Nenhum ponto guardado neste aparelho ainda. Abra o app com internet e aguarde alguns
          segundos — ele baixa a rota sozinho.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-at-muted">Nenhum ponto encontrado para “{busca}”.</p>
      ) : (
        <ul className="space-y-3">
          {filtrados.map((p) => (
            <CartaoPonto key={p.id} ponto={p} destaque={p.id === destaqueId} />
          ))}
        </ul>
      )}
    </div>
  );
}
