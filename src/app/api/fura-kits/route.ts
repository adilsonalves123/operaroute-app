import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { premiosFromReposicao } from "@/lib/nichos/fura-fura/kits/premios-from-reposicao";
import { montarKitsProntos } from "@/lib/nichos/fura-fura/kits/sincronizar-estoque-kit";

function parseReposicao(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      estoque_item_id: typeof r.estoque_item_id === "string" ? r.estoque_item_id : null,
      nome: String(r.nome ?? "").trim(),
      quantidade: Math.max(1, Math.floor(Number(r.quantidade) || 1)),
      custo_unitario: Math.max(0, Number(r.custo_unitario) || 0),
    }))
    .filter((r) => r.nome);
}

function parsePremios(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => ({
      estoque_item_id: typeof p.estoque_item_id === "string" ? p.estoque_item_id : null,
      nome: String(p.nome ?? "").trim(),
      custo_unitario: Math.max(0, Number(p.custo_unitario) || 0),
      ordem: Math.floor(Number(p.ordem) ?? i),
    }))
    .filter((p) => p.nome);
}

function kitDbErrorMessage(message: string): string {
  if (message.includes("permission denied") && message.includes("fura_kit")) {
    return "Permissão negada no banco. Rode supabase/fura-fura-kits-permissoes.sql no Supabase SQL Editor.";
  }
  if (message.includes("fura_kits") && message.includes("schema cache")) {
    return "Tabela de kits não encontrada. Rode supabase/fura-fura-kits.sql no Supabase SQL Editor.";
  }
  return message;
}

export async function GET() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: kits, error } = await supabase
    .from("fura_kits")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("ordem")
    .order("nome");

  if (error) {
    return NextResponse.json({ error: kitDbErrorMessage(error.message) }, { status: 500 });
  }

  const kitIds = (kits ?? []).map((k) => k.id);
  if (kitIds.length === 0) {
    return NextResponse.json({ kits: [] });
  }

  const [{ data: reposicao }, { data: premios }, { data: kitsEstoque }] = await Promise.all([
    supabase.from("fura_kit_reposicao_itens").select("*").in("kit_id", kitIds),
    supabase.from("fura_kit_premios").select("*").in("kit_id", kitIds).order("ordem"),
    supabase
      .from("fura_kits_estoque")
      .select("kit_id, quantidade")
      .eq("empresa_id", profile.empresa_id),
  ]);

  const estoqueIds = [
    ...new Set(
      (reposicao ?? [])
        .map((r) => (typeof r.estoque_item_id === "string" ? r.estoque_item_id : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const fotosPorEstoque = new Map<string, string | null>();
  if (estoqueIds.length > 0) {
    const { data: estoqueRows } = await supabase
      .from("estoque")
      .select("id, foto_url")
      .eq("empresa_id", profile.empresa_id)
      .in("id", estoqueIds);
    for (const row of estoqueRows ?? []) {
      fotosPorEstoque.set(row.id, row.foto_url ?? null);
    }
  }

  const montadosMap = new Map(
    (kitsEstoque ?? []).map((r) => [r.kit_id, Number(r.quantidade) || 0])
  );

  const enriched = (kits ?? []).map((k) => {
    const reposicaoItens = (reposicao ?? [])
      .filter((r) => r.kit_id === k.id)
      .map((r) => ({
        ...r,
        foto_url:
          typeof r.estoque_item_id === "string"
            ? (fotosPorEstoque.get(r.estoque_item_id) ?? null)
            : null,
      }));

    const fotoFallback =
      reposicaoItens.find((r) => typeof r.foto_url === "string" && r.foto_url)?.foto_url ??
      null;

    return {
      ...k,
      // Capa do kit, ou primeira foto dos itens da composição
      foto_url: k.foto_url || fotoFallback,
      reposicao_itens: reposicaoItens,
      premios: (premios ?? []).filter((p) => p.kit_id === k.id),
      quantidade_montada: montadosMap.get(k.id) ?? 0,
    };
  });

  return NextResponse.json({ kits: enriched });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const nome = String(body.nome ?? "").trim();
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome do kit." }, { status: 400 });
  }

  const reposicao = parseReposicao(body.reposicao_itens);
  const premiosParsed = parsePremios(body.premios);
  const premios = premiosParsed.length ? premiosParsed : premiosFromReposicao(reposicao);
  if (!reposicao.length) {
    return NextResponse.json({ error: "Adicione ao menos um item ao kit." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: kit, error } = await supabase
    .from("fura_kits")
    .insert({
      empresa_id: profile.empresa_id,
      nome,
      descricao: body.descricao ? String(body.descricao).trim() : null,
      ativo: body.ativo !== false,
      ordem: Math.floor(Number(body.ordem) || 0),
    })
    .select("id")
    .single();

  if (error || !kit) {
    return NextResponse.json(
      { error: kitDbErrorMessage(error?.message ?? "Erro ao criar kit.") },
      { status: 500 }
    );
  }

  const { error: repErr } = await supabase.from("fura_kit_reposicao_itens").insert(
    reposicao.map((r) => ({ ...r, kit_id: kit.id }))
  );
  if (repErr) {
    await supabase.from("fura_kits").delete().eq("id", kit.id);
    return NextResponse.json({ error: kitDbErrorMessage(repErr.message) }, { status: 500 });
  }

  const { error: premErr } = await supabase.from("fura_kit_premios").insert(
    premios.map((p) => ({ ...p, kit_id: kit.id }))
  );
  if (premErr) {
    await supabase.from("fura_kits").delete().eq("id", kit.id);
    return NextResponse.json({ error: kitDbErrorMessage(premErr.message) }, { status: 500 });
  }

  const quantidadeMontar = Math.min(
    999,
    Math.max(1, Math.floor(Number(body.quantidade) || 1))
  );

  const sync = await montarKitsProntos(supabase, {
    empresaId: profile.empresa_id,
    kitId: kit.id,
    quantidade: quantidadeMontar,
    operadorId: user?.id ?? null,
    observacao:
      quantidadeMontar === 1
        ? `Kit "${nome}" criado`
        : `Kit "${nome}" criado — ${quantidadeMontar} montados`,
  });

  if (sync.error) {
    await supabase.from("fura_kits").delete().eq("id", kit.id);
    return NextResponse.json(
      {
        error:
          sync.error.includes("insuficiente") || sync.error.includes("insuficientes")
            ? `Estoque insuficiente para montar o kit. ${sync.error}`
            : sync.error,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    id: kit.id,
    quantidade_montada: sync.noDeposito ?? 1,
  });
}
