import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryBackend } from '../../src/core/backend/memory.js';
import { createRouter, parseRuta } from '../../src/core/router.js';
import { createSession, mensajeDeAuth, nombreDesdeEmail, vigilarInactividad } from '../../src/core/session.js';

const espera = () => new Promise(r => setTimeout(r, 5));

test('parseRuta', () => {
  assert.deepEqual(parseRuta('#/auditorias/pi/nueva'), { modulo: 'auditorias', sub: 'pi', resto: ['pi', 'nueva'] });
  assert.deepEqual(parseRuta(''), { modulo: '', sub: '', resto: [] });
  assert.equal(parseRuta('#/a%20b').modulo, 'a b');
});

test('router usa la ruta por defecto y reacciona al hash', () => {
  const escuchas = {};
  const ventana = { location: { hash: '' }, addEventListener: (t, f) => (escuchas[t] = f), removeEventListener: t => delete escuchas[t] };
  const vistas = [];
  const r = createRouter({ ventana, porDefecto: '#/inicio', alCambiar: x => vistas.push(x.modulo) });
  r.iniciar();
  r.ir('auditorias/pi');
  assert.equal(ventana.location.hash, '#/auditorias/pi');
  escuchas.hashchange();
  assert.deepEqual(vistas, ['inicio', 'auditorias']);
  r.destroy();
  assert.equal(escuchas.hashchange, undefined);
});

test('nombreDesdeEmail y mensajes de ingreso', () => {
  assert.equal(nombreDesdeEmail('luis.angel_bolaño@foca.co'), 'Luis Angel Bolaño');
  assert.equal(mensajeDeAuth({ code: 'auth/user-not-found' }), mensajeDeAuth({ code: 'auth/wrong-password' }));
  assert.ok(!/internal/.test(mensajeDeAuth({ code: 'auth/internal-error', message: 'internal stack' })));
});

test('sesión: anónimo → pendiente (deja solicitud) → activo → revocado', async () => {
  const backend = createMemoryBackend({
    usuarios: [{ uid: 'u1', email: 'ana@x.co', clave: 'secreta' }],
    datos: { perfiles: { u1: { nombre: 'Ana <b>María</b>', avatarUrl: 5 } } },
    reloj: () => 42,
  });
  const fases = [];
  let ultima;
  const s = createSession(backend, { onChange: e => { fases.push(e.fase); ultima = e.sesion; } });
  await espera();
  assert.deepEqual(fases, ['anonimo']);

  await assert.rejects(s.signIn('ana@x.co', 'mala'), { code: 'auth/invalid-credential' });
  await s.signIn(' ana@x.co ', 'secreta');
  await espera();
  assert.equal(fases.at(-1), 'pendiente');
  assert.deepEqual(await backend.db.get('solicitudes/u1'), { email: 'ana@x.co', creada: 42 });
  assert.equal(ultima.nombre, 'Ana <b>María</b>');
  assert.equal(ultima.avatarUrl, '');

  await backend.db.set('usuarios/u1', { rol: 'auditor', activo: true });
  await espera();
  assert.equal(fases.at(-1), 'activo');
  assert.equal(ultima.rol, 'auditor');

  await backend.db.update('usuarios/u1', { activo: false });
  await espera();
  assert.equal(fases.at(-1), 'pendiente');

  await backend.db.set('usuarios/u1', { rol: 'inventado', activo: true });
  await espera();
  assert.equal(fases.at(-1), 'pendiente');

  await s.signOut();
  await espera();
  assert.equal(fases.at(-1), 'anonimo');
  s.destroy();
});

test('inactividad: expira tras el límite y se reinicia con actividad', () => {
  let ahora = 0;
  let pendiente = null;
  const temporizador = { setTimeout: (f, ms) => (pendiente = { f, en: ahora + ms }), clearTimeout: () => (pendiente = null) };
  const escuchas = {};
  const objetivo = { addEventListener: (t, f) => (escuchas[t] = f), removeEventListener: t => delete escuchas[t] };
  let expiro = 0;
  const parar = vigilarInactividad({ minutos: 30, alExpirar: () => expiro++, objetivo, temporizador });
  assert.equal(pendiente.en, 30 * 60_000);
  ahora = 10 * 60_000;
  escuchas.keydown();
  assert.equal(pendiente.en, 40 * 60_000);
  pendiente.f();
  assert.equal(expiro, 1);
  parar();
  assert.equal(pendiente, null);
  assert.deepEqual(Object.keys(escuchas), []);
});
