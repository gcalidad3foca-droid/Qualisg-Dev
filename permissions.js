/**
 * Roles y permisos. Es la misma matriz que aplican las reglas de Firebase
 * (firebase/database.rules.json): la interfaz oculta lo que el servidor rechazaría.
 */

export const ROLES = Object.freeze({
  admin: { etiqueta: 'Administrador', descripcion: 'Gestiona usuarios y todos los registros' },
  gestor: { etiqueta: 'Gestor de calidad', descripcion: 'Crea y gestiona auditorías; administra las de paciente incógnito' },
  auditor: { etiqueta: 'Auditor', descripcion: 'Crea y diligencia sus propias auditorías' },
  lector: { etiqueta: 'Lector', descripcion: 'Solo consulta' },
});

export const INSTITUCIONES = Object.freeze(['foca', 'viu']);

export function esRolValido(rol) {
  return Object.prototype.hasOwnProperty.call(ROLES, rol);
}

/** Un usuario es válido si existe su ficha, está activo y su rol es conocido. */
export function sesionActiva(usuario) {
  return !!usuario && usuario.activo === true && esRolValido(usuario.rol);
}

const esAdmin = s => sesionActiva(s) && s.rol === 'admin';
const puedeEscribir = s => sesionActiva(s) && s.rol !== 'lector';

function esDuenio(sesion, registro) {
  return !!registro && !!sesion && registro.uid === sesion.uid;
}

/** Registros que llegan por QR no tienen dueño: los administran gestor y admin. */
function sinDuenio(registro) {
  return !!registro && !registro.uid;
}

const REGLAS = {
  'auditoria.ver': s => sesionActiva(s),
  'auditoria.crear': s => puedeEscribir(s),
  'auditoria.editar': (s, r) =>
    puedeEscribir(s) && (esAdmin(s) || esDuenio(s, r) || (sinDuenio(r) && s.rol === 'gestor')),
  'auditoria.eliminar': (s, r) =>
    puedeEscribir(s) && (esAdmin(s) || esDuenio(s, r) || (sinDuenio(r) && s.rol === 'gestor')),
  'perfil.editar': (s, r) => sesionActiva(s) && (esAdmin(s) || (!!r && r.uid === s.uid)),
  'equipo.ver': s => sesionActiva(s) && (s.rol === 'admin' || s.rol === 'gestor'),
  'usuarios.administrar': s => esAdmin(s),
};

export function puede(sesion, accion, registro) {
  const regla = REGLAS[accion];
  if (!regla) return false;
  return regla(sesion, registro) === true;
}

/** Un admin no puede quitarse a sí mismo el rol ni desactivarse (evita quedar sin administradores). */
export function cambioDeUsuarioPermitido(sesion, uidObjetivo, cambio) {
  if (!esAdmin(sesion)) return false;
  if (cambio.rol !== undefined && !esRolValido(cambio.rol)) return false;
  if (uidObjetivo === sesion.uid) {
    if (cambio.rol !== undefined && cambio.rol !== 'admin') return false;
    if (cambio.activo === false) return false;
  }
  return true;
}
