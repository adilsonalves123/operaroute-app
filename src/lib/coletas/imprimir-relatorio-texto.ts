export type FormatoImpressao = "termica" | "a4";

const PRINT_ROOT_ID = "or-print-root";
const PRINT_STYLE_ID = "or-print-style";

export const ESTILO_IMPRESSAO_TERMICA = `
  @page { size: 80mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  .or-print-body {
    margin: 0;
    padding: 8px 6px;
    background: #fff;
    color: #000;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.35;
    max-width: 80mm;
  }
  .or-print-body h1 { font-size: 14px; margin: 0 0 4px; text-align: center; font-weight: 700; }
  .or-print-body .meta { text-align: center; margin-bottom: 10px; }
  .or-print-body .meta p { margin: 0; }
  .or-print-body .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .or-print-body .maq { margin-bottom: 8px; }
  .or-print-body .maq-nome { font-weight: 700; margin-bottom: 2px; }
  .or-print-body .row { display: flex; justify-content: space-between; gap: 8px; }
  .or-print-body .row span:last-child { text-align: right; white-space: nowrap; }
  .or-print-body .sec { font-weight: 700; text-transform: uppercase; margin: 6px 0 2px; font-size: 11px; }
  .or-print-body .destaque { font-weight: 700; font-size: 13px; }
  .or-print-body .hint { font-size: 10px; text-align: right; color: #333; }
  .or-print-body .foot { text-align: center; margin-top: 10px; font-size: 10px; }
`;

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

/** @deprecated use ESTILO_IMPRESSAO_TERMICA */
export const ESTILO_IMPRESSAO_TEXTO = ESTILO_IMPRESSAO_TERMICA;

function estiloPorFormato(formato: FormatoImpressao): string {
  return formato === "a4" ? ESTILO_IMPRESSAO_A4 : ESTILO_IMPRESSAO_TERMICA;
}

function limparImpressaoOverlay() {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

/** Impressão via documento principal — funciona em iPad/Android (iframe oculto falha). */
function imprimirViaOverlay(bodyHtml: string, formato: FormatoImpressao): boolean {
  if (typeof document === "undefined") return false;

  limparImpressaoOverlay();

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.className = "or-print-body";
  root.innerHTML = bodyHtml;

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
        ${formato === "termica" ? "max-width: 80mm;" : ""}
      }
    }
    ${estiloPorFormato(formato)}
  `;

  document.head.appendChild(style);
  document.body.appendChild(root);

  const cleanup = () => limparImpressaoOverlay();

  window.addEventListener("afterprint", cleanup, { once: true });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        cleanup();
        return;
      }
      window.setTimeout(cleanup, 4000);
    });
  });

  return true;
}

/** Fallback desktop — janela/iframe auxiliar. */
function imprimirViaIframe(html: string): boolean {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let impresso = false;
  const limpar = () => {
    window.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 1500);
  };

  const disparar = () => {
    if (impresso) return;
    impresso = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    limpar();
  };

  window.setTimeout(disparar, 300);
  return true;
}

function extrairCorpoHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function montarDocumentoHtml(bodyHtml: string, titulo: string, formato: FormatoImpressao): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${titulo}</title><style>${estiloPorFormato(formato)}</style></head><body class="or-print-body">${bodyHtml}</body></html>`;
}

/** Abre diálogo de impressão — overlay no tablet, iframe como reserva. */
export function abrirJanelaImpressaoHtml(
  html: string,
  formato: FormatoImpressao = "termica"
): boolean {
  if (typeof document === "undefined") return false;

  const bodyHtml = extrairCorpoHtml(html);
  const ok = imprimirViaOverlay(bodyHtml, formato);
  if (ok) return true;

  return imprimirViaIframe(montarDocumentoHtml(bodyHtml, "Impressão", formato));
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

/** Impressão térmica ou A4 — comprovante só texto/números (sem foto). */
export function abrirImpressaoRelatorioTextoGenerico(
  opts: RelatorioImpressaoOpts & { formato?: FormatoImpressao }
): boolean {
  const formato = opts.formato ?? "termica";
  const bodyHtml = montarCorpoImpressaoRelatorio(opts);
  const titulo = `${opts.titulo} — ${opts.pontoNome}`;
  return abrirJanelaImpressaoHtml(montarDocumentoHtml(bodyHtml, titulo, formato), formato);
}
