/** Fragmentos de interfaz compartidos por Inicio y Auditorías. */
import { HOSTS_IMAGEN, INSTITUCIONES, LISTAS } from '../../config.js';
import { html, safeUrl } from '../../core/security.js';
import { ETIQUETA_NIVEL, nivel } from './model.js';

export function institucionDe(auditoria) {
  return INSTITUCIONES[auditoria?.institucion] || INSTITUCIONES.foca;
}

/** Logo con respaldo de texto: si la imagen no carga queda la sigla. */
export function logoInstitucion(inst) {
  const src = safeUrl(inst.logo, HOSTS_IMAGEN);
  return html`<span class="lg">${inst.nombre}${src ? html`<img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
}

export function pastillaNota(porcentaje) {
  const n = nivel(porcentaje);
  return html`<span class="pct ${n}" title="${ETIQUETA_NIVEL[n]}">${porcentaje === null ? '—' : `${porcentaje}%`}</span>`;
}

/** URL de la lista de verificación. Solo rutas propias definidas en la configuración. */
export function urlLista(tipo, auditoria, uid) {
  const base = LISTAS[tipo][institucionDe(auditoria).id];
  return `${base}?auditId=${encodeURIComponent(auditoria.id)}&uid=${encodeURIComponent(uid)}`;
}

export function tituloAuditoria(auditoria) {
  return `${auditoria.sede || 'Sin sede'} — ${institucionDe(auditoria).nombre}`;
}
