/** Utilidades de DOM: delegación de eventos y pequeños ayudantes. */

/**
 * Delegación por atributo: <button data-action="nombre" data-id="…">.
 * Sustituye a los `onclick` en línea (incompatibles con la CSP).
 */
export function delegar(raiz, tipo, acciones) {
  const manejar = evento => {
    const origen = evento.target.closest('[data-action]');
    if (!origen || !raiz.contains(origen)) return;
    const accion = acciones[origen.dataset.action];
    if (accion) accion(origen, evento);
  };
  raiz.addEventListener(tipo, manejar);
  return () => raiz.removeEventListener(tipo, manejar);
}

/** Deshabilita el botón mientras dura la tarea: evita envíos dobles. */
export async function conBloqueo(boton, tarea) {
  if (!boton || boton.disabled) return undefined;
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
  }
}

/** Si la imagen no carga, se oculta y queda visible el respaldo del contenedor. */
export function protegerImagenes(raiz) {
  raiz.addEventListener(
    'error',
    e => {
      if (e.target instanceof HTMLImageElement) e.target.hidden = true;
    },
    true,
  );
}

export function iniciales(nombre) {
  const p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p.at(-1)[0] : '')).toUpperCase() || '?';
}
