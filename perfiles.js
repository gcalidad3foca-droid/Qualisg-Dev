/** Lectura de perfiles (nombre, cargo, foto). Todo usuario activo puede leerlos. */
export function createPerfilesRepo(backend) {
  return {
    observar: (cb, onError) => backend.db.subscribe('perfiles', nodo => cb(nodo && typeof nodo === 'object' ? nodo : {}), onError),
  };
}
