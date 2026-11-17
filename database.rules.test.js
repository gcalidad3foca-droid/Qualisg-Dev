/**
 * Pruebas de las reglas de Realtime Database con un simulador (targaryen).
 * Cada caso es una pregunta concreta: «¿puede X hacer Y?».
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const targaryen = createRequire(import.meta.url)('targaryen');
const rules = JSON.parse(readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8'));

const datos = {
  usuarios: {
    adm: { rol: 'admin', activo: true },
    ges: { rol: 'gestor', activo: true },
    aud: { rol: 'auditor', activo: true },
    lec: { rol: 'lector', activo: true },
    baja: { rol: 'admin', activo: false },
  },
  perfiles: { aud: { nombre: 'Ana' }, ges: { nombre: 'Gabo' } },
  solicitudes: { vieja: { email: 'v@x.co', creada: 1 } },
  auditorias: {
    'AUD-1': { uid: 'aud', institucion: 'foca', estado: 'en-progreso', sede: 'Norte' },
    'AUD-2': { uid: 'ges', institucion: 'viu', estado: 'completada', porcentaje: 90 },
  },
  auditorias_pi: {
    'PI-STAFF': { tipo: 'paciente-incognito', uid: 'aud', email: 'aud@x.co', auditorNombre: 'Ana', institucion: 'foca', estado: 'en-progreso' },
    'PI-QR-1': { tipo: 'paciente-incognito', origen: 'qr-paciente', institucion: 'foca', estado: 'en-progreso' },
    'PI-QR-2': { tipo: 'paciente-incognito', origen: 'qr-paciente', institucion: 'foca', estado: 'completada', porcentaje: 80 },
    'PI-QR-3': { tipo: 'paciente-incognito', origen: 'qr-paciente', institucion: 'foca', estado: 'en-progreso', deletedAt: 5 },
  },
  gdoc: { admins: { adm: true }, foca: { docs: { d1: { titulo: 'x' } } } },
  indicadores: { i1: { nombre: 'x' } },
};

const db = targaryen.database(rules, datos);
const como = uid => db.as(uid ? { uid, token: { email: `${uid}@x.co` } } : null);
const NADIE = null;
const FANTASMA = 'sin-ficha'; // cuenta de Firebase Auth sin ficha en `usuarios`

const lee = (uid, ruta) => como(uid).read(ruta).allowed;
const escribe = (uid, ruta, valor) => como(uid).write(ruta, valor).allowed;
const actualiza = (uid, ruta, cambios) => como(uid).update(ruta, cambios).allowed;
const si = (cond, nota) => assert.equal(cond, true, `debería permitirse: ${nota}`);
const no = (cond, nota) => assert.equal(cond, false, `debería negarse: ${nota}`);

const nueva = uid => ({ uid, email: `${uid}@x.co`, auditorNombre: 'N', auditorCargo: 'Auditor', institucion: 'foca', sede: '', fecha: '2026-11-16', estado: 'en-progreso', createdAt: 1, updatedAt: 1 });

test('sin sesión o sin ficha activa no se lee ni se escribe nada del sistema', () => {
  for (const quien of [NADIE, FANTASMA, 'baja']) {
    for (const ruta of ['/', 'usuarios', 'usuarios/adm', 'perfiles', 'auditorias', 'auditorias/AUD-1', 'auditorias_pi', 'gdoc', 'indicadores', 'solicitudes']) {
      no(lee(quien, ruta), `${quien} lee ${ruta}`);
    }
    no(escribe(quien, 'auditorias/AUD-9999', nueva(quien || 'x')), `${quien} crea auditoría`);
    no(actualiza(quien, 'auditorias/AUD-1', { sede: 'hack' }), `${quien} edita auditoría`);
    no(escribe(quien, 'auditorias/AUD-1', null), `${quien} borra auditoría`);
    no(escribe(quien, 'indicadores/i1', { nombre: 'y' }), `${quien} escribe indicadores`);
    no(escribe(quien, 'gdoc/admins/x', true), `${quien} se hace admin de documentos`);
  }
  no(escribe(NADIE, '/', { usuarios: {} }), 'borrado total anónimo');
});

test('usuarios: solo el admin gestiona fichas; nadie se auto-asciende', () => {
  si(lee('adm', 'usuarios'), 'admin lista usuarios');
  no(lee('ges', 'usuarios'), 'gestor lista usuarios');
  si(lee('aud', 'usuarios/aud'), 'cada quien lee su ficha');
  no(lee('aud', 'usuarios/ges'), 'leer ficha ajena');
  si(escribe('adm', 'usuarios/nuevo', { rol: 'auditor', activo: true, email: 'n@x.co', actualizado: 1, por: 'adm' }), 'admin crea ficha');
  for (const quien of ['ges', 'aud', 'lec', FANTASMA, 'baja']) {
    no(escribe(quien, `usuarios/${quien}`, { rol: 'admin', activo: true }), `${quien} se hace admin`);
    no(actualiza(quien, `usuarios/${quien}`, { rol: 'admin' }), `${quien} cambia su rol`);
  }
  no(escribe('adm', 'usuarios/x', { rol: 'dios', activo: true }), 'rol inventado');
  no(escribe('adm', 'usuarios/x', { rol: 'lector', activo: 'si' }), 'activo no booleano');
  no(escribe('adm', 'usuarios/x', { rol: 'lector', activo: true, extra: 1 }), 'campo desconocido');
  no(actualiza('adm', 'usuarios/adm', { rol: 'lector' }), 'admin se degrada');
  no(actualiza('adm', 'usuarios/adm', { activo: false }), 'admin se desactiva');
  no(escribe('adm', 'usuarios/adm', null), 'admin borra su ficha');
  si(actualiza('adm', 'usuarios/ges', { activo: false }), 'admin desactiva a otro');
});

test('solicitudes: solo-creación, con el correo propio', () => {
  si(escribe(FANTASMA, `solicitudes/${FANTASMA}`, { email: `${FANTASMA}@x.co`, creada: 1 }), 'cuenta nueva deja solicitud');
  no(escribe(FANTASMA, `solicitudes/${FANTASMA}`, { email: 'otro@x.co', creada: 1 }), 'solicitud con correo ajeno');
  no(escribe(FANTASMA, 'solicitudes/otro', { email: `${FANTASMA}@x.co`, creada: 1 }), 'solicitud a nombre de otro');
  no(escribe('vieja', 'solicitudes/vieja', { email: 'vieja@x.co', creada: 2 }), 'reescribir solicitud');
  no(escribe(NADIE, 'solicitudes/x', { email: 'a@x.co', creada: 1 }), 'solicitud anónima');
  si(escribe('adm', 'solicitudes/vieja', null), 'admin descarta');
  no(escribe('ges', 'solicitudes/vieja', null), 'gestor descarta');
  no(lee('ges', 'solicitudes'), 'gestor lista solicitudes');
});

test('perfiles: el personal lee; cada quien edita el suyo', () => {
  si(lee('lec', 'perfiles'), 'lector lee perfiles');
  si(actualiza('aud', 'perfiles/aud', { nombre: 'Ana María', avatarUrl: 'https://pub.r2.dev/a.png' }), 'edita su perfil');
  no(actualiza('aud', 'perfiles/ges', { nombre: 'Robado' }), 'edita perfil ajeno');
  si(actualiza('adm', 'perfiles/ges', { cargo: 'Gestor' }), 'admin edita perfil');
  no(actualiza('aud', 'perfiles/aud', { avatarUrl: 'javascript:alert(1)' }), 'avatar con javascript:');
  no(actualiza('aud', 'perfiles/aud', { nombre: 'x'.repeat(81) }), 'nombre demasiado largo');
});

test('auditorías de servicio: dueño o admin; el dueño no se puede cambiar', () => {
  for (const quien of ['adm', 'ges', 'aud', 'lec']) si(lee(quien, 'auditorias'), `${quien} lee`);
  si(escribe('aud', 'auditorias/AUD-20261116-ABCD2345', nueva('aud')), 'auditor crea la suya');
  no(escribe('aud', 'auditorias/AUD-20261116-ABCD2345', nueva('ges')), 'crear a nombre de otro');
  no(escribe('lec', 'auditorias/AUD-20261116-ABCD2345', nueva('lec')), 'lector crea');
  no(escribe('aud', 'auditorias/AUD 1!', nueva('aud')), 'clave con caracteres no admitidos');
  no(escribe('aud', 'auditorias/ab', nueva('aud')), 'clave demasiado corta');
  no(escribe('aud', 'auditorias/AUD-X1', { ...nueva('aud'), institucion: 'otra' }), 'institución inventada');
  no(escribe('aud', 'auditorias/AUD-X1', { ...nueva('aud'), porcentaje: 150 }), 'porcentaje fuera de rango');
  no(escribe('aud', 'auditorias/AUD-X1', { ...nueva('aud'), sede: 's'.repeat(201) }), 'sede demasiado larga');

  // Lo que escriben las listas de verificación
  si(actualiza('aud', 'auditorias/AUD-1', { porcentaje: 87, estado: 'en-progreso', sede: 'Sur', fecha: '2026-11-16', updatedAt: 2 }), 'la lista guarda avance');
  si(escribe('aud', 'auditorias/AUD-1/draft', { r: { a1: 'C' }, cloudPhotos: {}, updatedAt: 2 }), 'la lista guarda borrador');
  si(actualiza('aud', 'auditorias/AUD-1', { deletedAt: 5 }), 'dueño envía a papelera');
  si(escribe('aud', 'auditorias/AUD-1', null), 'dueño borra');

  no(actualiza('aud', 'auditorias/AUD-2', { sede: 'x' }), 'auditor edita ajena');
  no(actualiza('ges', 'auditorias/AUD-1', { sede: 'x' }), 'gestor edita ajena');
  no(escribe('aud', 'auditorias/AUD-2', null), 'auditor borra ajena');
  no(actualiza('lec', 'auditorias/AUD-1', { sede: 'x' }), 'lector edita');
  no(actualiza('aud', 'auditorias/AUD-1', { uid: 'ges' }), 'regalar la auditoría a otro');
  no(actualiza('aud', 'auditorias/AUD-2', { uid: 'aud' }), 'apropiarse de una ajena');
  si(actualiza('adm', 'auditorias/AUD-2', { sede: 'Corregida' }), 'admin edita cualquiera');
  si(escribe('adm', 'auditorias/AUD-2', null), 'admin borra cualquiera');
});

test('paciente incógnito: carril público acotado para la encuesta por QR', () => {
  const qr = { tipo: 'paciente-incognito', institucion: 'foca', origen: 'qr-paciente', sede: '', fecha: '2026-11-16', horaInicio: '10:30', estado: 'en-progreso', createdAt: 1, updatedAt: 1 };
  si(escribe(NADIE, 'auditorias_pi/PI-FOCA-20261116-1234', qr), 'paciente crea su encuesta');
  si(lee(NADIE, 'auditorias_pi/PI-QR-1'), 'paciente retoma su encuesta abierta');
  si(lee(NADIE, 'auditorias_pi/PI-NO-EXISTE'), 'consultar un id libre');
  si(actualiza(NADIE, 'auditorias_pi/PI-QR-1', { estado: 'completada', porcentaje: 88, sede: 'Norte', resultadosPorMomento: { m1: 90 }, updatedAt: 3 }), 'paciente finaliza');
  si(actualiza(NADIE, 'auditorias_pi/PI-STAFF', { sede: 'Norte', porcentaje: 70, estado: 'en-progreso' }), 'lista abierta por el equipo guarda avance');

  no(lee(NADIE, 'auditorias_pi'), 'listar encuestas sin sesión');
  no(lee(NADIE, 'auditorias_pi/PI-QR-2'), 'leer encuesta ya completada');
  no(actualiza(NADIE, 'auditorias_pi/PI-QR-2', { porcentaje: 100 }), 'alterar encuesta completada');
  no(actualiza(NADIE, 'auditorias_pi/PI-QR-3', { sede: 'x' }), 'alterar encuesta en papelera');
  no(escribe(NADIE, 'auditorias_pi/PI-QR-1', null), 'borrar sin sesión');
  no(actualiza(NADIE, 'auditorias_pi/PI-QR-1', { deletedAt: 1 }), 'enviar a papelera sin sesión');
  no(escribe(NADIE, 'auditorias_pi/PI-X1', { ...qr, uid: 'adm' }), 'crear a nombre de un usuario');
  no(actualiza(NADIE, 'auditorias_pi/PI-STAFF', { uid: 'otro' }), 'cambiar el dueño');
  no(actualiza(NADIE, 'auditorias_pi/PI-STAFF', { auditorNombre: '<script>' }), 'cambiar el nombre del auditor');
  no(escribe(NADIE, 'auditorias_pi/PI-X1', { ...qr, tipo: 'otro' }), 'tipo distinto');
  no(escribe(NADIE, 'auditorias_pi/PI-X1', { ...qr, porcentaje: 500 }), 'porcentaje fuera de rango');
  no(escribe(NADIE, 'auditorias_pi/PI-X1', { ...qr, sede: 's'.repeat(201) }), 'sede demasiado larga');

  si(lee('lec', 'auditorias_pi'), 'personal lista');
  si(escribe('aud', 'auditorias_pi/PI-20261116-ABCD2345', { tipo: 'paciente-incognito', ...nueva('aud') }), 'auditor crea PI');
  si(actualiza('ges', 'auditorias_pi/PI-QR-2', { deletedAt: 9 }), 'gestor envía a papelera una de QR');
  si(escribe('ges', 'auditorias_pi/PI-QR-3', null), 'gestor borra una de QR');
  no(actualiza('aud', 'auditorias_pi/PI-QR-2', { deletedAt: 9 }), 'auditor elimina una de QR completada');
  no(actualiza('lec', 'auditorias_pi/PI-QR-2', { deletedAt: 9 }), 'lector elimina');
});

test('módulos clásicos: personal lee, lector no escribe, admins de documentos protegidos', () => {
  si(lee('lec', 'indicadores'), 'lector lee indicadores');
  si(escribe('aud', 'indicadores/i2', { nombre: 'n' }), 'auditor escribe indicadores');
  no(escribe('lec', 'indicadores/i2', { nombre: 'n' }), 'lector escribe indicadores');
  si(escribe('ges', 'gdoc/foca/docs/d2', { titulo: 't' }), 'gestor escribe documentos');
  no(escribe('lec', 'gdoc/foca/docs/d2', { titulo: 't' }), 'lector escribe documentos');
  for (const quien of ['ges', 'aud', 'lec']) no(escribe(quien, `gdoc/admins/${quien}`, true), `${quien} se declara admin de documentos`);
  si(escribe('adm', 'gdoc/admins/ges', true), 'admin nombra admin de documentos');
  no(escribe('adm', 'nodo_nuevo/x', 1), 'nodo no declarado');
});
