"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardList,
  Gamepad2,
  Store,
  ToyBrick,
  Wallet,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { VisitaPontoNicho, VisitaPontoResumo } from "@/lib/visitas-ponto/types";
import { buildColetaUrl } from "@/lib/visitas-ponto";

const NICHO_META: {
  id: VisitaPontoNicho;
  label: string;
  icon: typeof Building2;
}[] = [
  { id: "cassino", label: "Cassino", icon: Building2 },
  { id: "ursinho", label: "Ursinho", icon: ToyBrick },
  { id: "fura_fura", label: "Fura-fura", icon: CircleDot },
  { id: "diversao", label: "Diversão", icon: Gamepad2 },
  { id: "bolinha", label: "Bolinha", icon: Circle },
  { id: "consignado", label: "Consignado", icon: Store },
];

export type VisitaPontoNavActive = VisitaPontoNicho | "hub" | "cobrar";

type Props = {
  visitaPontoId: string;
  pontoId?: string;
  nichosDisponiveis?: VisitaPontoNicho[];
  nichosFeitos?: VisitaPontoNicho[];
  active: VisitaPontoNavActive;
  pontoNome?: string;
  subtotalCobravel?: number;
  className?: string;
};

export function VisitaPontoNav({
  visitaPontoId,
  pontoId: pontoIdProp,
  nichosDisponiveis: nichosProp,
  nichosFeitos: feitosProp,
  active,
  pontoNome: nomeProp,
  subtotalCobravel: subtotalProp,
  className,
}: Props) {
  const router = useRouter();
  const [resumo, setResumo] = useState<VisitaPontoResumo | null>(null);
  const [nichosDisponiveis, setNichosDisponiveis] = useState<VisitaPontoNicho[]>(
    nichosProp ?? []
  );
  const needsFetch = !pontoIdProp || !nichosProp;

  useEffect(() => {
    if (nichosProp) setNichosDisponiveis(nichosProp);
  }, [nichosProp]);

  useEffect(() => {
    if (!needsFetch || !visitaPontoId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/visitas-ponto/${visitaPontoId}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setResumo(data.resumo ?? null);
        if (Array.isArray(data.nichosDisponiveis)) {
          setNichosDisponiveis(data.nichosDisponiveis);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitaPontoId, needsFetch]);

  const pontoId = pontoIdProp || resumo?.pontoId || "";
  const pontoNome = nomeProp ?? resumo?.pontoNome;
  const subtotal = subtotalProp ?? resumo?.subtotalCobravel ?? 0;
  const feitos = new Set(
    feitosProp ?? resumo?.nichos.map((n) => n.nicho) ?? []
  );
  if (!feitosProp && resumo?.cassinoNegativo) {
    feitos.add("cassino");
  }

  if (!pontoId && !resumo) {
    return (
      <div
        className={cn(
          "rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-500",
          className
        )}
      >
        Carregando visita…
      </div>
    );
  }

  // Sem lista de nichos ainda (ou vazia após fetch): não inventa abas
  if (nichosDisponiveis.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-500",
          className
        )}
      >
        Carregando nichos…
      </div>
    );
  }

  const nichos = NICHO_META.filter((n) => nichosDisponiveis.includes(n.id));
  const cobrarHref = `/visitas-ponto/${visitaPontoId}/resumo`;
  const hubHref = `/visitas-ponto/${visitaPontoId}`;
  const itensFeitos = feitos.size;

  function goColeta(nichoId: VisitaPontoNicho, e: MouseEvent<HTMLAnchorElement>) {
    if (!pontoId) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const nichoResumo = resumo?.nichos.find((n) => n.nicho === nichoId);
    const href =
      nichoResumo?.href && feitos.has(nichoId)
        ? nichoResumo.href
        : buildColetaUrl(nichoId, pontoId, visitaPontoId);
    router.push(href);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {(pontoNome || subtotal > 0.009) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          {pontoNome && (
            <Link href={hubHref} className="hover:text-primary-neon">
              Visita · {pontoNome}
            </Link>
          )}
          {subtotal > 0.009 && (
            <span className="tabular-nums text-amber-300/90">
              Acumulado {formatCurrency(subtotal)} · ainda não pago
            </span>
          )}
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {nichos.map((nicho) => {
          const Icon = nicho.icon;
          const feito = feitos.has(nicho.id);
          const isActive = active === nicho.id;
          const nichoResumo = resumo?.nichos.find((n) => n.nicho === nicho.id);
          const href = pontoId
            ? feito && nichoResumo?.href
              ? nichoResumo.href
              : buildColetaUrl(nicho.id, pontoId, visitaPontoId)
            : hubHref;
          return (
            <Link
              key={nicho.id}
              href={href}
              onClick={(e) => goColeta(nicho.id, e)}
              aria-disabled={!pontoId}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "border-primary-neon/50 bg-primary-neon/10 text-primary-neon"
                  : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20",
                feito && !isActive && "border-green-500/25",
                !pontoId && "pointer-events-none opacity-50"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {nicho.label}
              {feito && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
            </Link>
          );
        })}

        <Link
          href={cobrarHref}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition",
            active === "cobrar"
              ? "border-primary-neon bg-primary-neon text-black"
              : itensFeitos > 0
                ? "border-primary-neon/40 bg-primary-neon/10 text-primary-neon hover:bg-primary-neon/20"
                : "pointer-events-none border-slate-800 bg-slate-900/40 text-slate-600"
          )}
        >
          <Wallet className="h-3.5 w-3.5" />
          Cobrar
          {itensFeitos > 0 && active !== "cobrar" && (
            <ClipboardList className="h-3.5 w-3.5 opacity-70" />
          )}
        </Link>
      </nav>
    </div>
  );
}
