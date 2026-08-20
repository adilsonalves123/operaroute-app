import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizarNumeroSerie,
  type BuscaNumeroSerieResult,
  type ColetaSerieHistorico,
  type EquipamentoSerieResumo,
} from "./numero-serie";

function mapEquipamento(
  row: Record<string, unknown>,
  pontoNome?: string | null
): EquipamentoSerieResumo {
  const pontos = row.pontos as { nome: string } | { nome: string }[] | null | undefined;
  const pontoIdRaw = row.ponto_id;
  const ponto_id =
    pontoIdRaw != null && String(pontoIdRaw).trim() && String(pontoIdRaw) !== "null"
      ? String(pontoIdRaw)
      : null;
  const nomePonto =
    pontoNome ??
    (Array.isArray(pontos) ? pontos[0]?.nome : pontos?.nome) ??
    null;

  return {
    id: String(row.id),
    ponto_id,
    nome: String(row.nome ?? ""),
    numero_maquina: row.numero_maquina != null ? String(row.numero_maquina) : null,
    numero_serie: row.numero_serie != null ? String(row.numero_serie) : null,
    tipo: String(row.tipo ?? ""),
    status: String(row.status ?? "ativo"),
    numero_entrada: row.numero_entrada != null ? Number(row.numero_entrada) : null,
    numero_saida: row.numero_saida != null ? Number(row.numero_saida) : null,
    foto_url: row.foto_url != null ? String(row.foto_url) : null,
    created_at: String(row.created_at ?? ""),
    ponto_nome: ponto_id ? nomePonto : null,
    em_estoque: !ponto_id,
  };
}

export async function buscarHistoricoPorNumeroSerie(
  supabase: SupabaseClient,
  empresaId: string,
  serieRaw: string,
  opts?: {
    pontoAtualId?: string | null;
    /** Ficha que o usuário está olhando — o aviso fala dela, não de outra com a mesma série. */
    equipamentoAtualId?: string | null;
    limiteColetas?: number;
  }
): Promise<BuscaNumeroSerieResult> {
  const serie = serieRaw.trim();
  const normalizado = normalizarNumeroSerie(serie);
  const limite = opts?.limiteColetas ?? 25;

  if (!normalizado) {
    return {
      serie,
      encontrado: false,
      equipamento_ativo: null,
      equipamentos_historico: [],
      duplicatas_ativas: [],
      coletas: [],
      foto_referencia: null,
      aviso: null,
    };
  }

  const { data: equipamentosRaw } = await supabase
    .from("equipamentos")
    .select(
      "id, ponto_id, nome, numero_maquina, numero_serie, tipo, status, numero_entrada, numero_saida, foto_url, created_at, pontos(nome)"
    )
    .eq("empresa_id", empresaId)
    .eq("tipo", "cassino")
    .not("numero_serie", "is", null)
    .order("created_at", { ascending: false });

  const equipamentos_historico = (equipamentosRaw ?? [])
    .filter((row) => normalizarNumeroSerie(String(row.numero_serie ?? "")) === normalizado)
    .map((row) => mapEquipamento(row as Record<string, unknown>));

  const equipamentoAtualId = opts?.equipamentoAtualId?.trim() || null;
  const fichaAtual = equipamentoAtualId
    ? equipamentos_historico.find((e) => e.id === equipamentoAtualId) ?? null
    : null;

  // Preferência: máquina ativa alocada; senão a do estoque; senão qualquer ativa.
  const equipamento_ativo =
    fichaAtual ??
    equipamentos_historico.find((e) => e.status === "ativo" && e.ponto_id) ??
    equipamentos_historico.find((e) => e.status === "ativo" && e.em_estoque) ??
    equipamentos_historico.find((e) => e.status === "ativo") ??
    null;

  const duplicatas_ativas = equipamentos_historico.filter(
    (e) =>
      e.status === "ativo" &&
      (!equipamento_ativo || e.id !== equipamento_ativo.id)
  );

  const equipamentoIds = equipamentos_historico.map((e) => e.id);

  let coletas: ColetaSerieHistorico[] = [];

  if (equipamentoIds.length > 0) {
    const { data: coletasPorId } = await supabase
      .from("coletas")
      .select(
        "id, visita_id, created_at, entrada_anterior, saida_anterior, entrada_atual, saida_atual, entrada_periodo, saida_periodo, lucro_centavos, foto_url, ponto_id, equipamento_id, equipamento_numero_serie, pontos(nome)"
      )
      .eq("empresa_id", empresaId)
      .in("equipamento_id", equipamentoIds)
      .order("created_at", { ascending: false })
      .limit(limite);

    coletas = (coletasPorId ?? []).map((c) => {
      const eq = equipamentos_historico.find((e) => e.id === c.equipamento_id);
      const pontos = c.pontos as { nome: string } | { nome: string }[] | null;
      const pontoNome = Array.isArray(pontos) ? pontos[0]?.nome : pontos?.nome;
      return {
        id: c.id,
        visita_id: c.visita_id,
        created_at: c.created_at,
        entrada_anterior: c.entrada_anterior,
        saida_anterior: c.saida_anterior,
        entrada_atual: c.entrada_atual,
        saida_atual: c.saida_atual,
        entrada_periodo: c.entrada_periodo,
        saida_periodo: c.saida_periodo,
        lucro_centavos: c.lucro_centavos,
        foto_url: c.foto_url,
        ponto_id: c.ponto_id,
        ponto_nome: pontoNome ?? eq?.ponto_nome ?? null,
        equipamento_nome: eq?.nome ?? null,
        equipamento_id: c.equipamento_id ?? null,
      };
    });
  }

  if (coletas.length < limite) {
    const { data: coletasPorSerie } = await supabase
      .from("coletas")
      .select(
        "id, visita_id, created_at, entrada_anterior, saida_anterior, entrada_atual, saida_atual, entrada_periodo, saida_periodo, lucro_centavos, foto_url, ponto_id, equipamento_id, equipamento_numero_serie, pontos(nome)"
      )
      .eq("empresa_id", empresaId)
      .not("equipamento_numero_serie", "is", null)
      .order("created_at", { ascending: false })
      .limit(limite);

    const idsJaInclusos = new Set(coletas.map((c) => c.id));

    for (const c of coletasPorSerie ?? []) {
      if (idsJaInclusos.has(c.id)) continue;
      if (normalizarNumeroSerie(String(c.equipamento_numero_serie ?? "")) !== normalizado) {
        continue;
      }
      const pontos = c.pontos as { nome: string } | { nome: string }[] | null;
      const pontoNome = Array.isArray(pontos) ? pontos[0]?.nome : pontos?.nome;
      coletas.push({
        id: c.id,
        visita_id: c.visita_id,
        created_at: c.created_at,
        entrada_anterior: c.entrada_anterior,
        saida_anterior: c.saida_anterior,
        entrada_atual: c.entrada_atual,
        saida_atual: c.saida_atual,
        entrada_periodo: c.entrada_periodo,
        saida_periodo: c.saida_periodo,
        lucro_centavos: c.lucro_centavos,
        foto_url: c.foto_url,
        ponto_id: c.ponto_id,
        ponto_nome: pontoNome ?? null,
        equipamento_nome: null,
        equipamento_id: c.equipamento_id ?? null,
      });
      idsJaInclusos.add(c.id);
      if (coletas.length >= limite) break;
    }

    coletas.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    coletas = coletas.slice(0, limite);
  }

  // Leituras desta ficha primeiro (evita misturar contador de cadastro duplicado).
  if (equipamentoAtualId) {
    const desta = coletas.filter((c) => c.equipamento_id === equipamentoAtualId);
    const outras = coletas.filter((c) => c.equipamento_id !== equipamentoAtualId);
    coletas = [...desta, ...outras];
  }

  const fotoColeta = coletas.find((c) => c.foto_url)?.foto_url ?? null;
  const foto_referencia =
    (fichaAtual?.foto_url || equipamento_ativo?.foto_url) ??
    equipamentos_historico.find((e) => e.foto_url)?.foto_url ??
    fotoColeta;

  let aviso: string | null = null;
  const ref = fichaAtual ?? equipamento_ativo;
  const outraAlocada = duplicatas_ativas.find((e) => Boolean(e.ponto_id));
  const outraEstoque = duplicatas_ativas.find((e) => e.em_estoque || !e.ponto_id);

  if (ref) {
    if (outraAlocada && (ref.em_estoque || !ref.ponto_id)) {
      const onde = outraAlocada.ponto_nome?.trim() || "outro ponto";
      aviso = `Esta ficha está no estoque, mas existe outra com a mesma série ativa em "${onde}". Cadastro duplicado — use só uma e apague/inative a outra.`;
    } else if (outraEstoque && ref.ponto_id) {
      aviso = `Esta máquina está em "${ref.ponto_nome ?? "ponto"}", mas existe outra ficha com a mesma série no estoque. Cadastro duplicado.`;
    } else if (outraAlocada && ref.ponto_id && outraAlocada.ponto_id !== ref.ponto_id) {
      aviso = `Série duplicada: também há ficha ativa em "${outraAlocada.ponto_nome ?? "outro ponto"}".`;
    } else if (ref.em_estoque || !ref.ponto_id) {
      aviso = opts?.pontoAtualId
        ? "Esta série está no estoque. Quer trazer esta máquina para cá?"
        : "Esta série está no estoque central.";
    } else if (
      opts?.pontoAtualId &&
      ref.ponto_id !== opts.pontoAtualId
    ) {
      const onde = ref.ponto_nome?.trim() || "outro ponto";
      aviso = `Esta série já está ativa em "${onde}". Você pode transferir para cá em vez de cadastrar de novo.`;
    } else if (!opts?.pontoAtualId && !fichaAtual) {
      aviso = `Ativa no ponto "${ref.ponto_nome ?? "—"}".`;
    } else if (ref.ponto_id) {
      aviso = `Alocada em "${ref.ponto_nome ?? "ponto"}".`;
    }
  }

  return {
    serie,
    encontrado: equipamentos_historico.length > 0 || coletas.length > 0,
    equipamento_ativo,
    equipamentos_historico,
    duplicatas_ativas,
    coletas,
    foto_referencia,
    aviso,
  };
}
