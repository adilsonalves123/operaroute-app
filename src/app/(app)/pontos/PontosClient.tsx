"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PointCard } from "@/components/cards/PointCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormInput } from "@/components/ui/FormInput";
import type { Ponto } from "@/lib/types/database";
import { MapPin } from "lucide-react";

interface PontosClientProps {
  pontos: Ponto[];
}

export function PontosClient({ pontos }: PontosClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    return pontos.filter((p) => {
      const matchSearch =
        !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.cidade?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [pontos, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pontos / Clientes</h1>
          <p className="text-slate-400 mt-1">{pontos.length} pontos cadastrados</p>
        </div>
        <Link
          href="/pontos/novo"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" />
          Novo ponto
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            placeholder="Buscar por nome ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="retirado">Retirado</option>
          <option value="inadimplente">Inadimplente</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum ponto encontrado"
          description="Você ainda não cadastrou nenhum ponto. Cadastre seu primeiro ponto para começar sua operação."
          actionLabel="Cadastrar primeiro ponto"
          actionHref="/pontos/novo"
          icon={<MapPin className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ponto) => (
            <PointCard key={ponto.id} ponto={ponto} />
          ))}
        </div>
      )}
    </div>
  );
}
