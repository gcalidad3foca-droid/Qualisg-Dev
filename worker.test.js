import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import { _vaciarCache, claveValida, firmaCoincide, manejar, verificarToken } from '../../worker/src/index.js';

const PROYECTO = 'qualisig-auditorias';
const ORIGEN = 'https://qualisig.co';
const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
let par, otroPar, jwk;

async function firmar(datos, { llave = par.privateKey, cabecera = { alg: 'RS256', kid: 'k1' } } = {}) {
  const cuerpo = `${b64(cabecera)}.${b64(datos)}`;
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(cuerpo));
  return `${cuerpo}.${Buffer.from(firma).toString('base64url')}`;
}
const seg = () => Math.floor(Date.now() / 1000);
const validos = (extra = {}) => ({ aud: PROYECTO, iss: `https://securetoken.google.com/${PROYECTO}`, sub: 'u1', iat: seg() - 10, exp: seg() + 3600, ...extra });

function entorno(fichas = { u1: { rol: 'auditor', activo: true } }) {
  const objetos = new Map();
  const fetchFn = async url => {
    if (String(url).includes('googleapis.com')) return new Response(JSON.stringify({ keys: [jwk] }));
    const uid = /usuarios\/([^.]+)\.json/.exec(String(url))?.[1];
    return fichas[uid] ? new Response(JSON.stringify(fichas[uid])) : new Response('null', { status: fichas[uid] === undefined ? 401 : 200 });
  };
  const env = {
    FIREBASE_PROJECT_ID: PROYECTO, FIREBASE_DB_URL: 'https://db.example', PUBLIC_BASE_URL: 'https://pub.example', ALLOWED_ORIGINS: `${ORIGEN},https://otro.example`,
    BUCKET: {
      head: async k => (objetos.has(k) ? {} : null),
      put: async (k, v, o) => void objetos.set(k, { v, o }),
      get: async k => (objetos.has(k) ? { body: objetos.get(k).v, httpMetadata: objetos.get(k).o.httpMetadata } : null),
    },
  };
  return { env, fetchFn, objetos };
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const put = (token, { clave = 'indicadores/1_foto.png', tipo = 'image/png', cuerpo = PNG, origen = ORIGEN } = {}) =>
  new Request(`https://w.example/archivo/${clave}`, { method: 'PUT', body: cuerpo, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': tipo, ...(origen ? { Origin: origen } : {}) } });

before(async () => {
  const gen = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  [par, otroPar] = await Promise.all([gen(), gen()]);
  jwk = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid: 'k1' };
});
beforeEach(() => _vaciarCache());

test('verificarToken acepta uno válido y rechaza los manipulados', async () => {
  const { fetchFn } = entorno();
  assert.equal((await verificarToken(await firmar(validos()), PROYECTO, { fetchFn })).sub, 'u1');
  const casos = {
    vencido: await firmar(validos({ exp: seg() - 1 })),
    'otro proyecto': await firmar(validos({ aud: 'otro' })),
    'emisor falso': await firmar(validos({ iss: 'https://evil.example' })),
    'sin usuario': await firmar(validos({ sub: '' })),
    'firmado con otra llave': await firmar(validos(), { llave: otroPar.privateKey }),
    'kid desconocido': await firmar(validos(), { cabecera: { alg: 'RS256', kid: 'zz' } }),
    'alg none': `${b64({ alg: 'none', kid: 'k1' })}.${b64(validos())}.`,
    'alg HS256': await firmar(validos(), { cabecera: { alg: 'HS256', kid: 'k1' } }),
    basura: 'a.b.c',
    vacio: '',
  };
  const [c, d] = (await firmar(validos())).split('.');
  casos['datos alterados'] = `${c}.${b64(validos({ sub: 'admin' }))}.${d}`;
  for (const [nombre, token] of Object.entries(casos)) {
    await assert.rejects(verificarToken(token, PROYECTO, { fetchFn }), e => e.status === 401, nombre);
  }
});

test('claveValida limita carpetas y bloquea rutas', () => {
  for (const ok of ['indicadores/1731_informe.pdf', 'autoevaluacion-iso/1_a.b.docx', 'evidencias/u1/2026/x.png']) assert.ok(claveValida(ok), ok);
  for (const mal of ['otra/x.png', 'indicadores/../perfiles/x', 'indicadores/', '/indicadores/x', 'indicadores/.oculto', 'indicadores/a b.png', 'indicadores/x?y', 'indicadores//x', 'indicadores', `indicadores/${'a'.repeat(400)}`, null]) assert.ok(!claveValida(mal), String(mal));
});

test('firmaCoincide compara el contenido con el tipo declarado', () => {
  assert.ok(firmaCoincide(PNG, 'image/png'));
  assert.ok(!firmaCoincide(PNG, 'application/pdf'));
  assert.ok(!firmaCoincide(new TextEncoder().encode('<script>'), 'image/png'));
  assert.ok(firmaCoincide(new TextEncoder().encode('a,b\n1,2'), 'text/csv'));
  assert.ok(!firmaCoincide(new Uint8Array([77, 90, 0, 0]), 'text/plain'));
  assert.ok(!firmaCoincide(PNG, 'text/html'));
});

test('subida completa: guarda, no sobrescribe y devuelve la URL pública', async () => {
  const { env, fetchFn, objetos } = entorno();
  const token = await firmar(validos());
  const r = await manejar(put(token), env, { fetchFn });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { url: 'https://pub.example/indicadores/1_foto.png', clave: 'indicadores/1_foto.png' });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGEN);
  assert.equal(objetos.get('indicadores/1_foto.png').o.customMetadata.uid, 'u1');
  assert.equal((await manejar(put(token), env, { fetchFn })).status, 409);
});

test('subida rechazada: sin token, sin ficha, lector, origen ajeno, tipo y contenido', async () => {
  const fichas = { u1: { rol: 'auditor', activo: true }, lec: { rol: 'lector', activo: true }, baja: { rol: 'gestor', activo: false } };
  const { env, fetchFn, objetos } = entorno(fichas);
  const token = await firmar(validos());
  const esperar = async (req, status, nota) => assert.equal((await manejar(req, env, { fetchFn })).status, status, nota);
  await esperar(put(null), 401, 'sin token');
  await esperar(put(await firmar(validos({ sub: 'fantasma' }))), 403, 'sin ficha');
  await esperar(put(await firmar(validos({ sub: 'lec' }))), 403, 'lector');
  await esperar(put(await firmar(validos({ sub: 'baja' }))), 403, 'inactivo');
  await esperar(put(token, { origen: 'https://evil.example' }), 403, 'origen');
  await esperar(put(token, { tipo: 'text/html', cuerpo: '<script>1</script>' }), 415, 'html');
  await esperar(put(token, { tipo: 'image/svg+xml', cuerpo: '<svg/>' }), 415, 'svg');
  await esperar(put(token, { cuerpo: new TextEncoder().encode('MZ ejecutable') }), 415, 'contenido distinto');
  await esperar(put(token, { clave: 'secretos/x.png' }), 400, 'carpeta');
  await esperar(put(token, { clave: 'indicadores/%2e%2e/x.png' }), 400, 'ruta relativa');
  await esperar(new Request('https://w.example/archivo/indicadores/x.png', { method: 'DELETE', headers: { Origin: ORIGEN } }), 404, 'método');
  assert.equal(objetos.size, 0);
});

test('descarga con nombre saneado y preflight CORS', async () => {
  const { env, fetchFn } = entorno();
  await manejar(put(await firmar(validos())), env, { fetchFn });
  const r = await manejar(new Request('https://w.example/descarga/indicadores/1_foto.png?nombre=' + encodeURIComponent('Informe "final"\r\nX: 1.png'), { headers: { Origin: ORIGEN } }), env, { fetchFn });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Disposition'), "attachment; filename*=UTF-8''Informe%20_final___X_%201.png");
  assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal((await manejar(new Request('https://w.example/descarga/indicadores/nada.png'), env, { fetchFn })).status, 404);
  const pre = await manejar(new Request('https://w.example/archivo/indicadores/x.png', { method: 'OPTIONS', headers: { Origin: ORIGEN } }), env, { fetchFn });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});
