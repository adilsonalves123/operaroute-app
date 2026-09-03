"use client";

import { useState } from "react";
import { MapPin, Navigation, Loader2, Home } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import {
  buscarEnderecoPorCep,
  formatCepDisplay,
  normalizeCep,
  type EnderecoParsed,
} from "@/lib/endereco/brasil";
import {
  capturarGpsSomente,
  forwardGeocodeViaApi,
  preencherEnderecoComGps,
  preencherEnderecoDeCoords,
  type EnderecoComGps,
} from "@/lib/endereco/geocode";
import { cn } from "@/lib/utils";

export type EnderecoFormValue = EnderecoParsed & {
  latitude: string;
  longitude: string;
};

type Props = {
  value: EnderecoFormValue;
  onChange: (next: EnderecoFormValue) => void;
};

function applyGeo(
  value: EnderecoFormValue,
  geo: EnderecoComGps,
  opts?: {
    aceitarNumero?: boolean;
    substituirCep?: boolean;
    /** Se false, não altera lat/lng já gravados */
    atualizarGps?: boolean;
  }
): EnderecoFormValue {
  const aceitarNumero = opts?.aceitarNumero === true;
  const atualizarGps = opts?.atualizarGps !== false;
  return {
    cep: opts?.substituirCep ? geo.cep || "" : geo.cep || value.cep,
    rua: geo.rua || value.rua,
    // Número do imóvel: só se explicitamente permitido (GPS quase sempre erra o nº)
    numero:
      aceitarNumero && geo.numero?.trim() ? geo.numero.trim() : value.numero,
    bairro: geo.bairro || value.bairro,
    cidade: geo.cidade || value.cidade,
    latitude:
      atualizarGps && geo.latitude != null
        ? String(Number(geo.latitude.toFixed(6)))
        : value.latitude,
    longitude:
      atualizarGps && geo.longitude != null
        ? String(Number(geo.longitude.toFixed(6)))
        : value.longitude,
  };
}

function gpsErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? Number((err as { code: number }).code)
      : null;
  if (code === 1) return "Permissão de localização negada. Ative o GPS no navegador.";
  if (code === 2 || code === 3) {
    return "Não foi possível obter o GPS. Tente de novo ao ar livre.";
  }
  return err instanceof Error ? err.message : "Falha ao obter localização.";
}

export function PontoEnderecoFields({ value, onChange }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [enderecoLoading, setEnderecoLoading] = useState(false);
  const [buscaLoading, setBuscaLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ultimaPrecisaoM, setUltimaPrecisaoM] = useState<number | null>(null);

  function patch(partial: Partial<EnderecoFormValue>) {
    onChange({ ...value, ...partial });
  }

  const temGps =
    value.latitude.trim() !== "" &&
    value.longitude.trim() !== "" &&
    Number.isFinite(Number(value.latitude)) &&
    Number.isFinite(Number(value.longitude));

  async function handleCepBlur() {
    const digits = normalizeCep(value.cep);
    if (digits.length !== 8) return;

    setCepLoading(true);
    setHint(null);
    try {
      const data = await buscarEnderecoPorCep(digits);
      if (!data) {
        setHint("CEP não encontrado.");
        return;
      }

      const next: EnderecoFormValue = {
        ...value,
        cep: formatCepDisplay(digits),
        rua: data.logradouro?.trim() || value.rua,
        bairro: data.bairro?.trim() || value.bairro,
        cidade: data.localidade?.trim()
          ? data.uf
            ? `${data.localidade.trim()} - ${data.uf}`
            : data.localidade.trim()
          : value.cidade,
      };

      // Se já tem GPS do ponto, não sobrescreve com o centro da rua (erra a latitude)
      if (temGps) {
        onChange(next);
        setHint(
          "CEP preenchido · GPS do ponto mantido · digite o número na fachada."
        );
        return;
      }

      const query = [next.rua, next.bairro, next.cidade, "Brasil"]
        .filter(Boolean)
        .join(", ");
      if (query.length > 8) {
        const geo = await forwardGeocodeViaApi(query);
        if (geo?.latitude != null && geo.longitude != null) {
          onChange(
            applyGeo(
              next,
              {
                ...geo,
                numero: "",
                rua: next.rua,
                bairro: next.bairro,
                cidade: next.cidade,
                cep: next.cep,
              },
              { aceitarNumero: false }
            )
          );
          setHint(
            "CEP preenchido · GPS aproximado da rua · digite o número na fachada."
          );
          return;
        }
      }

      onChange(next);
      setHint("CEP preenchido. Informe o número e capture o GPS no local.");
    } catch {
      setHint("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  /** Botão 1: só latitude/longitude */
  async function handleCapturarGps() {
    setGpsLoading(true);
    setHint(null);
    try {
      const gps = await capturarGpsSomente();
      setUltimaPrecisaoM(gps.accuracyM);
      onChange({
        ...value,
        latitude: String(Number(gps.latitude.toFixed(6))),
        longitude: String(Number(gps.longitude.toFixed(6))),
      });
      const prec =
        gps.accuracyM != null
          ? ` · precisão ±${Math.round(gps.accuracyM)} m`
          : "";
      const aviso =
        gps.accuracyM != null && gps.accuracyM > 40
          ? " Precisão baixa — fique na calçada e capture de novo."
          : "";
      setHint(`GPS gravado${prec}.${aviso}`);
    } catch (err) {
      setHint(gpsErrorMessage(err));
    } finally {
      setGpsLoading(false);
    }
  }

  /** Botão 2: rua/bairro/cidade/CEP a partir do GPS (nunca inventa número) */
  async function handlePreencherEndereco() {
    setEnderecoLoading(true);
    setHint(null);
    try {
      let geo: EnderecoComGps & { accuracyM?: number | null };

      if (temGps) {
        geo = await preencherEnderecoDeCoords(
          Number(value.latitude),
          Number(value.longitude),
          { incluirNumero: false }
        );
      } else {
        geo = await preencherEnderecoComGps({ incluirNumero: false });
        if (geo.accuracyM != null) setUltimaPrecisaoM(geo.accuracyM);
      }

      onChange(
        applyGeo(value, geo, {
          aceitarNumero: false,
          substituirCep: true,
          // Se já tinha GPS, mantém; se capturou agora, aplica
          atualizarGps: !temGps,
        })
      );

      if (geo.rua || geo.bairro || geo.cidade) {
        setHint(
          [
            "Endereço preenchido",
            geo.cep ? `CEP ${geo.cep}` : "confira o CEP",
            "digite o número na fachada",
          ].join(" · ")
        );
      } else {
        setHint(
          "Não achamos rua nesta coordenada. Capture o GPS ao ar livre ou preencha o CEP."
        );
      }
    } catch (err) {
      setHint(gpsErrorMessage(err));
    } finally {
      setEnderecoLoading(false);
    }
  }

  async function handleBuscaClick() {
    const q = busca.trim();
    if (q.length < 5) {
      setHint("Digite um endereço (rua, número, cidade) e toque em Preencher.");
      return;
    }
    setBuscaLoading(true);
    setHint(null);
    try {
      const geo = await forwardGeocodeViaApi(`${q}, Brasil`);
      if (!geo) {
        setHint("Endereço não encontrado. Tente com cidade ou CEP.");
        return;
      }
      const digitouNumero = /(?:,\s*|\s+)(\d{1,4}[A-Za-z]?)\b/.test(q);
      onChange(applyGeo(value, geo, { aceitarNumero: digitouNumero }));
      setHint(
        digitouNumero
          ? "Endereço preenchido pela busca."
          : "Endereço preenchido · digite o número na fachada."
      );
    } catch {
      setHint("Erro na busca. Tente novamente.");
    } finally {
      setBuscaLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3 sm:p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleCapturarGps()}
            disabled={gpsLoading || enderecoLoading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold transition",
              "bg-primary-neon text-slate-900 hover:brightness-110 disabled:opacity-60"
            )}
          >
            {gpsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {gpsLoading ? "Capturando GPS…" : "1. Capturar GPS"}
          </button>
          <button
            type="button"
            onClick={() => void handlePreencherEndereco()}
            disabled={gpsLoading || enderecoLoading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition disabled:opacity-60",
              "border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
            )}
          >
            {enderecoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Home className="h-4 w-4" />
            )}
            {enderecoLoading ? "Buscando endereço…" : "2. Preencher endereço"}
          </button>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-at-muted">
          Separe as funções: o GPS grava a posição do ponto; o endereço usa essa
          posição para rua, bairro, cidade e CEP.{" "}
          <span className="text-at-muted">
            O número do imóvel digite sempre na fachada
          </span>
          {ultimaPrecisaoM != null ? (
            <>
              {" "}
              · última precisão ±{Math.round(ultimaPrecisaoM)} m
              {ultimaPrecisaoM > 40 ? " (baixa)" : ""}
            </>
          ) : null}
          .
        </p>
        {temGps && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/90">
            <MapPin className="h-3 w-3" />
            GPS no formulário — pode preencher o endereço
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <FormInput
            label="Buscar endereço"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: Av. Paulista 1000, São Paulo"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleBuscaClick();
              }
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleBuscaClick()}
          disabled={buscaLoading}
          className="shrink-0 rounded-lg border border-at-soft px-4 py-2.5 text-[12px] font-medium text-at-primary/90 transition hover:bg-at-card-soft disabled:opacity-50 sm:mb-0.5"
        >
          {buscaLoading ? "Buscando…" : "Preencher"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="CEP"
          inputMode="numeric"
          value={value.cep}
          onChange={(e) => patch({ cep: formatCepDisplay(e.target.value) })}
          onBlur={() => void handleCepBlur()}
          hint={
            cepLoading
              ? "Buscando endereço..."
              : "Digite o CEP e saia do campo para preencher"
          }
        />
        <FormInput
          label="Número"
          value={value.numero}
          onChange={(e) => patch({ numero: e.target.value })}
          hint="Digite o da fachada — o mapa costuma errar"
        />
      </div>
      <FormInput
        label="Rua / Logradouro"
        value={value.rua}
        onChange={(e) => patch({ rua: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Bairro"
          value={value.bairro}
          onChange={(e) => patch({ bairro: e.target.value })}
        />
        <FormInput
          label="Cidade"
          value={value.cidade}
          onChange={(e) => patch({ cidade: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label="Latitude (GPS)"
          inputMode="decimal"
          value={value.latitude}
          onChange={(e) => patch({ latitude: e.target.value })}
          hint={temGps ? "GPS gravado no ponto" : "Use o botão Capturar GPS"}
        />
        <FormInput
          label="Longitude (GPS)"
          inputMode="decimal"
          value={value.longitude}
          onChange={(e) => patch({ longitude: e.target.value })}
        />
      </div>

      {hint && (
        <p
          className={cn(
            "text-[12px]",
            hint.toLowerCase().includes("não") ||
              hint.toLowerCase().includes("erro") ||
              hint.toLowerCase().includes("negada") ||
              hint.toLowerCase().includes("falha") ||
              hint.toLowerCase().includes("baixa")
              ? "text-amber-300"
              : "text-emerald-400"
          )}
          role="status"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
