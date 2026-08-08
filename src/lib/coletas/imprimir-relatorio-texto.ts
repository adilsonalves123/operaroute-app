/** Abre HTML de impressão (só texto) de forma confiável — iframe evita página em branco / pop-up bloqueado. */
export function abrirJanelaImpressaoHtml(html: string): boolean {
  if (typeof document === "undefined") return false;

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

  // Aguarda o layout do documento no iframe.
  window.setTimeout(disparar, 250);
  return true;
}

export const ESTILO_IMPRESSAO_TEXTO = `
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    background: #fff;
    color: #000;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    line-height: 1.35;
    max-width: 80mm;
  }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; font-weight: 700; }
  .meta { text-align: center; margin-bottom: 10px; }
  .meta p { margin: 0; }
  .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .maq { margin-bottom: 8px; }
  .maq-nome { font-weight: 700; margin-bottom: 2px; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:last-child { text-align: right; white-space: nowrap; }
  .sec { font-weight: 700; text-transform: uppercase; margin: 6px 0 2px; font-size: 11px; }
  .destaque { font-weight: 700; font-size: 13px; }
  .hint { font-size: 10px; text-align: right; color: #333; }
  .foot { text-align: center; margin-top: 10px; font-size: 10px; }
  @media print {
    body { padding: 0; max-width: none; }
  }
`;

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

/** Impressão térmica / papel — mesmo padrão do Cassino, genérico por nicho. */
export function abrirImpressaoRelatorioTextoGenerico(opts: {
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
}): boolean {
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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(opts.titulo)} — ${esc(opts.pontoNome)}</title><style>${ESTILO_IMPRESSAO_TEXTO}</style></head><body>${partes.join("")}</body></html>`;
  return abrirJanelaImpressaoHtml(html);
}
