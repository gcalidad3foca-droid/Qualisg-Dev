/**
 * Enrutador por hash: `#/modulo/subvista`. Sin dependencias.
 */
export function parseRuta(hash) {
  const limpio = String(hash || '').replace(/^#\/?/, '');
  const [modulo = '', ...resto] = limpio.split('/').filter(Boolean).map(p => decodeURIComponent(p));
  return { modulo, sub: resto[0] || '', resto };
}

export function createRouter({ ventana = globalThis, porDefecto, alCambiar }) {
  const leer = () => {
    const ruta = parseRuta(ventana.location.hash);
    return ruta.modulo ? ruta : parseRuta(porDefecto);
  };
  const manejar = () => alCambiar(leer());
  ventana.addEventListener('hashchange', manejar);
  return {
    actual: leer,
    ir(ruta) {
      const destino = '#/' + String(ruta).replace(/^#?\/?/, '');
      if (ventana.location.hash === destino) manejar();
      else ventana.location.hash = destino;
    },
    iniciar: manejar,
    destroy: () => ventana.removeEventListener('hashchange', manejar),
  };
}
