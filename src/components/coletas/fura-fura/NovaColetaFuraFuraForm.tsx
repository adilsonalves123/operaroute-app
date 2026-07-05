"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Navigation, Plus, Trash2 } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ColetaFuraFuraResumo } from "./ColetaFuraFuraResumo";
import { FotoColetaFuraFura } from "./FotoColetaFuraFura";
import { PontoFuraAlertas } from "./PontoFuraAlertas";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { uploadFotoFuraFura } from "@/lib/storage/coleta-fotos";
import {
  calcularColetaFuraFura,
  linksNavegacaoPonto,
  mensagemWhatsAppColeta,
  type BrindeEntregue,
} from "@/lib/nichos/fura-fura";
import type { Ponto } from "@/lib/types/database";

type PontoFura = Ponto & {
  preco_furo?: number | null;
  furos_estoque?: number | null;
  furos_minimo?: number | null;
  estoque_brindes?: { item_id?: string; nome: string; quantidade: number; custo_unitario?: number }[];
};

function whatsAppUrl(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function NovaColetaFuraFuraForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pontos, setPontos] = useState<PontoFura[]>([]);
  const [relatorioEnviado, setRelatorioEnviado] = useState(false);
  const [form, setForm] = useState({
    ponto_id: searchParams.get("ponto") ?? "",
    quantidade_furos: "",
    preco_furo: "",
    comissao_percentual: "",
    desconto: "",
    valor_pago_recebido: "",
    forma_pagamento: "dinheiro",
    brindes_repostos: "",
    brindes_restantes: "",
    observacao: "",
  });
  const [brindes, setBrindes] = useState<BrindeEntregue[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const eid = await getEmpresaIdForUser(supabase);
      if (!eid) return;
      setEmpresaId(eid);
      const { data } = await supabase
        .from("pontos")
        .select("*")
        .eq("empresa_id", eid)
        .eq("status", "ativo")
        .order("nome");
      setPontos((data as PontoFura[]) ?? []);
    }
    load();
  }, []);

  const ponto = pontos.find((p) => p.id === form.ponto_id);

  useEffect(() => {
    if (!ponto) return;
    setForm((prev) => ({
      ...prev,
      comissao_percentual: String(ponto.comissao_percentual ?? 0),
      preco_furo: String(ponto.preco_furo ?? 1),
    }));
  }, [ponto?.id]);

  const calculo = useMemo(
    () =>
      calcularColetaFuraFura({
        quantidadeFuros: Number(form.quantidade_furos) || 0,
        precoFuro: Number(form.preco_furo) || Number(ponto?.preco_furo ?? 1),
        comissaoPercentual: Number(form.comissao_percentual) || 0,
        desconto: Number(form.desconto) || 0,
        brindes,
        valorPagoRecebido: Number(form.valor_pago_recebido) || 0,
      }),
    [form, brindes, ponto]
  );

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addBrindeFromEstoque(item: NonNullable<PontoFura["estoque_brindes"]>[number]) {
    setBrindes((prev) => {
      const exists = prev.find((b) => b.item_id === item.item_id || b.nome === item.nome);
      if (exists) {
        return prev.map((b) =>
          b.nome === item.nome ? { ...b, quantidade: b.quantidade + 1 } : b
        );
      }
      return [
        ...prev,
        {
          item_id: item.item_id,
          nome: item.nome,
          quantidade: 1,
          custo_unitario: Number(item.custo_unitario ?? 0),
        },
      ];
    });
  }

  function addBrindeManual() {
    setBrindes((prev) => [
      ...prev,
      { nome: `Brinde ${prev.length + 1}`, quantidade: 1, custo_unitario: 0 },
    ]);
  }

  function handleFotoChange(file: File | null) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(file ? URL.createObjectURL(file) : null);
    setErroFoto("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ponto_id) {
      setError("Selecione um ponto.");
      return;
    }
    if (calculo.quantidadeFuros <= 0) {
      setError("Informe a quantidade de furos.");
      return;
    }
    if (!fotoFile) {
      setErroFoto("Foto obrigatória");
      setError("Tire a foto da máquina antes de registrar.");
      return;
    }
    if (!empresaId) {
      setError("Empresa não encontrada.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const fotoUrl = await uploadFotoFuraFura(supabase, empresaId, form.ponto_id, fotoFile);

      const res = await fetch("/api/coletas/fura-fura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          brindes,
          relatorio_enviado: relatorioEnviado,
          foto_url: fotoUrl,
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar coleta.");
        return;
      }
      router.push("/coletas");
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  const msgWhatsApp = ponto
    ? mensagemWhatsAppColeta(ponto.nome, calculo)
    : "";
  const waLink = whatsAppUrl(ponto?.whatsapp, msgWhatsApp);
  const navLinks = ponto ? linksNavegacaoPonto(ponto) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nova coleta</h1>
          <p className="text-sm text-slate-400">Fura-fura — furos, comissão e lucro real</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card space-y-4 p-6">
          <FormSelect
            label="Ponto *"
            value={form.ponto_id}
            onChange={(e) => update("ponto_id", e.target.value)}
            options={[
              { value: "", label: "Selecione..." },
              ...pontos.map((p) => ({ value: p.id, label: p.nome })),
            ]}
          />

          {ponto && (
            <>
              <PontoFuraAlertas ponto={ponto} />
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                <span>
                  Comissão:{" "}
                  <strong className="text-slate-300">{form.comissao_percentual || 0}%</strong>
                </span>
                {ponto.furos_estoque != null && (
                  <span>
                    Furos na máquina:{" "}
                    <strong className="text-slate-300">{ponto.furos_estoque}</strong>
                  </span>
                )}
                {gps && <span className="text-green-500/80 text-xs">GPS capturado</span>}
              </div>
              {navLinks && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={navLinks.waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-primary-neon/40 hover:text-primary-neon"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Waze
                  </a>
                  <a
                    href={navLinks.google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-primary-neon/40 hover:text-primary-neon"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Google Maps
                  </a>
                </div>
              )}
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Furos utilizados *"
              type="number"
              min={0}
              value={form.quantidade_furos}
              onChange={(e) => update("quantidade_furos", e.target.value)}
            />
            <FormInput
              label="Preço por furo (R$)"
              type="number"
              step="0.01"
              min={0}
              value={form.preco_furo}
              onChange={(e) => update("preco_furo", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Comissão do ponto (%)"
              type="number"
              step="0.01"
              value={form.comissao_percentual}
              onChange={(e) => update("comissao_percentual", e.target.value)}
            />
            <FormInput
              label="Desconto (R$)"
              type="number"
              step="0.01"
              min={0}
              value={form.desconto}
              onChange={(e) => update("desconto", e.target.value)}
            />
          </div>
        </div>

        <div className="glass-card p-6">
          <FotoColetaFuraFura
            preview={fotoPreview}
            onChange={handleFotoChange}
            erro={erroFoto}
          />
        </div>

        <div className="glass-card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Brindes entregues</h3>
            <button
              type="button"
              onClick={addBrindeManual}
              className="inline-flex items-center gap-1 text-xs text-primary-neon hover:underline"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          </div>

          {ponto?.estoque_brindes && Array.isArray(ponto.estoque_brindes) && (
            <div className="flex flex-wrap gap-2">
              {ponto.estoque_brindes
                .filter((i) => (i.quantidade ?? 0) > 0)
                .map((item) => (
                  <button
                    key={item.item_id ?? item.nome}
                    type="button"
                    onClick={() => addBrindeFromEstoque(item)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-primary-neon/40 hover:text-primary-neon"
                  >
                    + {item.nome} ({item.quantidade})
                  </button>
                ))}
            </div>
          )}

          {brindes.length === 0 ? (
            <p className="text-xs italic text-slate-600">Nenhum brinde nesta coleta.</p>
          ) : (
            <div className="space-y-2">
              {brindes.map((b, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-4 items-end">
                  <FormInput
                    label="Item"
                    value={b.nome}
                    onChange={(e) =>
                      setBrindes((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x))
                      )
                    }
                  />
                  <FormInput
                    label="Qtd"
                    type="number"
                    min={1}
                    value={String(b.quantidade)}
                    onChange={(e) =>
                      setBrindes((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, quantidade: Number(e.target.value) || 0 } : x
                        )
                      )
                    }
                  />
                  <FormInput
                    label="Custo un."
                    type="number"
                    step="0.01"
                    value={String(b.custo_unitario)}
                    onChange={(e) =>
                      setBrindes((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, custo_unitario: Number(e.target.value) || 0 } : x
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setBrindes((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Brindes repostos"
              type="number"
              value={form.brindes_repostos}
              onChange={(e) => update("brindes_repostos", e.target.value)}
            />
            <FormInput
              label="Brindes restantes"
              type="number"
              value={form.brindes_restantes}
              onChange={(e) => update("brindes_restantes", e.target.value)}
            />
          </div>
        </div>

        {calculo.quantidadeFuros > 0 && (
          <div className="glass-card p-6">
            <ColetaFuraFuraResumo calculo={calculo} />
          </div>
        )}

        <div className="glass-card space-y-4 p-6">
          <h3 className="text-sm font-medium text-slate-300">Pagamento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Valor recebido agora (R$)"
              type="number"
              step="0.01"
              min={0}
              value={form.valor_pago_recebido}
              onChange={(e) => update("valor_pago_recebido", e.target.value)}
            />
            <FormSelect
              label="Forma de recebimento"
              value={form.forma_pagamento}
              onChange={(e) => update("forma_pagamento", e.target.value)}
              options={[
                { value: "dinheiro", label: "Dinheiro" },
                { value: "pix", label: "Pix" },
                { value: "misto", label: "Misto" },
              ]}
            />
          </div>
          <p className="text-xs text-slate-500">
            Deixe zero se o ponto não pagou agora — o saldo fica pendente para cobrança depois.
          </p>
        </div>

        {waLink && calculo.quantidadeFuros > 0 && (
          <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-300">Enviar relatório no WhatsApp</p>
              <p className="text-xs text-slate-500">Recomendado antes de registrar pagamento</p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setRelatorioEnviado(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-500/20"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar relatório
            </a>
          </div>
        )}

        <FormTextarea
          label="Observação"
          value={form.observacao}
          onChange={(e) => update("observacao", e.target.value)}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar coleta"}
        </button>
      </form>

      <LoadingOverlay
        show={loading}
        messages={["Enviando foto...", "Registrando coleta...", "Atualizando estoque..."]}
      />
    </div>
  );
}
