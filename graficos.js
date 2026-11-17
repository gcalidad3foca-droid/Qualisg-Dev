/**
 * Gráficos en SVG sin librerías. Las medidas van como atributos SVG (no `style=`),
 * así cumplen la CSP estricta. Los números se validan antes de llegar al marcado.
 */
import { html } from '../core/security.js';

const num = (v, min = 0, max = 100) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const r1 = n => Math.round(n * 10) / 10;

/** Barra horizontal 0–100. `tono`: alto | medio | bajo | nd | marca. */
export function barra(valor, tono = 'marca', etiqueta = '') {
  const v = num(valor);
  return html`<svg class="hb" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${etiqueta || `${Math.round(v)}%`}">
    <rect class="hb-f" width="100" height="10"></rect>
    <rect class="hb-v ${tono}" width="${r1(v)}" height="10"></rect>
  </svg>`;
}

/** Barra apilada: partes = [{ valor, tono, etiqueta }]. */
export function barraApilada(partes, etiqueta = '') {
  const total = partes.reduce((s, p) => s + num(p.valor, 0, Infinity), 0);
  let x = 0;
  const rects = total
    ? partes.map(p => {
        const w = (num(p.valor, 0, Infinity) / total) * 100;
        const r = html`<rect class="hb-v ${p.tono}" x="${r1(x)}" width="${r1(w)}" height="10"><title>${p.etiqueta}</title></rect>`;
        x += w;
        return r;
      })
    : '';
  return html`<svg class="hb hb-lg" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${etiqueta}">
    <rect class="hb-f" width="100" height="10"></rect>${rects}
  </svg>`;
}

/**
 * Línea con área. serie = [{ etiqueta, valor }] (valor 0–100).
 * Escala vertical ajustada a los datos con margen, sin bajar de 0.
 */
export function linea(serie, { titulo = 'Tendencia', compacto = false } = {}) {
  const W = compacto ? 360 : 640;
  const H = compacto ? 210 : 230;
  const pad = { t: 30, r: 18, b: 32, l: 40 };
  if (!serie.length) return html``;
  const valores = serie.map(p => num(p.valor));
  const minY = Math.max(0, Math.floor((Math.min(...valores) - 10) / 10) * 10);
  const maxY = 100;
  const ancho = W - pad.l - pad.r;
  const alto = H - pad.t - pad.b;
  const margen = 22;
  const x = i => pad.l + margen + (serie.length === 1 ? (ancho - 2 * margen) / 2 : (i / (serie.length - 1)) * (ancho - 2 * margen));
  const y = v => pad.t + (1 - (v - minY) / (maxY - minY || 1)) * alto;
  const puntos = valores.map((v, i) => [r1(x(i)), r1(y(v))]);
  const trazo = puntos.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');
  const area = `${trazo} L${puntos.at(-1)[0]} ${pad.t + alto} L${puntos[0][0]} ${pad.t + alto} Z`;
  const guias = [minY, Math.round((minY + maxY) / 2), maxY];
  const saltoEtiqueta = Math.ceil(serie.length / (compacto ? 4 : 8));

  return html`<svg class="ln" viewBox="0 0 ${W} ${H}" role="img" aria-label="${titulo}: ${serie.map(p => `${p.etiqueta} ${p.valor}%`).join(', ')}">
    <defs>
      <linearGradient id="ln-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="ln-s1"></stop><stop offset="1" class="ln-s2"></stop>
      </linearGradient>
    </defs>
    ${guias.map(g => html`<line class="ln-g" x1="${pad.l}" x2="${W - pad.r}" y1="${r1(y(g))}" y2="${r1(y(g))}"></line><text class="ln-y" x="${pad.l - 10}" y="${r1(y(g)) + 4}">${g}%</text>`)}
    <path class="ln-a" d="${area}"></path>
    <path class="ln-l" d="${trazo}"></path>
    ${puntos.map(
      ([px, py], i) => html`<g class="ln-p">
        <circle cx="${px}" cy="${py}" r="5"></circle>
        <text class="ln-v" x="${px}" y="${py - 12}">${valores[i]}%</text>
        ${i % saltoEtiqueta === 0 || i === serie.length - 1 ? html`<text class="ln-x" x="${px}" y="${H - 8}">${serie[i].etiqueta}</text>` : ''}
        <title>${serie[i].etiqueta}: ${valores[i]}%${serie[i].n ? ` (${serie[i].n})` : ''}</title>
      </g>`,
    )}
  </svg>`;
}
