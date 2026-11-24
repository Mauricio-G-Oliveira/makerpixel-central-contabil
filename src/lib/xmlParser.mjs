/**
 * xmlParser.mjs — Parser XML leve e universal em JavaScript puro.
 * Converte strings XML em árvore de nós { nome, attrs, filhos, texto }
 * sem depender do DOM do navegador ou de bibliotecas pesadas.
 */

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function desescapar(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      );
    }
    return ENT[e.toLowerCase()] !== undefined ? ENT[e.toLowerCase()] : m;
  });
}

export function arvore(texto) {
  const s = String(texto || "").replace(/^\uFEFF/, "");
  const raiz = { nome: "#doc", attrs: {}, filhos: [], texto: "" };
  const pilha = [raiz];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([^\s>]+)\s*>|<([^\s\/>]+)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/gi;
  let m;
  let ultimo = 0;

  while ((m = re.exec(s))) {
    const atual = pilha[pilha.length - 1];
    if (m.index > ultimo) {
      atual.texto += desescapar(s.slice(ultimo, m.index));
    }
    ultimo = re.lastIndex;

    if (m[1] !== undefined) {
      atual.texto += m[1];
      continue;
    }
    if (m[2]) {
      const nome = m[2].toLowerCase();
      for (let k = pilha.length - 1; k > 0; k--) {
        if (pilha[k].nome === nome) {
          pilha.length = k;
          break;
        }
      }
      continue;
    }
    if (!m[3]) continue;

    const attrs = {};
    const ra = /([^\s=\/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = ra.exec(m[4] || ""))) {
      attrs[a[1].toLowerCase()] = desescapar(a[3] !== undefined ? a[3] : a[4]);
    }
    const el = {
      nome: m[3].toLowerCase().replace(/^[^:]+:/, ""),
      attrs,
      filhos: [],
      texto: ""
    };
    atual.filhos.push(el);
    if (!m[5]) pilha.push(el);
  }

  if (!raiz.filhos.length) throw new Error("Não parece um arquivo XML.");
  return raiz.filhos[0];
}

export function filho(el, nome) {
  if (!el || !el.filhos) return null;
  const n = String(nome).toLowerCase();
  for (let i = 0; i < el.filhos.length; i++) {
    if (el.filhos[i].nome === n) return el.filhos[i];
  }
  return null;
}

export function textoTag(el, nome) {
  const f = nome ? filho(el, nome) : el;
  return f ? (f.texto || "").trim() : "";
}

export function todosFilhos(el, nome, out = []) {
  if (!el || !el.filhos) return out;
  const n = String(nome).toLowerCase();
  el.filhos.forEach((f) => {
    if (f.nome === n) out.push(f);
    else todosFilhos(f, nome, out);
  });
  return out;
}

export default { arvore, desescapar, filho, textoTag, todosFilhos };
