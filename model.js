/**
 * Lógica pura de auditorías (sin DOM ni Firebase): identificadores, estados,
 * estadísticas y filtros. Compatible con el esquema que ya usan las listas.
 */
import { UMBRALES } from '../../config.js';
import { idAleatorio } from '../../core/security.js';

export const TIPOS = Object.freeze({
  servicio: Object.freeze({ id: 'servicio', ruta: 'auditorias', prefijo: 'AUD', titulo: 'Auditorías de servicio', singular: 'auditoría de servicio' }),
  pi: Object.freeze({ id: 'pi', ruta: 'auditorias_pi', prefijo: 'PI', titulo: 'Paciente incógnito', singular: 'auditoría de paciente incógnito' }),
});

export const ESTADOS = Object.freeze({
  'en-progreso': 'En progreso',
  completada: 'Completada',
});

export const FILTROS = Object.freeze(['todas', 'en-progreso', 'completada', 'papelera']);

const dos = n => String(n).padStart(2, '0');

/** Fecha local AAAA-MM-DD (la versión clásica usaba UTC y fallaba después de las 7 p. m.). */
export function fechaLocal(fecha = new Date()) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Id no adivinable: la clásica usaba 4 dígitos del reloj y podía repetirse. */
export function nuevoId(tipo, fecha = new Date()) {
  return `${TIPOS[tipo].prefijo}-${fechaLocal(fecha).replaceAll('-', '')}-${idAleatorio(8)}`;
}

export function nuevaAuditoria(tipo, { sesion, institucion, ahora, fecha = new Date(ahora) }) {
  const base = {
    uid: sesion.uid,
    email: sesion.email,
    auditorNombre: sesion.nombre,
    auditorCargo: sesion.cargo || 'Auditor',
    institucion,
    sede: '',
    fecha: fechaLocal(fecha),
    estado: 'en-progreso',
    porcentaje: null,
    createdAt: ahora,
    updatedAt: ahora,
  };
  return tipo === 'pi' ? { tipo: 'paciente-incognito', ...base } : base;
}

/** Convierte el nodo de Firebase en lista ordenada (más reciente primero). */
export function aLista(nodo) {
  if (!nodo || typeof nodo !== 'object') return [];
  return Object.entries(nodo)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ ...v, id, porcentaje: porcentajeValido(v.porcentaje) }))
    .sort((a, b) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0));
}

export function porcentajeValido(valor) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

export function nivel(porcentaje) {
  if (porcentaje === null || porcentaje === undefined) return 'nd';
  if (porcentaje >= UMBRALES.alto) return 'alto';
  if (porcentaje >= UMBRALES.medio) return 'medio';
  return 'bajo';
}

export const ETIQUETA_NIVEL = Object.freeze({ nd: 'Sin calificar', alto: 'Riesgo bajo', medio: 'Riesgo medio', bajo: 'Riesgo alto' });

/** Las de servicio son personales; las de paciente incógnito incluyen las que llegan por QR. */
export function visiblesPara(lista, tipo, uid) {
  if (tipo === 'pi') return lista.filter(a => a.uid === uid || a.tipo === 'paciente-incognito');
  return lista.filter(a => a.uid === uid);
}

export function filtrar(lista, filtro) {
  if (filtro === 'papelera') return lista.filter(a => a.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  const activas = lista.filter(a => !a.deletedAt);
  return filtro === 'todas' ? activas : activas.filter(a => (a.estado || 'en-progreso') === filtro);
}

export function estadisticas(lista) {
  const activas = lista.filter(a => !a.deletedAt);
  const conNota = activas.filter(a => a.porcentaje !== null);
  return {
    total: activas.length,
    enProgreso: activas.filter(a => (a.estado || 'en-progreso') === 'en-progreso').length,
    completadas: activas.filter(a => a.estado === 'completada').length,
    promedio: conNota.length ? Math.round(conNota.reduce((s, a) => s + a.porcentaje, 0) / conNota.length) : null,
    enPapelera: lista.length - activas.length,
  };
}

export function delMes(lista, fecha = new Date()) {
  const prefijo = fechaLocal(fecha).slice(0, 7);
  return lista.filter(a => !a.deletedAt && String(a.fecha || '').startsWith(prefijo)).length;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m || +m[2] < 1 || +m[2] > 12) return '—';
  return `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}`;
}
