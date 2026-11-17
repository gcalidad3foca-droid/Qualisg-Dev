/**
 * Acceso a datos de auditorías. Único punto que escribe en `auditorias` y `auditorias_pi`.
 * Cada operación vuelve a comprobar el permiso: la interfaz puede fallar, esto no.
 */
import { INSTITUCIONES } from '../config.js';
import { puede } from '../core/permissions.js';
import { esClaveValida } from '../core/security.js';
import { TIPOS, aLista, nuevaAuditoria, nuevoId } from '../modules/auditorias/model.js';

class SinPermiso extends Error {
  constructor() {
    super('No tienes permiso para esta acción.');
    this.code = 'app/sin-permiso';
  }
}

export function createAuditoriasRepo(backend) {
  const ruta = (tipo, id) => {
    if (!TIPOS[tipo]) throw new Error('Tipo de auditoría desconocido');
    if (id !== undefined && !esClaveValida(id)) throw new Error('Identificador no válido');
    return id === undefined ? TIPOS[tipo].ruta : `${TIPOS[tipo].ruta}/${id}`;
  };
  const exigir = (sesion, accion, registro) => {
    if (!puede(sesion, accion, registro)) throw new SinPermiso();
  };

  return {
    observar: (tipo, cb, onError) => backend.db.subscribe(ruta(tipo), nodo => cb(aLista(nodo)), onError),

    async crear(tipo, sesion, institucion) {
      exigir(sesion, 'auditoria.crear');
      if (!INSTITUCIONES[institucion]) throw new Error('Institución no válida');
      const id = nuevoId(tipo);
      await backend.db.set(ruta(tipo, id), nuevaAuditoria(tipo, { sesion, institucion, ahora: backend.db.now() }));
      return id;
    },

    async enviarAPapelera(tipo, sesion, auditoria) {
      exigir(sesion, 'auditoria.eliminar', auditoria);
      await backend.db.update(ruta(tipo, auditoria.id), { deletedAt: backend.db.now() });
    },

    async restaurar(tipo, sesion, auditoria) {
      exigir(sesion, 'auditoria.eliminar', auditoria);
      await backend.db.update(ruta(tipo, auditoria.id), { deletedAt: null });
    },

    async eliminarDefinitivo(tipo, sesion, auditoria) {
      exigir(sesion, 'auditoria.eliminar', auditoria);
      if (!auditoria.deletedAt) throw new Error('Primero envíala a la papelera.');
      await backend.db.remove(ruta(tipo, auditoria.id));
    },

    /** Borra las que el usuario puede borrar; devuelve cuántas. */
    async vaciarPapelera(tipo, sesion, lista) {
      const propias = lista.filter(a => a.deletedAt && puede(sesion, 'auditoria.eliminar', a));
      await Promise.all(propias.map(a => backend.db.remove(ruta(tipo, a.id))));
      return propias.length;
    },
  };
}
