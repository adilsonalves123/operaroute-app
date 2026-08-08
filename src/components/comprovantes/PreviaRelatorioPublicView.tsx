"use client";

import type { ReactNode } from "react";
import { RelatorioColetaView } from "@/components/coletas/cassino/RelatorioColetaView";
import { RelatorioFuraFuraView } from "@/components/coletas/fura-fura/RelatorioFuraFuraView";
import { RelatorioUrsinhoView } from "@/components/coletas/ursinho/RelatorioUrsinhoView";
import { RelatorioDiversaoView } from "@/components/coletas/diversao/RelatorioDiversaoView";
import { RelatorioBolinhaView } from "@/components/coletas/bolinha/RelatorioBolinhaView";
import { RelatorioConsignadoView } from "@/components/coletas/consignado/RelatorioConsignadoView";
import { ComprovantePublicView } from "@/components/comprovantes/ComprovantePublicView";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import type { RelatorioColetaData } from "@/lib/nichos/cassino/relatorio";
import type { RelatorioFuraFuraData } from "@/lib/nichos/fura-fura/relatorio";
import type { RelatorioUrsinhoData } from "@/lib/nichos/ursinho/relatorio";
import type { RelatorioDiversaoData } from "@/lib/nichos/diversao/relatorio";
import type { RelatorioBolinhaData } from "@/lib/nichos/bolinha/relatorio";
import type { RelatorioConsignadoData } from "@/lib/nichos/consignado/relatorio";

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Layout do relatório da coleta (prévia ou histórico).
 * Mesmo visual da tela de coleta / detalhe — com fotos.
 */
export function PreviaRelatorioPublicView({
  snapshot,
}: {
  snapshot: ComprovanteSnapshot;
}) {
  if (snapshot.layout !== "relatorio" || !snapshot.relatorio) {
    return <ComprovantePublicView snapshot={snapshot} />;
  }

  const raw = snapshot.relatorio;
  const nicho = snapshot.nichoModulo;
  const previa = snapshot.previa === true;

  let body: ReactNode = null;

  if (nicho === "cassino") {
    const data: RelatorioColetaData = {
      ...(raw as unknown as RelatorioColetaData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioColetaView data={data} />;
  } else if (nicho === "fura_fura") {
    const data: RelatorioFuraFuraData = {
      ...(raw as unknown as RelatorioFuraFuraData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioFuraFuraView data={data} />;
  } else if (nicho === "ursinho") {
    const data: RelatorioUrsinhoData = {
      ...(raw as unknown as RelatorioUrsinhoData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioUrsinhoView data={data} />;
  } else if (nicho === "diversao") {
    const data: RelatorioDiversaoData = {
      ...(raw as unknown as RelatorioDiversaoData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioDiversaoView data={data} />;
  } else if (nicho === "bolinha") {
    const data: RelatorioBolinhaData = {
      ...(raw as unknown as RelatorioBolinhaData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioBolinhaView data={data} />;
  } else if (nicho === "consignado") {
    const data: RelatorioConsignadoData = {
      ...(raw as unknown as RelatorioConsignadoData),
      data: asDate(raw.data),
      previa,
    };
    body = <RelatorioConsignadoView data={data} />;
  } else {
    return <ComprovantePublicView snapshot={snapshot} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md justify-center px-4 py-8">
      {body}
    </div>
  );
}
