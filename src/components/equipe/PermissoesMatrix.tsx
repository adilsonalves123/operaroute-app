"use client";

import {
  ACAO_LABELS,
  GRUPO_MODULO_LABELS,
  MODULO_LABELS,
  MODULO_PERMISSAO_META,
  MODULOS_POR_GRUPO,
  aplicarGerenciarRotas,
  moduloTemGerenciarRotas,
  permissoesPadraoRole,
  type MatrizAcaoUi,
  type PermissaoAcao,
  type PermissaoModulo,
  type PermissoesResolvidas,
} from "@/lib/equipe/permissions";
import type { UserRole } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

type Props = {
  role: UserRole;
  value: PermissoesResolvidas;
  onChange: (next: PermissoesResolvidas) => void;
  personalizado: boolean;
  onPersonalizadoChange: (v: boolean) => void;
  disabled?: boolean;
};

function labelAcaoUi(acao: MatrizAcaoUi): string {
  if (acao === "gerenciar") return "Gerenciar";
  return ACAO_LABELS[acao];
}

export function PermissoesMatrix({
  role,
  value,
  onChange,
  personalizado,
  onPersonalizadoChange,
  disabled,
}: Props) {
  const editavel = personalizado && !disabled;

  function setAcao(modulo: PermissaoModulo, acao: MatrizAcaoUi, ligado: boolean) {
    if (!editavel) return;

    if (acao === "gerenciar") {
      onChange({
        ...value,
        [modulo]: aplicarGerenciarRotas(value[modulo], ligado),
      });
      return;
    }

    const nextMod = { ...value[modulo], [acao]: ligado };
    if (ligado && acao !== "ver") {
      nextMod.ver = true;
    }
    if (!ligado && acao === "ver") {
      nextMod.criar = false;
      nextMod.editar = false;
      nextMod.excluir = false;
    }
    // Config: só ver + editar — limpa criar/excluir sempre
    if (modulo === "configuracoes") {
      nextMod.criar = false;
      nextMod.excluir = false;
    }
    onChange({ ...value, [modulo]: nextMod });
  }

  function checked(modulo: PermissaoModulo, acao: MatrizAcaoUi): boolean {
    if (acao === "gerenciar") return moduloTemGerenciarRotas(value[modulo]);
    return value[modulo][acao as PermissaoAcao];
  }

  function restaurarPadrao() {
    onChange(permissoesPadraoRole(role));
    onPersonalizadoChange(false);
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Permissões de acesso</h3>
          <p className="text-xs text-at-muted mt-0.5 max-w-lg">
            <strong className="text-at-primary/85">Ver</strong> controla o menu. Nas áreas de campo,
            Criar/Editar liberam ações do dia a dia. Em Rotas,{" "}
            <strong className="text-at-primary/85">Gerenciar</strong> é montar e enviar para a equipe.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-at-primary/85 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={personalizado}
            disabled={disabled}
            onChange={(e) => {
              const ativo = e.target.checked;
              onPersonalizadoChange(ativo);
              if (!ativo) onChange(permissoesPadraoRole(role));
            }}
            className="rounded border-slate-600"
          />
          Personalizar
        </label>
      </div>

      <div className="space-y-5">
        {MODULOS_POR_GRUPO.map((grupo) => (
          <section key={grupo.id} className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-at-muted">
              {GRUPO_MODULO_LABELS[grupo.id]}
            </h4>
            <ul className="divide-y divide-slate-800/80 rounded-lg border border-slate-800/80 overflow-hidden">
              {grupo.modulos.map((modulo) => {
                const meta = MODULO_PERMISSAO_META[modulo];
                return (
                  <li
                    key={modulo}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between gap-x-4 px-3 py-2.5 bg-slate-950/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-at-primary/90">{MODULO_LABELS[modulo]}</p>
                      {meta.dica && (
                        <p className="text-[11px] text-at-muted mt-0.5 leading-snug">{meta.dica}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
                      {meta.acoesUi.map((acao) => (
                        <label
                          key={acao}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[11px] text-at-muted",
                            editavel ? "cursor-pointer" : "cursor-default opacity-70"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked(modulo, acao)}
                            disabled={!editavel}
                            onChange={(e) => setAcao(modulo, acao, e.target.checked)}
                            className="rounded border-slate-600"
                          />
                          {labelAcaoUi(acao)}
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {personalizado && !disabled && (
        <button
          type="button"
          onClick={restaurarPadrao}
          className="inline-flex items-center gap-1.5 text-xs text-at-muted hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar padrão da função
        </button>
      )}
    </div>
  );
}
