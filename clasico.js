/** Vista puente para módulos que todavía no se han migrado. */
import { APP } from '../config.js';
import { html, render } from '../core/security.js';
import { icon } from '../ui/icons.js';

export function mount(el, ctx) {
  const m = ctx.modulo;
  render(
    el,
    html`<header class="top">
        <div>
          <h1>${m.nombre}</h1>
          <p>${m.descripcion || ''}</p>
        </div>
      </header>
      <section class="card puente">
        <span class="tile lav">${icon(m.icono)}</span>
        <h2>Este módulo sigue en la versión clásica</h2>
        <p>Se está trasladando a la nueva plataforma. Mientras tanto funciona igual que siempre y con los mismos datos.</p>
        <a class="btn pri" href="${APP.urlClasica}" target="_blank" rel="noopener">Abrir versión clásica ${icon('externo')}</a>
      </section>`,
  );
  return () => {};
}
