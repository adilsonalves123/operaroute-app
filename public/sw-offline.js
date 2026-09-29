/* OperaRoute — modo campo sem internet (carregado por sw-push.js via importScripts).
 *
 * Regra de ouro: com internet, toda requisição vai para a rede e a resposta volta intacta.
 * O que fica guardado no celular só é usado quando a rede falha.
 *
 * Nomes de cache e do banco precisam bater com src/lib/offline/campo-db.ts.
 */
(function (root) {
  "use strict";

  var ATIVO = true;

  var PREFIXO_CACHE = "or-campo-";
  var CACHE_PAGINAS = "or-campo-paginas-v1";
  var CACHE_ESTATICOS = "or-campo-estaticos-v1";
  var CACHE_DADOS = "or-campo-dados-v1";
  var CACHES_ATUAIS = [CACHE_PAGINAS, CACHE_ESTATICOS, CACHE_DADOS];
  var LIMITE_ENTRADAS = {};
  LIMITE_ENTRADAS[CACHE_PAGINAS] = 80;
  LIMITE_ENTRADAS[CACHE_ESTATICOS] = 800;
  LIMITE_ENTRADAS[CACHE_DADOS] = 500;

  var DB_NOME = "operaroute-campo";
  var DB_VERSAO = 1;
  var STORE_TABELAS = "tabelas";
  var STORE_META = "meta";

  var HEADER_SALVO_EM = "x-or-salvo-em";
  var PAGINA_OFFLINE = "/campo-offline";

  /** Tabelas lidas pelos formulários de coleta — só estas ganham cópia no celular. */
  var TABELAS_CAMPO = {
    pontos: true,
    equipamentos: true,
    pendencias: true,
    empresas: true,
    profiles: true,
    produtos_consignados: true,
    estoque: true,
    financeiro: true,
  };

  var PAGINAS_FORA = [
    "/api",
    "/auth",
    "/login",
    "/cadastro",
    "/esqueci-senha",
    "/redefinir-senha",
    "/dono",
    "/pesquisa",
    "/configuracao",
    "/termos",
    "/privacidade",
    "/suporte-contato",
    "/parceiro",
    "/downloads",
    "/c/",
    "/r/",
    "/_next",
  ];

  var IDENT = /^[a-z_][a-z0-9_]*$/;
  var OPERADORES = {
    eq: true,
    neq: true,
    gt: true,
    gte: true,
    lt: true,
    lte: true,
    like: true,
    ilike: true,
    is: true,
    in: true,
  };

  /* ───────────── Leitura de consultas do Supabase (PostgREST) ───────────── */

  function separarLista(bruto) {
    var itens = [];
    var atual = "";
    var aspas = false;
    for (var i = 0; i < bruto.length; i++) {
      var ch = bruto[i];
      if (ch === '"') {
        aspas = !aspas;
        continue;
      }
      if (ch === "\\" && aspas && i + 1 < bruto.length) {
        atual += bruto[++i];
        continue;
      }
      if (ch === "," && !aspas) {
        itens.push(atual);
        atual = "";
        continue;
      }
      atual += ch;
    }
    itens.push(atual);
    return itens;
  }

  function lerFiltro(coluna, valor) {
    if (!IDENT.test(coluna)) return null;
    var negar = false;
    var resto = valor;
    if (resto.indexOf("not.") === 0) {
      negar = true;
      resto = resto.slice(4);
    }
    var ponto = resto.indexOf(".");
    if (ponto <= 0) return null;
    var op = resto.slice(0, ponto);
    var alvo = resto.slice(ponto + 1);
    if (!OPERADORES[op]) return null;
    if (op === "in") {
      if (alvo.charAt(0) !== "(" || alvo.charAt(alvo.length - 1) !== ")") return null;
      var dentro = alvo.slice(1, -1);
      return { coluna: coluna, op: op, negar: negar, valor: dentro === "" ? [] : separarLista(dentro) };
    }
    if (op === "is" && !/^(null|true|false)$/.test(alvo)) return null;
    return { coluna: coluna, op: op, negar: negar, valor: alvo };
  }

  /**
   * Transforma a URL de um GET /rest/v1/<tabela> em uma consulta que dá para responder
   * com os dados guardados. Retorna null quando a consulta usa algo que não sabemos repetir
   * (or/and, relacionamentos, JSON, rpc…).
   */
  function interpretarConsultaRest(urlTexto, accept) {
    var url;
    try {
      url = new URL(urlTexto);
    } catch {
      return null;
    }
    var m = /^\/rest\/v1\/([^/]+)$/.exec(url.pathname);
    if (!m || !IDENT.test(m[1])) return null;

    var consulta = {
      tabela: m[1],
      colunas: null,
      filtros: [],
      ordem: [],
      limite: null,
      offset: 0,
      objeto: String(accept || "").indexOf("application/vnd.pgrst.object+json") !== -1,
    };

    var ok = true;
    url.searchParams.forEach(function (valor, chave) {
      if (!ok) return;
      if (chave === "select") {
        if (valor === "*" || valor === "") return;
        var cols = valor.split(",");
        for (var i = 0; i < cols.length; i++) {
          if (!IDENT.test(cols[i])) {
            ok = false;
            return;
          }
        }
        consulta.colunas = cols;
        return;
      }
      if (chave === "order") {
        var partes = valor.split(",");
        for (var j = 0; j < partes.length; j++) {
          var p = partes[j].split(".");
          if (!IDENT.test(p[0])) {
            ok = false;
            return;
          }
          var desc = false;
          var nullsFirst = null;
          for (var k = 1; k < p.length; k++) {
            if (p[k] === "desc") desc = true;
            else if (p[k] === "asc") desc = false;
            else if (p[k] === "nullsfirst") nullsFirst = true;
            else if (p[k] === "nullslast") nullsFirst = false;
            else {
              ok = false;
              return;
            }
          }
          consulta.ordem.push({ coluna: p[0], desc: desc, nullsFirst: nullsFirst === null ? desc : nullsFirst });
        }
        return;
      }
      if (chave === "limit" || chave === "offset") {
        if (!/^\d+$/.test(valor)) {
          ok = false;
          return;
        }
        if (chave === "limit") consulta.limite = Number(valor);
        else consulta.offset = Number(valor);
        return;
      }
      var filtro = lerFiltro(chave, valor);
      if (!filtro) {
        ok = false;
        return;
      }
      consulta.filtros.push(filtro);
    });

    return ok ? consulta : null;
  }

  function vazio(v) {
    return v === null || v === undefined;
  }

  function pareceData(texto) {
    return /^\d{4}-\d{2}-\d{2}/.test(texto);
  }

  function igual(v, alvo) {
    if (vazio(v)) return false;
    if (typeof v === "number") return alvo.trim() !== "" && Number(alvo) === v;
    if (typeof v === "boolean") return String(v) === alvo;
    if (typeof v === "string") {
      if (v === alvo) return true;
      if (pareceData(v) && pareceData(alvo)) {
        var a = Date.parse(v);
        var b = Date.parse(alvo);
        return !isNaN(a) && a === b;
      }
      return false;
    }
    return false;
  }

  function comparar(v, alvo) {
    if (typeof v === "number") return v - Number(alvo);
    var texto = String(v);
    if (pareceData(texto) && pareceData(alvo)) {
      var a = Date.parse(texto);
      var b = Date.parse(alvo);
      if (!isNaN(a) && !isNaN(b)) return a - b;
    }
    return texto < alvo ? -1 : texto > alvo ? 1 : 0;
  }

  function padraoLike(padrao, semCaixa) {
    var re = "";
    for (var i = 0; i < padrao.length; i++) {
      var ch = padrao[i];
      if (ch === "*" || ch === "%") re += ".*";
      else if (ch === "_") re += ".";
      else re += ch.replace(/[.+?^${}()|[\]\\/-]/g, "\\$&");
    }
    return new RegExp("^" + re + "$", semCaixa ? "is" : "s");
  }

  function linhaPassa(linha, filtro) {
    var v = linha[filtro.coluna];
    var r;
    if (filtro.op === "is") {
      if (filtro.valor === "null") r = vazio(v);
      else r = v === (filtro.valor === "true");
      return filtro.negar ? !r : r;
    }
    if (vazio(v)) return false;
    switch (filtro.op) {
      case "eq":
        r = igual(v, filtro.valor);
        break;
      case "neq":
        r = !igual(v, filtro.valor);
        break;
      case "gt":
        r = comparar(v, filtro.valor) > 0;
        break;
      case "gte":
        r = comparar(v, filtro.valor) >= 0;
        break;
      case "lt":
        r = comparar(v, filtro.valor) < 0;
        break;
      case "lte":
        r = comparar(v, filtro.valor) <= 0;
        break;
      case "like":
      case "ilike":
        r = padraoLike(filtro.valor, filtro.op === "ilike").test(String(v));
        break;
      case "in":
        r = filtro.valor.some(function (item) {
          return igual(v, item);
        });
        break;
      default:
        return false;
    }
    return filtro.negar ? !r : r;
  }

  function ordenarValores(a, b) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
    var ta = String(a);
    var tb = String(b);
    if (pareceData(ta) && pareceData(tb)) {
      var da = Date.parse(ta);
      var db = Date.parse(tb);
      if (!isNaN(da) && !isNaN(db)) return da - db;
    }
    return ta.localeCompare(tb, "pt-BR", { sensitivity: "base" });
  }

  /**
   * Os dados guardados só respondem a consulta quando cobrem tudo que ela pediria ao servidor.
   * escopo.obrigatorios: filtros usados para baixar (ex.: pendências só "aberta").
   * escopo.chaves: a consulta precisa filtrar por uma destas colunas (ex.: profiles.user_id).
   */
  function consultaCoberta(consulta, escopo) {
    if (!escopo) return true;
    var obrig = escopo.obrigatorios || {};
    for (var col in obrig) {
      if (!Object.prototype.hasOwnProperty.call(obrig, col)) continue;
      var achou = consulta.filtros.some(function (f) {
        return f.coluna === col && !f.negar && f.op === "eq" && f.valor === String(obrig[col]);
      });
      if (!achou) return false;
    }
    if (escopo.chaves && escopo.chaves.length) {
      var temChave = consulta.filtros.some(function (f) {
        return !f.negar && (f.op === "eq" || f.op === "in") && escopo.chaves.indexOf(f.coluna) !== -1;
      });
      if (!temChave) return false;
    }
    return true;
  }

  /** Responde a consulta com as linhas guardadas. { ok:false } = não dá para responder. */
  function avaliarConsulta(consulta, retrato) {
    if (!retrato || !Array.isArray(retrato.linhas)) return { ok: false };
    if (!consultaCoberta(consulta, retrato.escopo)) return { ok: false };

    var linhas = retrato.linhas;
    var amostra = linhas[0];
    if (amostra) {
      var usadas = (consulta.colunas || [])
        .concat(consulta.filtros.map(function (f) { return f.coluna; }))
        .concat(consulta.ordem.map(function (o) { return o.coluna; }));
      for (var i = 0; i < usadas.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(amostra, usadas[i])) return { ok: false };
      }
    }

    var filtradas = linhas.filter(function (linha) {
      for (var j = 0; j < consulta.filtros.length; j++) {
        if (!linhaPassa(linha, consulta.filtros[j])) return false;
      }
      return true;
    });

    if (consulta.ordem.length) {
      filtradas = filtradas.slice().sort(function (a, b) {
        for (var k = 0; k < consulta.ordem.length; k++) {
          var o = consulta.ordem[k];
          var va = a[o.coluna];
          var vb = b[o.coluna];
          var na = vazio(va);
          var nb = vazio(vb);
          if (na || nb) {
            if (na && nb) continue;
            return (na ? -1 : 1) * (o.nullsFirst ? 1 : -1);
          }
          var c = ordenarValores(va, vb);
          if (c !== 0) return o.desc ? -c : c;
        }
        return 0;
      });
    }

    var total = filtradas.length;
    var inicio = consulta.offset || 0;
    var fim = consulta.limite === null ? undefined : inicio + consulta.limite;
    var pagina = filtradas.slice(inicio, fim);

    if (consulta.colunas) {
      pagina = pagina.map(function (linha) {
        var saida = {};
        for (var c = 0; c < consulta.colunas.length; c++) {
          saida[consulta.colunas[c]] = linha[consulta.colunas[c]];
        }
        return saida;
      });
    }

    return { ok: true, dados: pagina, total: total, inicio: inicio };
  }

  /** Corpo/status/headers que o PostgREST devolveria para este resultado. */
  function montarRespostaRest(consulta, resultado) {
    var headers = { "content-type": "application/json; charset=utf-8" };
    var n = resultado.dados.length;
    if (consulta.objeto) {
      if (n !== 1) {
        return {
          status: 406,
          headers: headers,
          corpo: JSON.stringify({
            code: "PGRST116",
            details: "The result contains " + n + " rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          }),
        };
      }
      return { status: 200, headers: headers, corpo: JSON.stringify(resultado.dados[0]) };
    }
    headers["content-range"] =
      n > 0
        ? resultado.inicio + "-" + (resultado.inicio + n - 1) + "/" + resultado.total
        : "*/" + resultado.total;
    return { status: 200, headers: headers, corpo: JSON.stringify(resultado.dados) };
  }

  function paginaDeCampo(pathname) {
    for (var i = 0; i < PAGINAS_FORA.length; i++) {
      var fora = PAGINAS_FORA[i];
      if (pathname === fora || pathname.indexOf(fora.charAt(fora.length - 1) === "/" ? fora : fora + "/") === 0) {
        return false;
      }
    }
    return !/\.[a-z0-9]+$/i.test(pathname);
  }

  function ehFormularioColeta(pathname) {
    return /^\/coletas\/nova\/[a-z-]+$/.test(pathname);
  }

  /** Telas cujo HTML não muda com ?ponto= / ?de= — o parâmetro é lido no próprio celular. */
  function htmlIndependeDaBusca(pathname) {
    return pathname === PAGINA_OFFLINE || ehFormularioColeta(pathname);
  }

  var api = {
    interpretarConsultaRest: interpretarConsultaRest,
    avaliarConsulta: avaliarConsulta,
    consultaCoberta: consultaCoberta,
    montarRespostaRest: montarRespostaRest,
    paginaDeCampo: paginaDeCampo,
    ehFormularioColeta: ehFormularioColeta,
    htmlIndependeDaBusca: htmlIndependeDaBusca,
  };
  root.OperaRouteCampo = api;

  if (!ATIVO || !root.registration || typeof root.addEventListener !== "function") return;

  /* ───────────── Service worker ───────────── */

  var dbPromise = null;

  function abrirDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_TABELAS)) db.createObjectStore(STORE_TABELAS, { keyPath: "nome" });
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "chave" });
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = function () {
        dbPromise = null;
        reject(req.error);
      };
    });
    return dbPromise;
  }

  function lerTabela(nome) {
    return abrirDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(STORE_TABELAS, "readonly").objectStore(STORE_TABELAS).get(nome);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }

  function limparBanco() {
    return abrirDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction([STORE_TABELAS, STORE_META], "readwrite");
        tx.objectStore(STORE_TABELAS).clear();
        tx.objectStore(STORE_META).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
        tx.onabort = function () { resolve(); };
      });
    });
  }

  function limparTudo() {
    return caches
      .keys()
      .then(function (nomes) {
        return Promise.all(
          nomes
            .filter(function (n) { return n.indexOf(PREFIXO_CACHE) === 0; })
            .map(function (n) { return caches.delete(n); })
        );
      })
      .then(limparBanco)
      .catch(function () {});
  }

  function aparar(nomeCache) {
    var max = LIMITE_ENTRADAS[nomeCache];
    return caches.open(nomeCache).then(function (cache) {
      return cache.keys().then(function (chaves) {
        var sobra = chaves.length - max;
        if (sobra <= 0) return;
        return Promise.all(chaves.slice(0, sobra).map(function (k) { return cache.delete(k); }));
      });
    });
  }

  /** Guarda a resposta com a hora em que foi salva (para comparar com os dados da rota). */
  function guardar(nomeCache, chave, resposta) {
    return resposta
      .blob()
      .then(function (corpo) {
        var headers = new Headers(resposta.headers);
        headers.set(HEADER_SALVO_EM, String(Date.now()));
        var copia = new Response(corpo, { status: resposta.status, statusText: resposta.statusText, headers: headers });
        return caches.open(nomeCache).then(function (cache) { return cache.put(chave, copia); });
      })
      .then(function () { return aparar(nomeCache); })
      .catch(function () {});
  }

  function salvoEm(resposta) {
    var v = Number(resposta && resposta.headers.get(HEADER_SALVO_EM));
    return isFinite(v) ? v : 0;
  }

  function htmlSemDados() {
    var html =
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem internet</title></head>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'background:#0b0f14;color:#e5e7eb;font-family:system-ui,sans-serif;padding:24px;text-align:center">' +
      '<div style="max-width:360px"><h1 style="font-size:20px;margin:0 0 8px">Sem internet</h1>' +
      '<p style="color:#9ca3af;line-height:1.5">Este aparelho ainda não guardou as telas de campo. ' +
      "Abra o app uma vez com internet para ele se preparar.</p>" +
      '<button onclick="location.reload()" style="margin-top:12px;padding:10px 18px;border-radius:6px;' +
      'border:1px solid #374151;background:#111827;color:#e5e7eb;font-size:15px">Tentar de novo</button>' +
      "</div></body></html>";
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  function chavePagina(url) {
    var u = new URL(url.href);
    u.hash = "";
    u.searchParams.delete("_rsc");
    return u.href;
  }

  function acharPaginaGuardada(url) {
    return caches.open(CACHE_PAGINAS).then(function (cache) {
      var opcoes = { ignoreVary: true };
      return cache.match(chavePagina(url), opcoes).then(function (exata) {
        if (exata) return exata;
        if (!htmlIndependeDaBusca(url.pathname)) return null;
        return cache.match(url.origin + url.pathname, opcoes).then(function (semBusca) {
          if (semBusca) return semBusca;
          return cache.match(url.origin + url.pathname, { ignoreVary: true, ignoreSearch: true });
        });
      });
    });
  }

  function paginaOffline(url) {
    return acharPaginaGuardada(url).then(function (guardada) {
      if (guardada) return guardada;
      if (url.pathname === PAGINA_OFFLINE) return htmlSemDados();
      return caches
        .open(CACHE_PAGINAS)
        .then(function (cache) { return cache.match(url.origin + PAGINA_OFFLINE, { ignoreVary: true }); })
        .then(function (temTelaCampo) {
          if (!temTelaCampo) return htmlSemDados();
          var destino = url.origin + PAGINA_OFFLINE + "?de=" + encodeURIComponent(url.pathname + url.search);
          return Response.redirect(destino, 302);
        });
    });
  }

  function navegar(event, url) {
    return fetch(event.request).then(
      function (resposta) {
        var tipo = resposta.headers.get("content-type") || "";
        if (
          url.pathname !== "/" &&
          resposta.ok &&
          resposta.type === "basic" &&
          !resposta.redirected &&
          tipo.indexOf("text/html") !== -1
        ) {
          event.waitUntil(guardar(CACHE_PAGINAS, chavePagina(url), resposta.clone()));
        }
        return resposta;
      },
      function () {
        return paginaOffline(url);
      }
    );
  }

  function estatico(event) {
    var req = event.request;
    return caches.open(CACHE_ESTATICOS).then(function (cache) {
      return cache.match(req, { ignoreVary: true }).then(function (guardado) {
        if (guardado) return guardado;
        return fetch(req).then(function (resposta) {
          var cc = resposta.headers.get("cache-control") || "";
          // Só arquivos com hash (imutáveis). No `next dev` eles vêm sem "immutable" e não são guardados.
          if (resposta.ok && cc.indexOf("immutable") !== -1) {
            event.waitUntil(cache.put(req, resposta.clone()).then(function () { return aparar(CACHE_ESTATICOS); }));
          }
          return resposta;
        });
      });
    });
  }

  function chaveDados(req) {
    var accept = req.headers.get("accept") || "";
    if (accept.indexOf("application/vnd.pgrst.object+json") === -1) return req.url;
    return req.url + (req.url.indexOf("?") === -1 ? "?" : "&") + "__or_objeto=1";
  }

  function dadosDoRetrato(req) {
    var consulta = interpretarConsultaRest(req.url, req.headers.get("accept"));
    if (!consulta || !TABELAS_CAMPO[consulta.tabela]) return Promise.resolve(null);
    return lerTabela(consulta.tabela)
      .then(function (retrato) {
        if (!retrato) return null;
        var resultado = avaliarConsulta(consulta, retrato);
        if (!resultado.ok) return null;
        var r = montarRespostaRest(consulta, resultado);
        r.headers[HEADER_SALVO_EM] = String(retrato.salvo_em || 0);
        r.headers["x-or-offline"] = "rota";
        return { salvoEm: retrato.salvo_em || 0, resposta: new Response(r.corpo, { status: r.status, headers: r.headers }) };
      })
      .catch(function () { return null; });
  }

  function dadosSupabase(event, rest) {
    var req = event.request;
    var chave = chaveDados(req);
    return fetch(req).then(
      function (resposta) {
        if (resposta.ok) event.waitUntil(guardar(CACHE_DADOS, chave, resposta.clone()));
        return resposta;
      },
      function () {
        return Promise.all([
          caches.open(CACHE_DADOS).then(function (cache) { return cache.match(chave, { ignoreVary: true }); }),
          rest ? dadosDoRetrato(req) : Promise.resolve(null),
        ]).then(function (achados) {
          var guardado = achados[0];
          var rota = achados[1];
          if (guardado && rota) return salvoEm(guardado) >= rota.salvoEm ? guardado : rota.resposta;
          if (guardado) return guardado;
          if (rota) return rota.resposta;
          return Response.error();
        });
      }
    );
  }

  function dadosApi(event) {
    var req = event.request;
    return fetch(req).then(
      function (resposta) {
        if (resposta.ok) event.waitUntil(guardar(CACHE_DADOS, req.url, resposta.clone()));
        return resposta;
      },
      function () {
        return caches
          .open(CACHE_DADOS)
          .then(function (cache) { return cache.match(req.url, { ignoreVary: true }); })
          .then(function (guardado) { return guardado || Response.error(); });
      }
    );
  }

  function tabelaRest(pathname) {
    var m = /^\/rest\/v1\/([^/]+)$/.exec(pathname);
    return m ? m[1] : null;
  }

  root.addEventListener("install", function () {
    root.skipWaiting();
  });

  root.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (nomes) {
          return Promise.all(
            nomes
              .filter(function (n) { return n.indexOf(PREFIXO_CACHE) === 0 && CACHES_ATUAIS.indexOf(n) === -1; })
              .map(function (n) { return caches.delete(n); })
          );
        })
        .then(function () { return root.clients.claim(); })
        .catch(function () {})
    );
  });

  root.addEventListener("fetch", function (event) {
    var req = event.request;
    var url;
    try {
      url = new URL(req.url);
    } catch {
      return;
    }
    var mesmaOrigem = url.origin === root.location.origin;

    if (req.method !== "GET") {
      if (mesmaOrigem && req.mode === "navigate" && url.pathname === "/auth/signout") {
        event.waitUntil(limparTudo());
      }
      return;
    }

    if (mesmaOrigem) {
      if (req.mode === "navigate") {
        if (url.pathname === "/" || paginaDeCampo(url.pathname)) event.respondWith(navegar(event, url));
        return;
      }
      if (url.pathname.indexOf("/_next/static/") === 0) {
        event.respondWith(estatico(event));
        return;
      }
      if (url.pathname.indexOf("/api/fura-kits/") === 0) {
        event.respondWith(dadosApi(event));
      }
      return;
    }

    var tabela = tabelaRest(url.pathname);
    if (tabela && TABELAS_CAMPO[tabela]) {
      event.respondWith(dadosSupabase(event, true));
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      event.respondWith(dadosSupabase(event, false));
    }
  });
})(typeof self !== "undefined" ? self : globalThis);
