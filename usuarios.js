/** Acceso a datos de usuarios (fichas de acceso) y solicitudes. Solo administradores. */
import { cambioDeUsuarioPermitido, puede } from '../core/permissions.js';
import { esClaveValida, limpiarTexto } from '../core/security.js';

function exigirAdmin(sesion) {
  if (!puede(sesion, 'usuarios.administrar')) {
    throw Object.assign(new Error('No tienes permiso para esta acción.'), { code: 'app/sin-permiso' });
  }
}

export function createUsuariosRepo(backend) {
  const clave = uid => {
    if (!esClaveValida(uid)) throw new Error('Identificador no válido');
    return uid;
  };
  return {
    observar(cb, onError) {
      const estado = { usuarios: null, solicitudes: null, perfiles: null };
      const emitir = () => cb({ usuarios: estado.usuarios || {}, solicitudes: estado.solicitudes || {}, perfiles: estado.perfiles || {} });
      const bajas = ['usuarios', 'solicitudes', 'perfiles'].map(ruta =>
        backend.db.subscribe(
          ruta,
          v => {
            estado[ruta] = v || {};
            emitir();
          },
          onError,
        ),
      );
      return () => bajas.forEach(b => b());
    },

    async guardar(sesion, uid, cambio, emailConocido = '') {
      exigirAdmin(sesion);
      if (!cambioDeUsuarioPermitido(sesion, uid, cambio)) {
        throw Object.assign(new Error('No puedes quitarte tu propio acceso de administrador.'), { code: 'app/sin-permiso' });
      }
      const datos = { actualizado: backend.db.now(), por: sesion.uid };
      if (cambio.rol !== undefined) datos.rol = cambio.rol;
      if (cambio.activo !== undefined) datos.activo = cambio.activo === true;
      if (emailConocido) datos.email = limpiarTexto(emailConocido, 120);
      await backend.db.update(`usuarios/${clave(uid)}`, datos);
    },

    /** Activa una cuenta que lo solicitó y retira la solicitud. */
    async aprobar(sesion, uid, rol, email) {
      await this.guardar(sesion, uid, { rol, activo: true }, email);
      await backend.db.remove(`solicitudes/${clave(uid)}`);
    },

    async descartarSolicitud(sesion, uid) {
      exigirAdmin(sesion);
      await backend.db.remove(`solicitudes/${clave(uid)}`);
    },
  };
}
