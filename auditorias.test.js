import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryBackend } from '../../src/core/backend/memory.js';
import { createAuditoriasRepo } from '../../src/data/auditorias.js';
import { createUsuariosRepo } from '../../src/data/usuarios.js';
import { aLista, delMes, estadisticas, fechaCorta, fechaLocal, filtrar, nivel, nuevaAuditoria, nuevoId, porcentajeValido, visiblesPara } from '../../src/modules/auditorias/model.js';

const sesion = (rol, uid = 'u1') => ({ uid, rol, activo: true, email: `${uid}@x.co`, nombre: 'Ana', cargo: '' });

test('identificadores y fechas', () => {
  const f = new Date(2026, 10, 16, 23, 30);
  assert.equal(fechaLocal(f), '2026-11-16');
  assert.match(nuevoId('servicio', f), /^AUD-20261116-[A-Z2-9]{8}$/);
  assert.match(nuevoId('pi', f), /^PI-20261116-[A-Z2-9]{8}$/);
  assert.equal(fechaCorta('2026-11-06'), '6 nov 2026');
  assert.equal(fechaCorta('<b>'), '—');
  assert.equal(fechaCorta('2026-13-01'), '—');
});

test('nuevaAuditoria conserva el esquema que leen las listas', () => {
  const a = nuevaAuditoria('servicio', { sesion: sesion('auditor'), institucion: 'foca', ahora: 1000, fecha: new Date(2026, 0, 5) });
  assert.deepEqual(a, { uid: 'u1', email: 'u1@x.co', auditorNombre: 'Ana', auditorCargo: 'Auditor', institucion: 'foca', sede: '', fecha: '2026-01-05', estado: 'en-progreso', porcentaje: null, createdAt: 1000, updatedAt: 1000 });
  assert.equal(nuevaAuditoria('pi', { sesion: sesion('auditor'), institucion: 'viu', ahora: 1 }).tipo, 'paciente-incognito');
});

test('porcentaje y nivel', () => {
  assert.equal(porcentajeValido('87.6'), 88);
  for (const malo of [null, undefined, '', 'abc', -1, 101, NaN, Infinity, {}, '<b>']) assert.equal(porcentajeValido(malo), null);
  assert.deepEqual([null, 92, 91, 85, 84].map(nivel), ['nd', 'alto', 'medio', 'medio', 'bajo']);
});

const nodo = {
  a: { uid: 'u1', estado: 'en-progreso', porcentaje: 80, createdAt: 3, fecha: '2026-11-02' },
  b: { uid: 'u1', estado: 'completada', porcentaje: 100, createdAt: 5, fecha: '2026-10-30' },
  c: { uid: 'u1', estado: 'completada', porcentaje: 50, createdAt: 4, deletedAt: 9, fecha: '2026-11-03' },
  d: { uid: 'u2', estado: 'completada', porcentaje: 90, createdAt: 6 },
  e: { tipo: 'paciente-incognito', origen: 'qr-paciente', createdAt: 1 },
  basura: 'texto',
};

test('aLista ordena, descarta basura y normaliza', () => {
  const l = aLista(nodo);
  assert.deepEqual(l.map(x => x.id), ['d', 'b', 'c', 'a', 'e']);
  assert.deepEqual(aLista(null), []);
  assert.equal(aLista({ x: { id: 'falso', porcentaje: '200' } })[0].id, 'x');
  assert.equal(aLista({ x: { porcentaje: '200' } })[0].porcentaje, null);
});

test('visibilidad, filtros y estadísticas', () => {
  const l = aLista(nodo);
  const mias = visiblesPara(l, 'servicio', 'u1');
  assert.deepEqual(mias.map(x => x.id), ['b', 'c', 'a']);
  assert.deepEqual(visiblesPara(l, 'pi', 'u9').map(x => x.id), ['e']);
  assert.deepEqual(filtrar(mias, 'todas').map(x => x.id), ['b', 'a']);
  assert.deepEqual(filtrar(mias, 'completada').map(x => x.id), ['b']);
  assert.deepEqual(filtrar(mias, 'papelera').map(x => x.id), ['c']);
  assert.deepEqual(estadisticas(mias), { total: 2, enProgreso: 1, completadas: 1, promedio: 90, enPapelera: 1 });
  assert.equal(estadisticas([]).promedio, null);
  assert.equal(delMes(mias, new Date(2026, 10, 16)), 1);
});

test('repositorio: crear, papelera, restaurar y borrar respetan permisos', async () => {
  const backend = createMemoryBackend({ reloj: () => 5000 });
  const repo = createAuditoriasRepo(backend);
  const ana = sesion('auditor', 'ana');
  const id = await repo.crear('servicio', ana, 'foca');
  let a = { id, ...(await backend.db.get(`auditorias/${id}`)) };
  assert.equal(a.uid, 'ana');

  await assert.rejects(repo.crear('servicio', sesion('lector'), 'foca'), { code: 'app/sin-permiso' });
  await assert.rejects(repo.crear('servicio', ana, 'otra'), /Institución/);
  await assert.rejects(repo.enviarAPapelera('servicio', sesion('auditor', 'beto'), a), { code: 'app/sin-permiso' });
  await assert.rejects(repo.eliminarDefinitivo('servicio', ana, a), /papelera/);
  await assert.rejects(repo.enviarAPapelera('servicio', ana, { ...a, id: '../usuarios' }), /no válido/);

  await repo.enviarAPapelera('servicio', ana, a);
  a = { id, ...(await backend.db.get(`auditorias/${id}`)) };
  assert.equal(a.deletedAt, 5000);
  await repo.restaurar('servicio', ana, a);
  assert.equal((await backend.db.get(`auditorias/${id}`)).deletedAt, undefined);

  await repo.enviarAPapelera('servicio', ana, a);
  await backend.db.set('auditorias/ajena', { uid: 'beto', deletedAt: 1 });
  const lista = aLista(await backend.db.get('auditorias'));
  assert.equal(await repo.vaciarPapelera('servicio', ana, lista), 1);
  assert.deepEqual(Object.keys(await backend.db.get('auditorias')), ['ajena']);
});

test('repositorio de usuarios: solo admin, y no puede degradarse', async () => {
  const backend = createMemoryBackend({ datos: { solicitudes: { nuevo: { email: 'n@x.co' } } }, reloj: () => 7 });
  const repo = createUsuariosRepo(backend);
  const admin = sesion('admin', 'adm');
  await assert.rejects(repo.aprobar(sesion('gestor'), 'nuevo', 'auditor', 'n@x.co'), { code: 'app/sin-permiso' });
  await assert.rejects(repo.guardar(admin, 'adm', { rol: 'lector' }), { code: 'app/sin-permiso' });
  await assert.rejects(repo.guardar(admin, 'nuevo', { rol: 'root' }), { code: 'app/sin-permiso' });
  await assert.rejects(repo.guardar(admin, 'a/b', { rol: 'lector' }), /no válido/);
  await repo.aprobar(admin, 'nuevo', 'auditor', 'n@x.co');
  assert.deepEqual(await backend.db.get('usuarios/nuevo'), { actualizado: 7, por: 'adm', rol: 'auditor', activo: true, email: 'n@x.co' });
  assert.equal(await backend.db.get('solicitudes/nuevo'), null);
});
