/**
 * Seguridad de salida. Toda cadena que llega al DOM pasa por aquí.
 * Regla del proyecto: nunca asignar innerHTML con un string; solo con `render()`.
 */

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"'`]/g, c => ENTIDADES[c]);
}

/** HTML ya saneado. Solo lo producen `html` y `raw`. */
export class SafeHtml {
  constructor(texto) {
    this.texto = texto;
    Object.freeze(this);
  }
  toString() {
    return this.texto;
  }
}

function interpolar(valor) {
  if (valor instanceof SafeHtml) return valor.texto;
  if (Array.isArray(valor)) return valor.map(interpolar).join('');
  if (valor === null || valor === undefined || valor === false) return '';
  return escapeHtml(valor);
}

/** Plantilla etiquetada: escapa cada interpolación salvo que ya sea SafeHtml. */
export function html(partes, ...valores) {
  let salida = partes[0];
  for (let i = 0; i < valores.length; i++) salida += interpolar(valores[i]) + partes[i + 1];
  return new SafeHtml(salida);
}

/** Marca como seguro un fragmento ESTÁTICO escrito por nosotros (íconos). Nunca datos. */
export function raw(textoEstatico) {
  return new SafeHtml(String(textoEstatico));
}

export function render(elemento, contenido) {
  if (!(contenido instanceof SafeHtml)) throw new TypeError('render() solo acepta SafeHtml');
  elemento.innerHTML = contenido.texto;
}

/**
 * Devuelve la URL solo si es https y su host está permitido; si no, cadena vacía.
 * Bloquea javascript:, data:, http: y hosts ajenos.
 */
export function safeUrl(valor, hostsPermitidos = []) {
  if (typeof valor !== 'string' || !valor) return '';
  let url;
  try {
    url = new URL(valor);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  const host = url.hostname.toLowerCase();
  const ok = hostsPermitidos.some(h => (h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h));
  return ok ? url.href : '';
}

/** Firebase prohíbe . # $ [ ] / y caracteres de control en las claves. */
export function esClaveValida(clave) {
  // eslint-disable-next-line no-control-regex
  return typeof clave === 'string' && clave.length > 0 && clave.length <= 128 && !/[.#$[\]/\u0000-\u001f\u007f]/.test(clave);
}

export function sanearClave(texto) {
  // eslint-disable-next-line no-control-regex
  const limpia = String(texto ?? '').replace(/[.#$[\]/\u0000-\u001f\u007f]/g, '_').slice(0, 128);
  return limpia || '_';
}

/** Recorta y normaliza texto de usuario antes de guardarlo. */
export function limpiarTexto(valor, max = 200) {
  // eslint-disable-next-line no-control-regex
  return String(valor ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** Identificador aleatorio no adivinable (base 32 sin caracteres ambiguos). */
export function idAleatorio(longitud = 8) {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(longitud);
  globalThis.crypto.getRandomValues(bytes);
  let salida = '';
  for (const b of bytes) salida += alfabeto[b % alfabeto.length];
  return salida;
}
