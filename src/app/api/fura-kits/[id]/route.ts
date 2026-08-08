import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { premiosFromReposicao } from "@/lib/nichos/fura-fura/kits/premios-from-reposicao";
import { desmontarKitsNoCentral } from "@/lib/nichos/fura-fura/kits/montar-kit-estoque";
import {
  devolverTodoKitAoEstoque,
  montarKitsProntos,
  quantidadeKitNoDeposito,
} from "@/lib/nichos/fura-fura/kits/sincronizar-estoque-kit";

type RouteCtx = { params: Promise<{ id: string }> };

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

function reposicaoIgual(
  a: { estoque_item_id: string | null; nome: string; quantidade: number; custo_unitario: number }[],
  b: { estoque_item_id: string | null; nome: string; quantidade: number; custo_unitario: number }[]
): boolean {
  if (a.length !== b.length) return false;
  const key = (r: (typeof a)[0]) =>
    `${r.estoque_item_id ?? ""}|${r.nome}|${r.quantidade}|${r.custo_unitario}`;
  const sa = [...a].map(key).sort();
  const sb = [...b].map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: kit, error } = await supabase
    .from("fura_kits")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (error || !kit) {
    return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });
  }

  const [{ data: reposicao }, { data: premios }] = await Promise.all([
    supabase.from("fura_kit_reposicao_itens").select("*").eq("kit_id", id),
    supabase.from("fura_kit_premios").select("*").eq("kit_id", id).order("ordem"),
  ]);

  return NextResponse.json({
    kit: { ...kit, reposicao_itens: reposicao ?? [], premios: premios ?? [] },
  });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();
  const empresaId = profile.empresa_id;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("fura_kits")
    .select("id")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.nome != null) {
    const nome = String(body.nome).trim();
    if (!nome) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    updates.nome = nome;
  }
  if (body.descricao !== undefined) {
    updates.descricao = body.descricao ? String(body.descricao).trim() : null;
  }
  if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo);
  if (body.ordem !== undefined) updates.ordem = Math.floor(Number(body.ordem) || 0);
  if (body.foto_url !== undefined) {
    updates.foto_url =
      body.foto_url === null || body.foto_url === ""
        ? null
        : String(body.foto_url).trim();
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("fura_kits").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let noDeposito: number | undefined;

  if (body.reposicao_itens != null) {
    const reposicao = parseReposicao(body.reposicao_itens);
    if (!reposicao.length) {
      return NextResponse.json({ error: "O kit precisa ter ao menos um item." }, { status: 400 });
    }

    const { data: atualRows } = await supabase
      .from("fura_kit_reposicao_itens")
      .select("estoque_item_id, nome, quantidade, custo_unitario")
      .eq("kit_id", id);

    const atualReposicao = (atualRows ?? []).map((r) => ({
      estoque_item_id: (r.estoque_item_id as string | null) ?? null,
      nome: String(r.nome),
      quantidade: Number(r.quantidade) || 1,
      custo_unitario: Number(r.custo_unitario) || 0,
    }));

    const mudou = !reposicaoIgual(atualReposicao, reposicao);
    const antes = await quantidadeKitNoDeposito(supabase, empresaId, id);

    if (mudou) {
      const dev = await devolverTodoKitAoEstoque(supabase, {
        empresaId,
        kitId: id,
        operadorId: user?.id ?? null,
        observacao: "Item removido/alterado no kit — voltou ao estoque",
      });
      if (dev.error) return NextResponse.json({ error: dev.error }, { status: 400 });
    }

    await supabase.from("fura_kit_reposicao_itens").delete().eq("kit_id", id);
    const { error } = await supabase
      .from("fura_kit_reposicao_itens")
      .insert(reposicao.map((r) => ({ ...r, kit_id: id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (body.premios == null) {
      const premios = premiosFromReposicao(reposicao);
      await supabase.from("fura_kit_premios").delete().eq("kit_id", id);
      await supabase.from("fura_kit_premios").insert(premios.map((p) => ({ ...p, kit_id: id })));
    }

    if (mudou) {
      const alvo = Math.max(1, antes);
      const sync = await montarKitsProntos(supabase, {
        empresaId,
        kitId: id,
        quantidade: alvo,
        operadorId: user?.id ?? null,
        observacao: "Composição do kit atualizada",
      });
      if (sync.error) {
        return NextResponse.json(
          {
            error:
              sync.error +
              (antes > 0
                ? " Os itens já voltaram ao estoque; confira a quantidade e salve de novo."
                : ""),
          },
          { status: 400 }
        );
      }
      noDeposito = sync.noDeposito;
    }
  }

  if (body.premios != null) {
    const premiosParsed = parsePremios(body.premios);
    const reposicaoRows =
      body.reposicao_itens != null ? parseReposicao(body.reposicao_itens) : null;
    let reposicao = reposicaoRows;
    if (!reposicao) {
      const { data } = await supabase
        .from("fura_kit_reposicao_itens")
        .select("*")
        .eq("kit_id", id);
      reposicao = (data ?? []).map((r) => ({
        estoque_item_id: r.estoque_item_id,
        nome: r.nome,
        quantidade: r.quantidade,
        custo_unitario: r.custo_unitario,
      }));
    }
    const premios = premiosParsed.length ? premiosParsed : premiosFromReposicao(reposicao);
    if (!premios.length) {
      return NextResponse.json({ error: "O kit precisa ter ao menos um item." }, { status: 400 });
    }
    await supabase.from("fura_kit_premios").delete().eq("kit_id", id);
    const { error } = await supabase
      .from("fura_kit_premios")
      .insert(premios.map((p) => ({ ...p, kit_id: id })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(noDeposito != null ? { quantidade_montada: noDeposito } : {}),
  });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresaId = profile.empresa_id;

  const { data: existing } = await supabase
    .from("fura_kits")
    .select("id, nome")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });
  }

  const { data: pontosComKit } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .eq("kit_ativo_id", id)
    .limit(8);

  if (pontosComKit && pontosComKit.length > 0) {
    const nomes = pontosComKit.map((p) => p.nome).join(", ");
    return NextResponse.json(
      {
        error: `Este kit está instalado em ponto(s): ${nomes}. Remova o kit do ponto antes de excluir.`,
      },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deposito } = await supabase
    .from("fura_kits_estoque")
    .select("quantidade")
    .eq("empresa_id", empresaId)
    .eq("kit_id", id)
    .maybeSingle();

  const noDeposito = Math.max(0, Math.floor(Number(deposito?.quantidade) || 0));
  if (noDeposito > 0) {
    const result = await desmontarKitsNoCentral(supabase, {
      empresaId,
      kitId: id,
      quantidade: noDeposito,
      operadorId: user?.id ?? null,
      observacao: "Desmontagem automática ao excluir o kit",
    });
    if (result.error) {
      return NextResponse.json(
        {
          error: `Há ${noDeposito} kit(s) no depósito. Não deu para devolver ao estoque: ${result.error}`,
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("fura_kits")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    desmontados: noDeposito > 0 ? noDeposito : 0,
  });
}
