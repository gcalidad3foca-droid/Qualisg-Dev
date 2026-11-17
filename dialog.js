/**
 * Diálogos sobre <dialog> nativo: foco atrapado, Escape y fondo los maneja el navegador.
 */
import { SafeHtml, html, render } from '../core/security.js';
import { icon } from './icons.js';

/**
 * Abre un diálogo. `contenido` es SafeHtml. Los botones con [data-cerrar] lo cierran
 * devolviendo su valor. Devuelve { el, cerrar, resultado: Promise }.
 */
export function abrirDialogo({ titulo, descripcion = '', contenido = html``, clase = '' }) {
  if (!(contenido instanceof SafeHtml)) throw new TypeError('contenido debe ser SafeHtml');
  const el = document.createElement('dialog');
  el.className = `dlg ${clase}`.trim();
  render(
    el,
    html`<div class="dlg-in">
      <header class="dlg-h">
        <div>
          <h2>${titulo}</h2>
          ${descripcion ? html`<p>${descripcion}</p>` : ''}
        </div>
        <button type="button" class="iconbtn" data-cerrar="" aria-label="Cerrar">${icon('cerrar')}</button>
      </header>
      <div class="dlg-b">${contenido}</div>
    </div>`,
  );
  document.body.append(el);

  let resolver;
  const resultado = new Promise(r => (resolver = r));
  const cerrar = valor => {
    if (el.open) el.close(valor ?? '');
  };
  el.addEventListener('click', e => {
    if (e.target === el) return cerrar('');
    const boton = e.target.closest('[data-cerrar]');
    if (boton) cerrar(boton.dataset.cerrar);
  });
  el.addEventListener('close', () => {
    resolver(el.returnValue);
    el.remove();
  });
  el.showModal();
  return { el, cerrar, resultado };
}

/** Confirmación. Resuelve true solo si se pulsa el botón de confirmar. */
export async function confirmar({ titulo, descripcion, accion = 'Confirmar', peligro = false }) {
  const { resultado } = abrirDialogo({
    titulo,
    descripcion,
    clase: 'dlg-sm',
    contenido: html`<div class="dlg-f">
      <button type="button" class="btn" data-cerrar="">Cancelar</button>
      <button type="button" class="btn ${peligro ? 'dng solid' : 'pri'}" data-cerrar="si">${accion}</button>
    </div>`,
  });
  return (await resultado) === 'si';
}
