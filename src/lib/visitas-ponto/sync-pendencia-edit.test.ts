import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import { sincronizarOrigemAposBaixaPendencia } from "@/lib/visitas-ponto/sync-pendencia-edit";

type Row = Record<string, unknown>;

function fakeSupabase(rows: Record<string, Row | null>) {
  const updates: { table: string; payload: Row }[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        update: (payload: Row) => {
          updates.push({ table, payload });
          rows[table] = { ...(rows[table] ?? {}), ...payload };
          return builder;
        },
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, updates, rows };
}

const base = { empresaId: "e1", coletaId: null, visitaId: null, tipo: "pagamento_pendente" };

describe("sincronizarOrigemAposBaixaPendencia", () => {
  it("baixa de 3000 na pendência da visita cassino reduz o cobrável da visita de origem", async () => {
    const visita = {
      id: "v1",
      saldo_negativo: false,
      valor_operacao_efetivo: 6438.11,
      valor_operacao: 6438.11,
      valor_pago: 0,
      restante: 6438.11,
      debito_abatido: 0,
    };
    const { client, rows } = fakeSupabase({ visitas: visita });

    await sincronizarOrigemAposBaixaPendencia(client, {
      ...base,
      visitaId: "v1",
      valorRecebidoReais: 3000,
    });

    expect(rows.visitas).toMatchObject({ valor_pago: 3000, restante: 3438.11 });
    expect(cobravelCassinoVisita(rows.visitas as typeof visita)).toBe(3438.11);
  });

  it("baixa em pendência de coleta soma em valor_pago_recebido, limitado ao saldo", async () => {
    const parcial = fakeSupabase({ coletas: { valor_a_receber: 500, valor_pago_recebido: 100 } });
    await sincronizarOrigemAposBaixaPendencia(parcial.client, {
      ...base,
      tipo: "parcial",
      coletaId: "c1",
      valorRecebidoReais: 150,
    });
    expect(parcial.rows.coletas).toMatchObject({ valor_pago_recebido: 250 });

    const excedente = fakeSupabase({ coletas: { valor_a_receber: 500, valor_pago_recebido: 100 } });
    await sincronizarOrigemAposBaixaPendencia(excedente.client, {
      ...base,
      coletaId: "c1",
      valorRecebidoReais: 1000,
    });
    expect(excedente.rows.coletas).toMatchObject({ valor_pago_recebido: 500 });
  });

  it("não mexe na origem para haver, negativo ou visita negativa", async () => {
    for (const tipo of ["haver", "negativo"]) {
      const { client, updates } = fakeSupabase({
        coletas: { valor_a_receber: 500, valor_pago_recebido: 0 },
      });
      await sincronizarOrigemAposBaixaPendencia(client, {
        ...base,
        tipo,
        coletaId: "c1",
        valorRecebidoReais: 100,
      });
      expect(updates).toHaveLength(0);
    }

    const negativa = fakeSupabase({
      visitas: { id: "v2", saldo_negativo: true, valor_pago: 0, restante: 800 },
    });
    await sincronizarOrigemAposBaixaPendencia(negativa.client, {
      ...base,
      visitaId: "v2",
      valorRecebidoReais: 100,
    });
    expect(negativa.updates).toHaveLength(0);
  });
});
