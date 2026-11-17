/**
 * Lógica pura del Dashboard. Calcula todo desde `auditorias` (Firebase) y el
 * borrador que guarda cada lista (`draft.radios`, `draft.obs`). Sin DOM ni red.
 */
import { CATEGORIAS, ITEMS, PUNTAJE, RESULTADOS } from '../auditorias/catalogo.js';
import { nivel } from '../auditorias/model.js';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** 'AAAA-MM' de la fecha de la auditoría, o '' si no es válida. */
export function mesDe(auditoria) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(auditoria?.fecha || ''));
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2]}` : '';
}

export function nombreMes(clave, largo = false) {
  const [a, m] = String(clave).split('-');
  if (!a || !m) return '—';
  return largo ? `${MESES_LARGOS[+m - 1]} ${a}` : `${MESES_CORTOS[+m - 1]} ${a.slice(2)}`;
}

/** Solo cuentan las auditorías vigentes y calificadas. */
export function calificadas(lista) {
  return lista.filter(a => !a.deletedAt && a.porcentaje !== null && a.porcentaje !== undefined);
}

export function opciones(lista) {
  const base = calificadas(lista);
  return {
    meses: [...new Set(base.map(mesDe).filter(Boolean))].sort().reverse(),
    sedes: [...new Set(base.map(a => String(a.sede || '').trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es')),
  };
}

export function aplicarFiltros(lista, { institucion = 'todas', mes = '', sede = '' } = {}) {
  return calificadas(lista).filter(
    a =>
      (institucion === 'todas' || (a.institucion || 'foca') === institucion) &&
      (!mes || mesDe(a) === mes) &&
      (!sede || String(a.sede || '').trim() === sede),
  );
}

const promedio = valores => (valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null);

export function resumen(lista) {
  const notas = lista.map(a => a.porcentaje);
  const niveles = { alto: 0, medio: 0, bajo: 0 };
  notas.forEach(p => niveles[nivel(p)]++);
  return {
    total: lista.length,
    promedio: promedio(notas),
    sedes: new Set(lista.map(a => String(a.sede || '').trim()).filter(Boolean)).size,
    riesgoBajo: niveles.alto,
    riesgoMedio: niveles.medio,
    riesgoAlto: niveles.bajo,
  };
}

/** Promedio mensual, en orden cronológico, de los últimos `meses` meses con datos. */
export function tendencia(lista, meses = 12) {
  const grupos = {};
  lista.forEach(a => {
    const m = mesDe(a);
    if (m) (grupos[m] ||= []).push(a.porcentaje);
  });
  return Object.keys(grupos)
    .sort()
    .slice(-meses)
    .map(m => ({ mes: m, etiqueta: nombreMes(m), valor: promedio(grupos[m]), n: grupos[m].length }));
}

/** Variación entre los dos últimos puntos de la tendencia. */
export function variacion(serie) {
  if (serie.length < 2) return null;
  return serie.at(-1).valor - serie.at(-2).valor;
}

/** Respuestas válidas de un borrador: [{ id, categoria, texto, resultado }]. */
export function respuestas(auditoria) {
  const radios = auditoria?.draft?.radios;
  if (!radios || typeof radios !== 'object') return [];
  return Object.entries(radios)
    .filter(([id, r]) => ITEMS[id] && RESULTADOS.includes(r))
    .map(([id, resultado]) => ({ id, ...ITEMS[id], resultado }));
}

/** La lista guarda las observaciones con el texto del ítem como clave (saneado). */
const claveObs = texto => texto.replace(/[.#$[\]/]/g, '_');

export function observacion(auditoria, texto) {
  const obs = auditoria?.draft?.obs;
  const v = obs && typeof obs === 'object' ? obs[claveObs(texto)] : '';
  return typeof v === 'string' ? v.trim().slice(0, 600) : '';
}

export function distribucion(lista) {
  const d = { C: 0, CP: 0, NC: 0, NA: 0 };
  lista.forEach(a => respuestas(a).forEach(r => d[r.resultado]++));
  const total = d.C + d.CP + d.NC + d.NA;
  return { ...d, total };
}

/** Cumplimiento por categoría con el mismo puntaje de la lista. */
export function porCategoria(lista) {
  const acc = Object.fromEntries(CATEGORIAS.map(c => [c.nombre, { suma: 0, n: 0, nc: 0 }]));
  lista.forEach(a =>
    respuestas(a).forEach(r => {
      const c = acc[r.categoria];
      c.suma += PUNTAJE[r.resultado];
      c.n++;
      if (r.resultado === 'NC') c.nc++;
    }),
  );
  return CATEGORIAS.filter(c => acc[c.nombre].n > 0).map(c => ({
    nombre: c.nombre,
    peso: c.peso,
    valor: Math.round((acc[c.nombre].suma / acc[c.nombre].n) * 100),
    evaluados: acc[c.nombre].n,
    noConformes: acc[c.nombre].nc,
  }));
}

/**
 * Ítems con el resultado pedido (NC por defecto), ordenados por frecuencia.
 * Incluye sedes y observaciones para el detalle.
 */
export function hallazgos(lista, resultado = 'NC', limite = 8) {
  const mapa = {};
  lista.forEach(a =>
    respuestas(a)
      .filter(r => r.resultado === resultado)
      .forEach(r => {
        const h = (mapa[r.id] ||= { id: r.id, categoria: r.categoria, texto: r.texto, veces: 0, sedes: new Set(), observaciones: [] });
        h.veces++;
        if (a.sede) h.sedes.add(String(a.sede).trim());
        const o = observacion(a, r.texto);
        if (o) h.observaciones.push({ texto: o, sede: String(a.sede || '').trim(), fecha: a.fecha || '' });
      }),
  );
  return Object.values(mapa)
    .sort((x, y) => y.veces - x.veces || x.texto.localeCompare(y.texto, 'es'))
    .slice(0, limite)
    .map(h => ({ ...h, sedes: [...h.sedes].sort((x, y) => x.localeCompare(y, 'es')) }));
}

/** Promedio por sede, de menor a mayor (lo que requiere atención primero). */
export function porSede(lista) {
  const grupos = {};
  lista.forEach(a => {
    const s = String(a.sede || '').trim() || 'Sin sede';
    (grupos[s] ||= { sede: s, institucion: a.institucion || 'foca', notas: [] }).notas.push(a.porcentaje);
  });
  return Object.values(grupos)
    .map(g => ({ sede: g.sede, institucion: g.institucion, valor: promedio(g.notas), n: g.notas.length }))
    .sort((x, y) => x.valor - y.valor || x.sede.localeCompare(y.sede, 'es'));
}
