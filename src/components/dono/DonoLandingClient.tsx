"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import {
  iniciais,
  MAX_DEPOIMENTOS,
  MAX_TEXTO_DEPOIMENTO,
  PROVA_SOCIAL_VAZIA,
  resolverVideo,
  type Depoimento,
  type ProvaSocial,
} from "@/lib/marketing/prova-social";
import { cn } from "@/lib/utils";

function novoDepoimento(): Depoimento {
  return {
    id: `dep-${Date.now().toString(36)}`,
    nome: "",
    operacao: "",
    cidade: "",
    texto: "",
    foto_url: null,
    ativo: true,
  };
}

export function DonoLandingClient({ email }: { email: string }) {
  const { theme } = useDonoTheme();
  const light = theme === "light";

  const [prova, setProva] = useState<ProvaSocial>(PROVA_SOCIAL_VAZIA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/dono/landing")
      .then(async (res) => {
        const data = await res.json();
        if (!vivo) return;
        if (!res.ok) setErro(data.error ?? "Falha ao carregar.");
        else setProva(data.prova ?? PROVA_SOCIAL_VAZIA);
      })
      .catch(() => {
        if (vivo) setErro("Falha de rede.");
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function alterar(parcial: Partial<ProvaSocial>) {
    setProva((p) => ({ ...p, ...parcial }));
    setOk("");
  }

  function alterarDepoimento(id: string, parcial: Partial<Depoimento>) {
    setProva((p) => ({
      ...p,
      depoimentos: p.depoimentos.map((d) => (d.id === id ? { ...d, ...parcial } : d)),
    }));
    setOk("");
  }

  function mover(id: string, direcao: -1 | 1) {
    setProva((p) => {
      const lista = [...p.depoimentos];
      const i = lista.findIndex((d) => d.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= lista.length) return p;
      [lista[i], lista[j]] = [lista[j]!, lista[i]!];
      return { ...p, depoimentos: lista };
    });
    setOk("");
  }

  async function enviarFoto(id: string, file: File) {
    setEnviandoFoto(id);
    setErro("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/dono/landing", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao enviar a foto.");
        return;
      }
      alterarDepoimento(id, { foto_url: data.url });
    } catch {
      setErro("Falha de rede ao enviar a foto.");
    } finally {
      setEnviandoFoto(null);
    }
  }

  async function salvar() {
    setSaving(true);
    setErro("");
    setOk("");
    try {
      const res = await fetch("/api/dono/landing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prova }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não salvou.");
        return;
      }
      setProva(data.prova);
      setOk("Salvo. A landing já mostra a versão nova.");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSaving(false);
    }
  }

  const videoValido = prova.video_url ? resolverVideo(prova.video_url) : null;
  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-at bg-white/[0.02] p-5";
  const inputCls = light
    ? "w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] outline-none focus:border-stone-400"
    : "w-full rounded-lg border border-at-soft bg-at-card-soft px-3 py-2 text-[13px] outline-none focus:border-[#c4a574]/40";
  const botao = cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] disabled:opacity-40",
    light ? "border-stone-200" : "border-at-soft"
  );

  return (
    <DonoShell
      email={email}
      title="Landing"
      subtitle="Vídeo e depoimentos da página inicial. Seção vazia não aparece para o visitante."
    >
      {loading && (
        <div className="flex items-center gap-2 text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}
      {erro && (
        <p className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600">
          {erro}
        </p>
      )}
      {ok && (
        <p className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">
          {ok}
        </p>
      )}

      {!loading && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void salvar()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50",
                light
                  ? "bg-stone-900 text-white"
                  : "border border-[#c4a574]/40 bg-[#c4a574]/15 text-at-link"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
            <a href="/" target="_blank" rel="noopener noreferrer" className={botao}>
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir landing
            </a>
          </div>

          <div className={card}>
            <p className="text-[14px] font-medium">Vídeo</p>
            <p className="mt-1 text-[12px] text-at-muted">
              Link do YouTube (pode ser &quot;não listado&quot;), do Vimeo ou de um arquivo .mp4.
              Aparece logo abaixo da faixa de nichos.
            </p>
            <input
              value={prova.video_url ?? ""}
              onChange={(e) => alterar({ video_url: e.target.value || null })}
              placeholder="https://www.youtube.com/watch?v=..."
              className={cn(inputCls, "mt-3")}
            />
            {prova.video_url && !videoValido && (
              <p className="mt-1 text-[12px] text-rose-500">
                Link não reconhecido. Use YouTube, Vimeo ou um .mp4 com https.
              </p>
            )}
            <input
              value={prova.video_titulo}
              onChange={(e) => alterar({ video_titulo: e.target.value })}
              placeholder="Título (opcional): Uma coleta do começo ao fim, no celular."
              className={cn(inputCls, "mt-2")}
            />
            {videoValido && (
              <div className="mt-3 aspect-video max-w-md overflow-hidden rounded-xl bg-black">
                {videoValido.tipo === "embed" ? (
                  <iframe
                    src={videoValido.src}
                    title="Prévia do vídeo"
                    className="h-full w-full"
                    allowFullScreen
                  />
                ) : (
                  <video src={videoValido.src} controls className="h-full w-full" />
                )}
              </div>
            )}
          </div>

          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-medium">Depoimentos</p>
                <p className="mt-1 text-[12px] text-at-muted">
                  Use só depoimentos reais, com autorização do cliente. Até {MAX_DEPOIMENTOS}.
                  Desmarque &quot;Mostrar&quot; para esconder sem apagar.
                </p>
              </div>
              <button
                type="button"
                disabled={prova.depoimentos.length >= MAX_DEPOIMENTOS}
                onClick={() =>
                  alterar({ depoimentos: [...prova.depoimentos, novoDepoimento()] })
                }
                className={botao}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>

            {prova.depoimentos.length === 0 && (
              <p className="mt-4 text-[13px] text-at-muted">
                Nenhum depoimento ainda — a seção fica escondida na landing.
              </p>
            )}

            <div className="mt-4 space-y-4">
              {prova.depoimentos.map((d, i) => (
                <div
                  key={d.id}
                  className={cn(
                    "rounded-xl border p-4",
                    light ? "border-stone-200" : "border-at-soft",
                    !d.ativo && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {d.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.foto_url}
                        alt={d.nome}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-at-soft text-[13px] font-semibold">
                        {iniciais(d.nome)}
                      </span>
                    )}
                    <div className="grid flex-1 gap-2 sm:grid-cols-3">
                      <input
                        value={d.nome}
                        onChange={(e) => alterarDepoimento(d.id, { nome: e.target.value })}
                        placeholder="Nome"
                        className={inputCls}
                      />
                      <input
                        value={d.operacao}
                        onChange={(e) => alterarDepoimento(d.id, { operacao: e.target.value })}
                        placeholder="Operação (opcional)"
                        className={inputCls}
                      />
                      <input
                        value={d.cidade}
                        onChange={(e) => alterarDepoimento(d.id, { cidade: e.target.value })}
                        placeholder="Cidade/UF (opcional)"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <textarea
                    value={d.texto}
                    onChange={(e) => alterarDepoimento(d.id, { texto: e.target.value })}
                    maxLength={MAX_TEXTO_DEPOIMENTO}
                    rows={3}
                    placeholder="O que o cliente disse"
                    className={cn(inputCls, "mt-3")}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] text-at-muted">
                      <input
                        type="checkbox"
                        checked={d.ativo}
                        onChange={(e) => alterarDepoimento(d.id, { ativo: e.target.checked })}
                      />
                      Mostrar
                    </label>
                    <label className={cn(botao, "cursor-pointer")}>
                      {enviandoFoto === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Foto
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={enviandoFoto !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void enviarFoto(d.id, file);
                        }}
                      />
                    </label>
                    {d.foto_url && (
                      <button
                        type="button"
                        onClick={() => alterarDepoimento(d.id, { foto_url: null })}
                        className={botao}
                      >
                        Tirar foto
                      </button>
                    )}
                    <span className="ml-auto text-[11px] text-at-muted tabular-nums">
                      {d.texto.length}/{MAX_TEXTO_DEPOIMENTO}
                    </span>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => mover(d.id, -1)}
                      className={botao}
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={i === prova.depoimentos.length - 1}
                      onClick={() => mover(d.id, 1)}
                      className={botao}
                      aria-label="Descer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        alterar({
                          depoimentos: prova.depoimentos.filter((x) => x.id !== d.id),
                        })
                      }
                      className={cn(botao, "text-rose-500")}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DonoShell>
  );
}
