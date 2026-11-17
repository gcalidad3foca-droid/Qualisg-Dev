/** Íconos propios en SVG (trazo, 24 px). Contenido estático: por eso se marcan con `raw`. */
import { raw } from '../core/security.js';

const C9 = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';
const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  auditorias: 'M9 4h6v3H9z M9 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-3 M9 12h6 M9 16h4',
  dashboard: 'M4 20V11 M10 20V4 M16 20v-7 M21 20H3',
  documentos: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z M14 3v4h4 M9 13h6 M9 17h6',
  indicadores: `${C9} M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 11.9v.2`,
  iso: 'M12 3 5 6v5c0 4.5 2.9 8.3 7 10 4.1-1.7 7-5.5 7-10V6z M9 12l2 2 4-4',
  equipo: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  ajustes: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4',
  mas: 'M12 5v14 M5 12h14',
  cerrar: 'M6 6l12 12 M18 6 6 18',
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  papelera: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  restaurar: 'M8 6 4 10l4 4 M4 10h10a5 5 0 0 1 0 10h-3',
  continuar: 'M7 4.5v15l12-7.5z',
  abrir: 'M3 7a1 1 0 0 1 1-1h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  reloj: `${C9} M12 7.5V12l3 2`,
  salir: 'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5 M15 8l4 4-4 4 M19 12H9',
  chevron: 'M9 6l6 6-6 6',
  flecha: 'M5 12h14 M13 6l6 6-6 6',
  ver: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ocultar: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M4 4l16 16',
  alerta: 'M12 4 2.5 20h19z M12 10v4.5 M12 17.4v.1',
  externo: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  incognito: 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3.5 20a6.5 6.5 0 0 1 9-6 M17.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M19.4 19.4l2.1 2.1',
  calendario: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M4 10h16 M8 3.5v4 M16 3.5v4',
  usuario: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5a7.5 7.5 0 0 1 15 0',
  etiqueta: 'M4 4h7l9 9-7 7-9-9z M8 8v.1',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  info: `${C9} M12 11v5 M12 7.8v.1`,
  tendencia: 'M4 16l5-5 4 3 7-8 M15 6h5v5',
  correo: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M3.5 7.5 12 13l8.5-5.5',
  candado: 'M7 11V8a5 5 0 0 1 10 0v3 M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
};

export const NOMBRES_DE_ICONOS = Object.freeze(Object.keys(TRAZOS));

export function icon(nombre) {
  const d = TRAZOS[nombre] || TRAZOS.info;
  return raw(`<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`);
}
