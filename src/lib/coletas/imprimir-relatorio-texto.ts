export type FormatoImpressao = "termica_58" | "termica_80" | "a4";

export const FORMATOS_IMPRESSAO: {
  id: FormatoImpressao;
  label: string;
  hint: string;
}[] = [
  { id: "termica_58", label: "Portátil / maquininha", hint: "58 mm" },
  { id: "termica_80", label: "Térmica balcão", hint: "80 mm" },
  { id: "a4", label: "Papel A4", hint: "Folha comum" },
];

const PRINT_ROOT_ID = "or-print-root";
const PRINT_STYLE_ID = "or-print-style";

function larguraTermica(formato: FormatoImpressao): string | null {
  if (formato === "termica_58") return "58mm";
  if (formato === "termica_80") return "80mm";
  return null;
}

function estiloTermica(largura: "58mm" | "80mm"): string {
  const fontSize = largura === "58mm" ? "10px" : "12px";
  const titulo = largura === "58mm" ? "12px" : "14px";
  return `
  @page { size: ${largura} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  .or-print-body {
    margin: 0;
    padding: ${largura === "58mm" ? "6px 4px" : "8px 6px"};
    background: #fff;
    color: #000;
    font-family: "Courier New", Courier, monospace;
    font-size: ${fontSize};
    line-height: 1.35;
    max-width: ${largura};
  }
  .or-print-body h1 { font-size: ${titulo}; margin: 0 0 4px; text-align: center; font-weight: 700; }
  .or-print-body .meta { text-align: center; margin-bottom: 10px; }
  .or-print-body .meta p { margin: 0; }
  .or-print-body .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .or-print-body .maq { margin-bottom: 8px; }
  .or-print-body .maq-nome { font-weight: 700; margin-bottom: 2px; }
  .or-print-body .row { display: flex; justify-content: space-between; gap: 6px; }
  .or-print-body .row span:last-child { text-align: right; white-space: nowrap; }
  .or-print-body .sec { font-weight: 700; text-transform: uppercase; margin: 6px 0 2px; font-size: 10px; }
  .or-print-body .destaque { font-weight: 700; font-size: ${largura === "58mm" ? "11px" : "13px"}; }
  .or-print-body .hint { font-size: 9px; text-align: right; color: #333; }
  .or-print-body .foot { text-align: center; margin-top: 10px; font-size: 9px; }
`;
}

export const ESTILO_IMPRESSAO_A4 = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  .or-print-body {
    margin: 0 auto;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13px;
    line-height: 1.55;
    max-width: 180mm;
  }
  .or-print-body h1 { font-size: 22px; margin: 0 0 10px; text-align: center; font-weight: 700; letter-spacing: 0.02em; }
  .or-print-body .meta { text-align: center; margin-bottom: 16px; color: #444; }
  .or-print-body .meta p { margin: 0 0 2px; }
  .or-print-body .sep { border: none; border-top: 1px solid #ccc; margin: 12px 0; }
  .or-print-body .maq { margin-bottom: 14px; page-break-inside: avoid; }
  .or-print-body .maq-nome { font-weight: 700; margin-bottom: 6px; font-size: 14px; }
  .or-print-body .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px dotted #eee; }
  .or-print-body .row span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .or-print-body .sec { font-weight: 700; text-transform: uppercase; margin: 14px 0 6px; font-size: 11px; letter-spacing: 0.08em; color: #555; }
  .or-print-body .destaque { font-weight: 700; font-size: 15px; }
  .or-print-body .hint { font-size: 11px; text-align: right; color: #666; margin-top: 2px; }
  .or-print-body .foot { text-align: center; margin-top: 20px; font-size: 11px; color: #888; }
`;

/** @deprecated */
export const ESTILO_IMPRESSAO_TERMICA = estiloTermica("80mm");
/** @deprecated */
export const ESTILO_IMPRESSAO_TEXTO = ESTILO_IMPRESSAO_TERMICA;

export function normalizarFormatoImpressao(
  formato?: FormatoImpressao | "termica"
): FormatoImpressao {
  if (formato === "termica" || !formato) return "termica_58";
  return formato;
}

function estiloPorFormato(formato: FormatoImpressao): string {
  if (formato === "a4") return ESTILO_IMPRESSAO_A4;
  if (formato === "termica_58") return estiloTermica("58mm");
  return estiloTermica("80mm");
}

export function limparImpressaoOverlay() {
  if (typeof document === "undefined") return;
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

/** Injeta o comprovante no documento para impressão. */
export function prepararOverlayImpressao(bodyHtml: string, formato: FormatoImpressao): void {
  limparImpressaoOverlay();

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.className = "or-print-body";
  root.innerHTML = bodyHtml;

  const largura = larguraTermica(formato);

  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
    @media screen {
      #${PRINT_ROOT_ID} { display: none !important; }
    }
    @media print {
      html, body {
        height: auto !important;
        overflow: visible !important;
        background: #fff !important;
      }
      body * { visibility: hidden !important; }
      #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * {
        visibility: visible !important;
      }
      #${PRINT_ROOT_ID} {
        display: block !important;
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        ${largura ? `max-width: ${largura};` : ""}
      }
    }
    ${estiloPorFormato(formato)}
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);
}

/**
 * Dispara window.print() — deve ser chamado de forma síncrona no handler do toque/clique
 * (Safari/iPad ignora print() após setTimeout ou requestAnimationFrame).
 */
export function dispararImpressaoSincrona(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.print();
    return true;
  } catch {
    return false;
  }
}

/** Imprime com overlay já preparado + cleanup automático. */
export function finalizarImpressaoOverlay(): boolean {
  const ok = dispararImpressaoSincrona();
  if (!ok) {
    limparImpressaoOverlay();
    return false;
  }

  const cleanup = () => limparImpressaoOverlay();
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(cleanup, 5000);
  return true;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowHtml(label: string, valor: string, destaque?: boolean): string {
  return `<div class="row${destaque ? " destaque" : ""}"><span>${esc(label)}</span><span>${esc(valor)}</span></div>`;
}

export type RelatorioImpressaoOpts = {
  titulo: string;
  empresaNome: string;
  pontoNome: string;
  dataLabel: string;
  blocos?: { titulo: string; linhas: { label: string; valor: string }[] }[];
  resumo: {
    label: string;
    valor?: string;
    secao?: boolean;
    hint?: string;
    destaque?: boolean;
  }[];
};

export function montarCorpoImpressaoRelatorio(opts: RelatorioImpressaoOpts): string {
  const partes: string[] = [];
  partes.push(`<h1>${esc(opts.titulo)}</h1>`);
  partes.push(`<div class="meta">`);
  for (const t of [opts.empresaNome, opts.pontoNome, opts.dataLabel]) {
    partes.push(`<p>${esc(t)}</p>`);
  }
  partes.push(`</div><hr class="sep" />`);

  for (const bloco of opts.blocos ?? []) {
    partes.push(`<div class="maq"><div class="maq-nome">${esc(bloco.titulo)}</div>`);
    for (const linha of bloco.linhas) {
      partes.push(rowHtml(linha.label, linha.valor));
    }
    partes.push(`</div>`);
  }

  if ((opts.blocos ?? []).length > 0) {
    partes.push(`<hr class="sep" />`);
  }

  for (const linha of opts.resumo) {
    if (linha.secao) {
      partes.push(`<div class="sec">${esc(linha.label)}</div>`);
      continue;
    }
    partes.push(rowHtml(linha.label, linha.valor ?? "", linha.destaque));
    if (linha.hint) {
      partes.push(`<div class="hint">${esc(linha.hint)}</div>`);
    }
  }

  partes.push(`<hr class="sep" /><div class="foot">OperaRout</div>`);
  return partes.join("");
}

/** Prepara overlay + imprime na mesma interação (desktop). */
export function imprimirCorpoRelatorio(bodyHtml: string, formato: FormatoImpressao): boolean {
  if (typeof document === "undefined") return false;
  prepararOverlayImpressao(bodyHtml, formato);
  return finalizarImpressaoOverlay();
}

/** Impressão térmica ou A4 — comprovante só texto/números (sem foto). */
export function abrirImpressaoRelatorioTextoGenerico(
  opts: RelatorioImpressaoOpts & { formato?: FormatoImpressao | "termica" }
): boolean {
  const formato = normalizarFormatoImpressao(opts.formato);
  const bodyHtml = montarCorpoImpressaoRelatorio(opts);
  return imprimirCorpoRelatorio(bodyHtml, formato);
}
