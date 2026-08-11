"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColetaPontoOption = {
  value: string;
  label: string;
};

type Props = {
  label?: string;
  value: string;
  onChange: (pontoId: string) => void;
  options: ColetaPontoOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  error?: string;
};

/**
 * Seletor de ponto com campo de texto — abre o teclado no celular
 * (o <select> nativo só mostra lista, sem digitar).
 */
export function ColetaPontoSearchSelect({
  label = "Ponto *",
  value,
  onChange,
  options,
  placeholder = "Digite para buscar o ponto…",
  className,
  inputClassName,
  error,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.label, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.filter((o) => o.value);
    if (!q) return list.slice(0, 40);
    return list
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 40);
  }, [options, query]);

  function escolher(opt: ColetaPontoOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    inputRef.current?.blur();
  }

  function limpar() {
    onChange("");
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-1.5", className)}>
      {label && (
        <label htmlFor="coleta-ponto-busca" className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          id="coleta-ponto-busca"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          className={cn(
            "w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 text-sm text-white placeholder:text-slate-500",
            error && "border-red-500",
            inputClassName,
            // pl/pr depois do inputClassName — evita px-3 sobrescrever e misturar ícone com o texto
            "!pl-10 !pr-10"
          )}
        />
        {(query || value) && (
          <button
            type="button"
            onClick={limpar}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
            aria-label="Limpar ponto"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <ul
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 py-1 shadow-xl"
          role="listbox"
        >
          {filtrados.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-slate-500">Nenhum ponto encontrado</li>
          ) : (
            filtrados.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(opt)}
                  className={cn(
                    "flex w-full px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800",
                    opt.value === value && "bg-slate-800/80 text-white"
                  )}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
