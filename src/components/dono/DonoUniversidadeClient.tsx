"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Save,
  GraduationCap,
  Plus,
  Trash2,
} from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import {
  UNIVERSIDADE_MODULOS,
  type UniversidadeModulo,
} from "@/lib/universidade/aulas";
import type { UniversidadeAulaAdmin } from "@/lib/dono/universidade-aulas";
import { cn } from "@/lib/utils";

const MODULOS_EDIT = UNIVERSIDADE_MODULOS.filter((m) => m.id !== "todos");

export function DonoUniversidadeClient({ email }: { email: string }) {
  const { theme } = useDonoTheme();
  const light = theme === "light";

  const [aulas, setAulas] = useState<UniversidadeAulaAdmin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [duracao, setDuracao] = useState("");
  const [modulo, setModulo] = useState<UniversidadeModulo>("comecar");
  const [youtube, setYoutube] = useState("");
  const [publicado, setPublicado] = useState(true);
  const [fonte, setFonte] = useState<"banco" | "padrao">("padrao");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const selecionada = aulas.find((a) => a.id === selectedId) ?? null;

  function preencherForm(a: UniversidadeAulaAdmin) {
    setSelectedId(a.id);
    setTitulo(a.titulo);
    setDescricao(a.descricao);
    setDuracao(a.duracao);
    setModulo(a.modulo);
    setYoutube(a.youtubeId ?? "");
    setPublicado(a.publicado);
    setOk("");
    setErro("");
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/dono/universidade");
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao carregar.");
        return;
      }
      const list = (data.aulas ?? []) as UniversidadeAulaAdmin[];
      setAulas(list);
      setFonte(data.fonte === "banco" ? "banco" : "padrao");
      setSelectedId((prev) => {
        const id =
          prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? null;
        const aula = list.find((a) => a.id === id);
        if (aula) {
          setTitulo(aula.titulo);
          setDescricao(aula.descricao);
          setDuracao(aula.duracao);
          setModulo(aula.modulo);
          setYoutube(aula.youtubeId ?? "");
          setPublicado(aula.publicado);
        }
        return id;
      });
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function escolherAula(a: UniversidadeAulaAdmin) {
    preencherForm(a);
  }

  async function novaAula() {
    setCreating(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/universidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: "Nova aula", modulo: "comecar" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não criou a aula.");
        return;
      }
      setAulas((data.aulas ?? []) as UniversidadeAulaAdmin[]);
      setFonte("banco");
      if (data.aula) {
        preencherForm(data.aula as UniversidadeAulaAdmin);
        setOk("Aula criada. Preencha título, legenda e o link do YouTube.");
      }
    } catch {
      setErro("Falha de rede.");
    } finally {
      setCreating(false);
    }
  }

  async function salvar() {
    if (!selectedId) return;
    setSaving(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/universidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          titulo,
          descricao,
          duracao,
          modulo,
          youtubeUrlOrId: youtube,
          publicado,
          ordem: selecionada?.ordem,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não salvou.");
        return;
      }
      setAulas((data.aulas ?? []) as UniversidadeAulaAdmin[]);
      setFonte("banco");
      if (data.aula) preencherForm(data.aula as UniversidadeAulaAdmin);
      setOk(
        data.aula?.youtubeId
          ? "Publicado: vídeo e legenda atualizados no app."
          : "Salvo. Sem link do YouTube a aula fica como “Em breve”."
      );
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!selectedId) return;
    if (!confirm("Excluir esta aula da Universidade?")) return;
    setSaving(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/universidade", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não excluiu.");
        return;
      }
      const list = (data.aulas ?? []) as UniversidadeAulaAdmin[];
      setAulas(list);
      setFonte("banco");
      if (list[0]) preencherForm(list[0]);
      else {
        setSelectedId(null);
        setTitulo("");
        setDescricao("");
        setDuracao("");
        setYoutube("");
      }
      setOk("Aula excluída.");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DonoShell
      email={email}
      title="Universidade"
      subtitle="Publique vídeos do YouTube e edite a legenda que o cliente vê no app."
    >
      <div className="space-y-6">
        <div>
          <p
            className={cn(
              "text-sm",
              light ? "text-stone-600" : "text-stone-400"
            )}
          >
            As aulas da esquerda já vêm de exemplo. Use{" "}
            <strong className="font-medium">Nova aula</strong> para criar as
            suas, ou edite as existentes. Cliente vê em{" "}
            <a
              href="/universidade"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-2"
            >
              /universidade
              <ExternalLink className="h-3 w-3" />
            </a>
            . Fonte: {fonte === "banco" ? "banco" : "padrão do código"}.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando aulas…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div
              className={cn(
                "rounded-2xl border p-3",
                light
                  ? "border-stone-200 bg-white"
                  : "border-at-soft bg-at-card-soft"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-2">
                <p className="text-[11px] uppercase tracking-wider text-stone-500">
                  Aulas
                </p>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void novaAula()}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50",
                    light
                      ? "bg-stone-900 text-white hover:bg-stone-800"
                      : "bg-[#c9a87c]/25 text-at-link hover:bg-[#c9a87c]/35"
                  )}
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Nova aula
                </button>
              </div>
              <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
                {aulas.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => escolherAula(a)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                        selectedId === a.id
                          ? light
                            ? "bg-stone-900 text-white"
                            : "bg-[#c9a87c]/20 text-[#f4f0e8]"
                          : light
                            ? "hover:bg-stone-100"
                            : "hover:bg-at-card-soft"
                      )}
                    >
                      <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium leading-snug">
                          {a.titulo}
                        </span>
                        <span className="mt-0.5 block text-[11px] opacity-70">
                          {a.youtubeId ? "Com vídeo" : "Em breve"}
                          {!a.publicado ? " · oculta" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={cn(
                "space-y-4 rounded-2xl border p-5",
                light
                  ? "border-stone-200 bg-white"
                  : "border-at-soft bg-at-card-soft"
              )}
            >
              {!selecionada ? (
                <p className="text-sm text-stone-500">
                  Selecione uma aula ou clique em Nova aula.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-[12px] text-stone-500">Título</label>
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className={cn(
                        "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none",
                        light
                          ? "border-stone-200 bg-stone-50"
                          : "border-at-soft bg-black/30"
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-[12px] text-stone-500">
                      Legenda (texto sob o vídeo no app)
                    </label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      rows={3}
                      className={cn(
                        "mt-1 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none",
                        light
                          ? "border-stone-200 bg-stone-50"
                          : "border-at-soft bg-black/30"
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-[12px] text-stone-500">Módulo</label>
                      <select
                        value={modulo}
                        onChange={(e) =>
                          setModulo(e.target.value as UniversidadeModulo)
                        }
                        className={cn(
                          "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none",
                          light
                            ? "border-stone-200 bg-stone-50"
                            : "border-at-soft bg-black/30"
                        )}
                      >
                        {MODULOS_EDIT.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] text-stone-500">
                        Duração
                      </label>
                      <input
                        value={duracao}
                        onChange={(e) => setDuracao(e.target.value)}
                        placeholder="8 min"
                        className={cn(
                          "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none",
                          light
                            ? "border-stone-200 bg-stone-50"
                            : "border-at-soft bg-black/30"
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] text-stone-500">
                      Link ou ID do YouTube
                    </label>
                    <input
                      value={youtube}
                      onChange={(e) => setYoutube(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      className={cn(
                        "mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none",
                        light
                          ? "border-stone-200 bg-stone-50"
                          : "border-at-soft bg-black/30"
                      )}
                    />
                    <p className="mt-1.5 text-[11px] text-stone-500">
                      Cole a URL do vídeo (ou só o ID). Deixe vazio para manter
                      “Em breve”.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={publicado}
                      onChange={(e) => setPublicado(e.target.checked)}
                    />
                    Visível na Universidade do app
                  </label>

                  {erro && (
                    <p className="text-sm text-red-500" role="alert">
                      {erro}
                    </p>
                  )}
                  {ok && (
                    <p className="text-sm text-emerald-600" role="status">
                      {ok}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void salvar()}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50",
                        light
                          ? "bg-stone-900 text-white hover:bg-stone-800"
                          : "bg-[#c9a87c] text-stone-950 hover:brightness-110"
                      )}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar / publicar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void excluir()}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition disabled:opacity-50",
                        light
                          ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                          : "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DonoShell>
  );
}
