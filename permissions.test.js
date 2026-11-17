import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cambioDeUsuarioPermitido, puede, sesionActiva } from '../../src/core/permissions.js';

const s = (rol, uid = `u-${rol}`, activo = true) => ({ uid, rol, activo });
const propia = { uid: 'u-auditor' };
const ajena = { uid: 'otro' };
const porQr = { origen: 'qr-paciente' };

test('sesión activa exige ficha, activo y rol conocido', () => {
  assert.ok(sesionActiva(s('admin')));
  assert.ok(!sesionActiva(null));
  assert.ok(!sesionActiva(s('auditor', 'x', false)));
  assert.ok(!sesionActiva({ uid: 'x', rol: 'superadmin', activo: true }));
  assert.ok(!sesionActiva({ uid: 'x', rol: 'toString', activo: true }));
  assert.ok(!sesionActiva({ uid: 'x', rol: 'admin', activo: 'true' }));
});

test('matriz de permisos de auditorías', () => {
  for (const rol of ['admin', 'gestor', 'auditor']) assert.ok(puede(s(rol), 'auditoria.crear'), rol);
  assert.ok(!puede(s('lector'), 'auditoria.crear'));
  assert.ok(puede(s('lector'), 'auditoria.ver'));

  assert.ok(puede(s('auditor'), 'auditoria.eliminar', propia));
  assert.ok(!puede(s('auditor'), 'auditoria.eliminar', ajena));
  assert.ok(!puede(s('gestor'), 'auditoria.eliminar', ajena));
  assert.ok(puede(s('admin'), 'auditoria.eliminar', ajena));

  assert.ok(puede(s('gestor'), 'auditoria.eliminar', porQr));
  assert.ok(puede(s('admin'), 'auditoria.eliminar', porQr));
  assert.ok(!puede(s('auditor'), 'auditoria.eliminar', porQr));
  assert.ok(!puede(s('lector', 'u-auditor'), 'auditoria.eliminar', propia));
});

test('sin sesión activa no se puede nada', () => {
  for (const accion of ['auditoria.ver', 'auditoria.crear', 'auditoria.editar', 'auditoria.eliminar', 'usuarios.administrar', 'perfil.editar']) {
    assert.ok(!puede(null, accion, propia), accion);
    assert.ok(!puede(s('admin', 'a', false), accion, propia), accion);
  }
  assert.ok(!puede(s('admin'), 'accion.inexistente'));
});

test('solo el admin administra usuarios y no puede dejarse sin acceso', () => {
  assert.ok(puede(s('admin'), 'usuarios.administrar'));
  assert.ok(!puede(s('gestor'), 'usuarios.administrar'));
  const admin = s('admin', 'a1');
  assert.ok(cambioDeUsuarioPermitido(admin, 'otro', { rol: 'gestor' }));
  assert.ok(cambioDeUsuarioPermitido(admin, 'otro', { activo: false }));
  assert.ok(!cambioDeUsuarioPermitido(admin, 'a1', { rol: 'gestor' }));
  assert.ok(!cambioDeUsuarioPermitido(admin, 'a1', { activo: false }));
  assert.ok(!cambioDeUsuarioPermitido(admin, 'otro', { rol: 'dios' }));
  assert.ok(!cambioDeUsuarioPermitido(s('gestor'), 'otro', { rol: 'lector' }));
});
