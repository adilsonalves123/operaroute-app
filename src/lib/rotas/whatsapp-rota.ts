import { linkGoogleMapsRota, type Coordenada, type ParadaRota } from "./otimizar-rota";
import type { RotaSalva } from "./rotas-salvas";

/** Normaliza telefone BR e monta link wa.me (abre app sem número se vazio). */
export function whatsAppUrlRota(telefone: string | null | undefined, mensagem: string): string {
  const msg = encodeURIComponent(mensagem);
  if (telefone) {
    const digits = telefone.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

export function montarMensagemRotaWhatsApp(opts: {
  nomeRota: string;
  cidade?: string | null;
  paradas: { ordem: number; nome: string; endereco?: string | null }[];
  mapsUrl?: string | null;
  operadorNome?: string | null;
}): string {
  const linhas: string[] = [
    `*Rota OperaRoute*`,
    opts.nomeRota,
  ];
  if (opts.cidade) linhas.push(`📍 ${opts.cidade}`);
  if (opts.operadorNome) linhas.push(`👤 ${opts.operadorNome}`);
  linhas.push("", `*Paradas (${opts.paradas.length}):*`);

  for (const p of opts.paradas.slice(0, 40)) {
    const end = p.endereco?.trim();
    linhas.push(end ? `${p.ordem}. ${p.nome} — ${end}` : `${p.ordem}. ${p.nome}`);
  }
  if (opts.paradas.length > 40) {
    linhas.push(`… e mais ${opts.paradas.length - 40} paradas`);
  }

  if (opts.mapsUrl) {
    linhas.push("", "🗺️ Abrir no Maps:", opts.mapsUrl);
  }

  linhas.push("", "A rota também está no app → Rotas → Minha rota.");
  return linhas.join("\n");
}

export function mensagemWhatsAppDeRotaSalva(
  rota: RotaSalva,
  pontosPorId: Map<string, { nome: string; endereco?: string | null }>,
  inicio: Coordenada | null = null,
  paradasGeo?: ParadaRota[]
): { texto: string; mapsUrl: string | null } {
  const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
  const lista = ordenadas.map((p) => {
    const info = pontosPorId.get(p.ponto_id);
    return {
      ordem: p.ordem,
      nome: info?.nome ?? "Ponto",
      endereco: info?.endereco ?? null,
    };
  });

  const mapsUrl =
    paradasGeo && paradasGeo.length > 0
      ? linkGoogleMapsRota(
          paradasGeo.filter((p) => !p.statusParada || p.statusParada === "pendente"),
          inicio
        )
      : null;

  return {
    texto: montarMensagemRotaWhatsApp({
      nomeRota: rota.nome,
      cidade: rota.cidade,
      paradas: lista,
      mapsUrl,
      operadorNome: rota.operador_nome,
    }),
    mapsUrl,
  };
}
