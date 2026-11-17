/** Avisos breves. Región aria-live para lectores de pantalla. */
import { html, render } from '../core/security.js';
import { icon } from './icons.js';

const ICONO = { ok: 'ok', error: 'alerta', info: 'info' };
let region;

function asegurarRegion() {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.className = 'toasts';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.append(region);
  return region;
}

export function toast(mensaje, tipo = 'info', ms = 3600) {
  const el = document.createElement('div');
  el.className = `toast ${ICONO[tipo] ? tipo : 'info'}`;
  render(el, html`${icon(ICONO[tipo] || 'info')}<span>${mensaje}</span>`);
  asegurarRegion().append(el);
  const quitar = () => {
    el.classList.add('sale');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  setTimeout(quitar, ms);
  return quitar;
}

/** Mensaje seguro a partir de un error: nunca muestra trazas ni detalles internos. */
export function mensajeDeError(error, respaldo = 'Ocurrió un error. Inténtalo de nuevo.') {
  if (error?.code === 'app/sin-permiso') return error.message;
  if (/permission[_ -]denied/i.test(String(error?.code || error?.message))) return 'No tienes permiso para esta acción.';
  if (/network|offline/i.test(String(error?.code || error?.message))) return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
  return respaldo;
}
