/**
 * Qualisig · Worker de archivos (Cloudflare Workers + R2).
 *
 * Sustituye a la firma de subidas en el navegador: aquí NO hay llaves de R2.
 * El bucket se usa con un "binding" (env.BUCKET), que nunca sale del Worker.
 *
 *   PUT  /archivo/<clave>        Authorization: Bearer <ID token de Firebase>
 *   GET  /descarga/<clave>?nombre=archivo.pdf   (fuerza la descarga con ese nombre)
 *
 * Variables (wrangler.toml): FIREBASE_PROJECT_ID, FIREBASE_DB_URL, PUBLIC_BASE_URL, ALLOWED_ORIGINS.
 */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
export const MAX_BYTES = 20 * 1024 * 1024;
export const CARPETAS = ['indicadores', 'autoevaluacion-iso', 'evidencias', 'perfiles', 'documentos'];

/** Tipo permitido → cómo debe empezar el archivo (firma) y si se muestra en línea. */
export const TIPOS = {
  'image/jpeg': { firma: [[0xff, 0xd8, 0xff]], enLinea: true },
  'image/png': { firma: [[0x89, 0x50, 0x4e, 0x47]], enLinea: true },
  'image/gif': { firma: [[0x47, 0x49, 0x46, 0x38]], enLinea: true },
  'image/webp': { firma: [[0x52, 0x49, 0x46, 0x46]], enLinea: true },
  'application/pdf': { firma: [[0x25, 0x50, 0x44, 0x46]], enLinea: true },
  'application/msword': { firma: [[0xd0, 0xcf, 0x11, 0xe0]] },
  'application/vnd.ms-excel': { firma: [[0xd0, 0xcf, 0x11, 0xe0]] },
  'application/vnd.ms-powerpoint': { firma: [[0xd0, 0xcf, 0x11, 0xe0]] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { firma: [[0x50, 0x4b, 0x03, 0x04]] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { firma: [[0x50, 0x4b, 0x03, 0x04]] },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { firma: [[0x50, 0x4b, 0x03, 0x04]] },
  'text/plain': { firma: null },
  'text/csv': { firma: null },
};

class HttpError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const b64url = texto => Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const json = texto => JSON.parse(new TextDecoder().decode(b64url(texto)));

let cacheLlaves = { hasta: 0, llaves: [] };

async function llavesDeGoogle(fetchFn, ahora) {
  if (cacheLlaves.hasta > ahora) return cacheLlaves.llaves;
  const resp = await fetchFn(JWKS_URL);
  if (!resp.ok) throw new HttpError(503, 'No se pudieron obtener las llaves de verificación');
  const { keys } = await resp.json();
  cacheLlaves = { hasta: ahora + 3600_000, llaves: keys || [] };
  return cacheLlaves.llaves;
}

export function _vaciarCache() {
  cacheLlaves = { hasta: 0, llaves: [] };
}

/** Verifica un ID token de Firebase (RS256) y devuelve sus datos. */
export async function verificarToken(token, projectId, { fetchFn = fetch, ahora = Date.now() } = {}) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new HttpError(401, 'Token ausente o mal formado');
  let cabecera;
  let datos;
  try {
    cabecera = json(partes[0]);
    datos = json(partes[1]);
  } catch {
    throw new HttpError(401, 'Token mal formado');
  }
  if (cabecera.alg !== 'RS256' || !cabecera.kid) throw new HttpError(401, 'Algoritmo no admitido');

  const jwk = (await llavesDeGoogle(fetchFn, ahora)).find(k => k.kid === cabecera.kid);
  if (!jwk) throw new HttpError(401, 'Llave desconocida');
  const llave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const firmado = new TextEncoder().encode(`${partes[0]}.${partes[1]}`);
  const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, b64url(partes[2]), firmado);
  if (!valida) throw new HttpError(401, 'Firma no válida');

  const seg = Math.floor(ahora / 1000);
  if (datos.aud !== projectId || datos.iss !== `https://securetoken.google.com/${projectId}`) throw new HttpError(401, 'Token de otro proyecto');
  if (typeof datos.exp !== 'number' || datos.exp <= seg) throw new HttpError(401, 'Token vencido');
  if (typeof datos.iat !== 'number' || datos.iat > seg + 300) throw new HttpError(401, 'Token con fecha futura');
  if (typeof datos.sub !== 'string' || !datos.sub || datos.sub.length > 128) throw new HttpError(401, 'Token sin usuario');
  return datos;
}

/** Clave válida: carpeta permitida + nombre simple. Sin rutas relativas ni caracteres raros. */
export function claveValida(clave) {
  if (typeof clave !== 'string' || clave.length > 300 || clave.includes('..')) return false;
  const m = /^([a-z0-9-]+)\/((?:[A-Za-z0-9_-][A-Za-z0-9._-]{0,180}\/)*[A-Za-z0-9_-][A-Za-z0-9._-]{0,180})$/.exec(clave);
  return !!m && CARPETAS.includes(m[1]);
}

export function firmaCoincide(bytes, tipo) {
  const def = TIPOS[tipo];
  if (!def) return false;
  if (def.firma === null) return !bytes.subarray(0, 4096).includes(0); // texto: sin bytes nulos
  return def.firma.some(f => f.every((b, i) => bytes[i] === b));
}

function cors(request, env) {
  const origen = request.headers.get('Origin') || '';
  const permitidos = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const base = { Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (!permitidos.includes(origen)) return { ok: !origen, cabeceras: base };
  return {
    ok: true,
    cabeceras: {
      ...base,
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Methods': 'PUT, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600',
    },
  };
}

async function exigirPersonalActivo(token, uid, env, fetchFn) {
  // Se consulta la ficha con el propio token del usuario: aplican las reglas de la base de datos.
  const url = `${env.FIREBASE_DB_URL}/usuarios/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
  const resp = await fetchFn(url);
  if (!resp.ok) throw new HttpError(403, 'Cuenta sin acceso');
  const ficha = await resp.json();
  if (!ficha || ficha.activo !== true || !['admin', 'gestor', 'auditor'].includes(ficha.rol)) throw new HttpError(403, 'Cuenta sin permiso para subir archivos');
}

async function subir(request, env, clave, fetchFn) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const datos = await verificarToken(token, env.FIREBASE_PROJECT_ID, { fetchFn });
  await exigirPersonalActivo(token, datos.sub, env, fetchFn);

  if (!claveValida(clave)) throw new HttpError(400, 'Nombre de archivo no válido');
  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS[tipo]) throw new HttpError(415, 'Tipo de archivo no permitido');
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) throw new HttpError(413, 'El archivo supera 20 MB');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) throw new HttpError(400, 'Archivo vacío');
  if (bytes.byteLength > MAX_BYTES) throw new HttpError(413, 'El archivo supera 20 MB');
  if (!firmaCoincide(bytes, tipo)) throw new HttpError(415, 'El contenido no corresponde al tipo declarado');
  if (await env.BUCKET.head(clave)) throw new HttpError(409, 'Ya existe un archivo con ese nombre');

  await env.BUCKET.put(clave, bytes, {
    httpMetadata: { contentType: tipo, contentDisposition: TIPOS[tipo].enLinea ? 'inline' : 'attachment' },
    customMetadata: { uid: datos.sub, subido: new Date().toISOString() },
  });
  return { url: `${env.PUBLIC_BASE_URL}/${clave}`, clave };
}

async function descargar(env, clave, nombre) {
  if (!claveValida(clave)) throw new HttpError(400, 'Nombre de archivo no válido');
  const objeto = await env.BUCKET.get(clave);
  if (!objeto) throw new HttpError(404, 'No existe');
  const limpio = String(nombre || clave.split('/').pop()).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 150) || 'archivo';
  return new Response(objeto.body, {
    headers: {
      'Content-Type': objeto.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(limpio)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=300',
    },
  });
}

export async function manejar(request, env, { fetchFn = fetch } = {}) {
  const { ok, cabeceras } = cors(request, env);
  const responder = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cabeceras, 'Content-Type': 'application/json; charset=utf-8' } });
  try {
    if (!ok) throw new HttpError(403, 'Origen no permitido');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras });
    const url = new URL(request.url);
    const m = /^\/(archivo|descarga)\/(.+)$/.exec(decodeURIComponent(url.pathname));
    if (m && m[1] === 'archivo' && request.method === 'PUT') return responder(await subir(request, env, m[2], fetchFn), 201);
    if (m && m[1] === 'descarga' && request.method === 'GET') {
      const resp = await descargar(env, m[2], url.searchParams.get('nombre'));
      Object.entries(cabeceras).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }
    throw new HttpError(404, 'Ruta no encontrada');
  } catch (error) {
    if (error instanceof HttpError) return responder({ error: error.message }, error.status);
    if (error instanceof URIError) return responder({ error: 'Ruta no válida' }, 400);
    console.error(error);
    return responder({ error: 'Error interno' }, 500);
  }
}

export default { fetch: (request, env) => manejar(request, env) };
