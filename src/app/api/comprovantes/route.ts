import { NextResponse } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  criarComprovanteCassino,
  criarComprovanteVisitaPonto,
} from "@/lib/comprovantes/server";
import {
  comprovantePublicUrl,
  gerarTokenComprovante,
  mensagemWhatsAppComLink,
  type ComprovanteSnapshot,
} from "@/lib/comprovantes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissingComprovantesTable(message: string): boolean {
  // Só tabela ausente / cache — NÃO qualquer erro que cite o nome da tabela
  // (FK, RLS etc. também mencionam public_comprovantes e geravam falso positivo).
  return (
    /could not find the table/i.test(message) ||
    /relation ["']?public\.?public_comprovantes["']? does not exist/i.test(message) ||
    (/public_comprovantes/i.test(message) && /schema cache/i.test(message)) ||
    (/PGRST205/i.test(message) && /public_comprovantes/i.test(message))
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, success: false }, { status });
}

async function insertSnapshotOnly(
  empresaId: string,
  snapshot: ComprovanteSnapshot,
  previa: boolean
) {
  if (!isAdminConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor (Vercel → Environment Variables)."
    );
  }
  const db = createAdminClient();
  const token = gerarTokenComprovante();
  const { error } = await db.from("public_comprovantes").insert({
    token,
    empresa_id: empresaId,
    previa,
    snapshot,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    const detail = error.message || error.code || "erro desconhecido";
    if (isMissingComprovantesTable(detail)) {
      throw new Error(
        "Tabela de comprovantes não criada (ou schema cache). No Supabase → SQL Editor, rode de novo supabase/public-comprovantes.sql (tem NOTIFY no final)."
      );
    }
    throw new Error(`Falha ao gravar comprovante: ${detail}`);
  }
  return { token, url: comprovantePublicUrl(token), snapshot };
}

export async function POST(request: Request) {
  try {
    const profile = await getProfile();
    if (!profile?.empresa_id) {
      return jsonError("Não autenticado. Faça login de novo.", 401);
    }

    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return jsonError("Corpo da requisição inválido.", 400);
    }

    const visitaPontoId = String(body.visita_ponto_id ?? "").trim() || null;
    const visitaId = String(body.visita_id ?? "").trim() || null;
    const previa = body.previa === true;
    const snapshotFallback =
      body.snapshot && typeof body.snapshot === "object"
        ? (body.snapshot as ComprovanteSnapshot)
        : null;

    if (!visitaPontoId && !visitaId && !snapshotFallback) {
      return jsonError("Informe visita_ponto_id, visita_id ou snapshot.", 400);
    }

    if (!isAdminConfigured()) {
      return jsonError(
        "SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel. Sem ela o link público não funciona.",
        503
      );
    }

    const db = createAdminClient();
    let result: { token: string; url: string; snapshot: ComprovanteSnapshot };

  // Relatório completo (prévia) ou histórico (tela de coleta): grava payload com layout.
  if (
    (snapshotFallback?.layout === "relatorio" ||
      snapshotFallback?.layout === "historico") &&
    snapshotFallback.relatorio
  ) {
    result = await insertSnapshotOnly(
      profile.empresa_id,
      {
        ...snapshotFallback,
        previa: snapshotFallback.previa === true,
      },
      snapshotFallback.previa === true
    );
  } else if (visitaPontoId) {
    try {
      result = await criarComprovanteVisitaPonto(db, {
        empresaId: profile.empresa_id,
        visitaPontoId,
        previa,
        dividaSaldo: Number(body.divida_saldo) || 0,
        desconto: Number(body.desconto) || 0,
        pix: Number(body.pix) || 0,
        dinheiro: Number(body.dinheiro) || 0,
        haverSaldo: Number(body.haver_saldo) || 0,
        descontarHaver: body.descontar_haver === true,
        nomeOperacao: (body.nome_operacao as string | null) ?? null,
        chavePix: (body.chave_pix as string | null) ?? null,
        snapshotFallback,
      });
    } catch (vpErr) {
      if (visitaId) {
        result = await criarComprovanteCassino(db, {
          empresaId: profile.empresa_id,
          visitaId,
          previa,
          nomeOperacao: (body.nome_operacao as string | null) ?? null,
          chavePix: (body.chave_pix as string | null) ?? null,
          snapshotFallback,
        });
      } else if (snapshotFallback?.pontoNome) {
        result = await insertSnapshotOnly(
          profile.empresa_id,
          snapshotFallback,
          previa
        );
      } else {
        throw vpErr;
      }
    }
  } else if (visitaId) {
    result = await criarComprovanteCassino(db, {
      empresaId: profile.empresa_id,
      visitaId,
      previa,
      nomeOperacao: (body.nome_operacao as string | null) ?? null,
      chavePix: (body.chave_pix as string | null) ?? null,
      snapshotFallback,
    });
  } else {
    result = await insertSnapshotOnly(
      profile.empresa_id,
      snapshotFallback!,
      previa
    );
  }

    const mensagem = mensagemWhatsAppComLink({
      pontoNome: result.snapshot.pontoNome,
      previa: result.snapshot.previa,
      valorPago: result.snapshot.valorPago,
      restante: result.snapshot.restante,
      totalACobrar: result.snapshot.totalACobrar,
      url: result.url,
      chavePix: result.snapshot.chavePix,
      saldoNegativo: result.snapshot.saldoNegativo === true,
      prejuizo: result.snapshot.prejuizo,
      haverAbatido: result.snapshot.haverAbatido,
      haverRestante: result.snapshot.haverRestante,
      haverAnterior: result.snapshot.haverAnterior,
      totalBruto: result.snapshot.totalBruto,
      negativoAnterior: result.snapshot.negativoAnterior,
      negativoRecuperado: result.snapshot.negativoRecuperado,
      negativoRestante: result.snapshot.negativoRestante,
    });

    return NextResponse.json({
      success: true,
      token: result.token,
      url: result.url,
      mensagem,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar comprovante.";
    console.error("[api/comprovantes]", msg);
    if (isMissingComprovantesTable(msg)) {
      return jsonError(
        "Tabela de comprovantes não criada (ou schema cache). No Supabase → SQL Editor, rode de novo supabase/public-comprovantes.sql",
        503
      );
    }
    return jsonError(msg, 400);
  }
}
