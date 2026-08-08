"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Pause, Play, RotateCcw, Save } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import type { Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type Item = {
  id: Nicho;
  label: string;
  descricao: string;
  cover: string;
  customCover: boolean;
  pausado: boolean;
};

export function DonoNichosFotosClient({ email }: { email: string }) {
  const { theme } = useDonoTheme();
  const light = theme === "light";
  const [itens, setItens] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { label: string; descricao: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/dono/nichos-covers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar.");
      const list = (data.itens ?? []) as Item[];
      setItens(list);
      const next: Record<string, { label: string; descricao: string }> = {};
      for (const it of list) {
        next[it.id] = { label: it.label, descricao: it.descricao };
      }
      setDrafts(next);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function onFile(nicho: Nicho, file: File | undefined) {
    if (!file) return;
    setBusy(nicho);
    setErro("");
    setOkMsg("");
    try {
      const fd = new FormData();
      fd.set("nicho", nicho);
      fd.set("file", file);
      const res = await fetch("/api/dono/nichos-covers", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload falhou.");
      setOkMsg("Foto atualizada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Upload falhou.");
    } finally {
      setBusy(null);
    }
  }

  async function restaurar(nicho: Nicho) {
    setBusy(nicho);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch("/api/dono/nichos-covers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicho }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao restaurar.");
      setOkMsg("Foto padrão restaurada.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao restaurar.");
    } finally {
      setBusy(null);
    }
  }

  async function togglePausa(item: Item) {
    setBusy(item.id);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch("/api/dono/nichos-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: item.pausado ? "ativar" : "pausar",
          nicho: item.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao atualizar.");
      setOkMsg(
        item.pausado
          ? `${item.label} voltou a aparecer no app.`
          : `${item.label} pausado — não aparece no app.`
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setBusy(null);
    }
  }

  async function salvarTextos(nicho: Nicho) {
    const draft = drafts[nicho];
    if (!draft) return;
    setBusy(nicho);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch("/api/dono/nichos-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar",
          nicho,
          label: draft.label,
          descricao: draft.descricao,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar.");
      setOkMsg("Textos salvos.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white overflow-hidden"
    : "rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden";

  return (
    <DonoShell
      email={email}
      title="Fotos dos nichos"
      subtitle="Edite nome, descrição e foto. Pause para esconder o card no app dos clientes."
    >
      <div className="space-y-4">
        <p className="text-[12px] text-slate-500">
          Pausado = some do carrossel e da escolha de nichos no app. Quem já tem o
          nicho contratado continua vendo. JPEG/PNG/WebP/GIF · até 5 MB.
        </p>
        <p className="text-[12px] text-slate-500">
          SQL:{" "}
          <code className="text-[11px]">supabase/plataforma-nichos-covers.sql</code>
        </p>

        {erro && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}
        {okMsg && (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
            {okMsg}
          </p>
        )}

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {itens.map((item) => {
              const isRemote = item.cover.startsWith("http");
              const draft = drafts[item.id] ?? {
                label: item.label,
                descricao: item.descricao,
              };
              return (
                <div
                  key={item.id}
                  className={cn(card, item.pausado && "opacity-75")}
                >
                  <div className="relative aspect-[4/3] bg-slate-900">
                    {isRemote ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.cover}
                        alt={item.label}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={item.cover}
                        alt={item.label}
                        fill
                        className="object-cover"
                        sizes="320px"
                      />
                    )}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {item.pausado && (
                        <span className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                          Pausado
                        </span>
                      )}
                      {item.customCover && (
                        <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#e8d5b0]">
                          Foto custom
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500">
                        Nome
                      </label>
                      <input
                        value={draft.label}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, label: e.target.value },
                          }))
                        }
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-[13px] outline-none",
                          light
                            ? "border-stone-200 bg-stone-50 text-slate-900"
                            : "border-white/10 bg-white/[0.03] text-[#f4efe6]"
                        )}
                      />
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500">
                        Descrição
                      </label>
                      <textarea
                        value={draft.descricao}
                        rows={3}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, descricao: e.target.value },
                          }))
                        }
                        className={cn(
                          "w-full resize-y rounded-lg border px-3 py-2 text-[12px] outline-none",
                          light
                            ? "border-stone-200 bg-stone-50 text-slate-700"
                            : "border-white/10 bg-white/[0.03] text-slate-300"
                        )}
                      />
                    </div>

                    <input
                      ref={(el) => {
                        inputRefs.current[item.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        void onFile(item.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void salvarTextos(item.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-50",
                          light
                            ? "border-stone-200 hover:bg-stone-50"
                            : "border-[#c4a574]/35 bg-[#c4a574]/10 text-[#e8d5b0]"
                        )}
                      >
                        {busy === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Salvar textos
                      </button>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => inputRefs.current[item.id]?.click()}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-50",
                          light
                            ? "border-stone-200 hover:bg-stone-50"
                            : "border-white/10 text-slate-300"
                        )}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        Trocar foto
                      </button>
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => void togglePausa(item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-50",
                          item.pausado
                            ? light
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : light
                              ? "border-amber-300 bg-amber-50 text-amber-900"
                              : "border-amber-500/35 bg-amber-500/10 text-amber-100"
                        )}
                      >
                        {item.pausado ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                        {item.pausado ? "Ativar" : "Pausar"}
                      </button>
                      {item.customCover && (
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => void restaurar(item.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-50",
                            light
                              ? "border-stone-200 text-slate-600"
                              : "border-white/10 text-slate-400"
                          )}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Foto padrão
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DonoShell>
  );
}
