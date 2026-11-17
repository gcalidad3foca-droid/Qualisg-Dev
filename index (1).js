/** Auditorías: de servicio y de paciente incógnito. */
import { INSTITUCIONES } from '../../config.js';
import { puede } from '../../core/permissions.js';
import { html, render } from '../../core/security.js';
import { abrirDialogo, confirmar } from '../../ui/dialog.js';
import { conBloqueo, delegar } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { mensajeDeError, toast } from '../../ui/toast.js';
import { ESTADOS, TIPOS, estadisticas, fechaCorta, filtrar, visiblesPara } from './model.js';
import { institucionDe, logoInstitucion, pastillaNota, tituloAuditoria, urlLista } from './partes.js';

const ETIQUETA_FILTRO = { todas: 'Todas', 'en-progreso': 'En progreso', completada: 'Completadas', papelera: 'Papelera' };

export function mount(el, ctx) {
  const tipo = TIPOS[ctx.ruta.sub] ? ctx.ruta.sub : 'servicio';
  const def = TIPOS[tipo];
  const repo = ctx.repos.auditorias;
  let todas = null;
  let filtro = 'todas';

  const mias = () => (todas ? visiblesPara(todas, tipo, ctx.sesion.uid) : []);
  const buscar = id => mias().find(a => a.id === id);

  const stat = (tono, icono, valor, etiqueta) =>
    html`<div class="stat"><span class="tile ${tono}">${icon(icono)}</span><div><b>${valor}</b><span>${etiqueta}</span></div></div>`;

  const fila = a => {
    const s = ctx.sesion;
    const enPapelera = !!a.deletedAt;
    const completa = a.estado === 'completada';
    const borrable = puede(s, 'auditoria.eliminar', a);
    return html`<article class="item ${enPapelera ? 'gone' : ''}">
      ${logoInstitucion(institucionDe(a))}
      <div class="it">
        <b>${tituloAuditoria(a)}</b>
        <div class="meta">
          <span>${icon('calendario')}${fechaCorta(a.fecha)}</span>
          <span>${icon('usuario')}${a.auditorNombre || (a.origen === 'qr-paciente' ? 'Paciente (QR)' : '—')}</span>
          <span class="mono">${icon('etiqueta')}${a.id}</span>
        </div>
      </div>
      ${pastillaNota(a.porcentaje)}
      ${enPapelera
        ? html`<span class="badge dng">En papelera</span>`
        : html`<span class="badge ${completa ? 'ok' : 'pr'}">${ESTADOS[a.estado] || ESTADOS['en-progreso']}</span>`}
      <div class="acts">
        ${enPapelera
          ? borrable
            ? html`<button type="button" class="btn sm" data-action="restaurar" data-id="${a.id}">${icon('restaurar')} Restaurar</button>
                <button type="button" class="iconbtn dng" data-action="borrar" data-id="${a.id}" aria-label="Eliminar definitivamente">${icon('cerrar')}</button>`
            : ''
          : html`<a class="btn sm ${completa ? '' : 'pri'}" href="${urlLista(tipo, a, s.uid)}" target="_blank" rel="noopener">
                ${icon(completa ? 'abrir' : 'continuar')} ${completa ? 'Abrir' : 'Continuar'}
              </a>
              ${borrable ? html`<button type="button" class="iconbtn" data-action="papelera" data-id="${a.id}" aria-label="Enviar a la papelera">${icon('papelera')}</button>` : ''}`}
      </div>
    </article>`;
  };

  const vacio = () => {
    if (filtro === 'papelera') return html`<div class="empty">${icon('papelera')}<b>Papelera vacía</b><span>Las auditorías que elimines quedan aquí hasta que las restaures o las borres.</span></div>`;
    if (filtro === 'todas') return html`<div class="empty">${icon('auditorias')}<b>Aún no tienes auditorías</b><span>Crea la primera con el botón «Nueva auditoría».</span></div>`;
    return html`<div class="empty">${icon('auditorias')}<b>Sin auditorías en este estado</b><span>Cambia el filtro para ver las demás.</span></div>`;
  };

  const pintar = () => {
    const s = ctx.sesion;
    const lista = mias();
    const e = estadisticas(lista);
    const visibles = filtrar(lista, filtro);
    render(
      el,
      html`<header class="top">
          <div>
            <h1>Auditorías</h1>
            <p>Gestiona y continúa tus listas de verificación.</p>
          </div>
          ${puede(s, 'auditoria.crear') ? html`<button type="button" class="btn pri" data-action="nueva">${icon('mas')} Nueva auditoría</button>` : ''}
        </header>

        <nav class="seg" aria-label="Tipo de auditoría">
          ${Object.values(TIPOS).map(
            t => html`<a href="#/auditorias/${t.id}" ${t.id === tipo ? html`aria-current="page"` : ''}>${icon(t.id === 'pi' ? 'incognito' : 'auditorias')} ${t.titulo}</a>`,
          )}
        </nav>

        <section class="stats" aria-label="Resumen">
          ${stat('sky', 'auditorias', e.total, 'Total')}
          ${stat('sand', 'reloj', e.enProgreso, 'En progreso')}
          ${stat('mint', 'ok', e.completadas, 'Completadas')}
          ${stat('lav', 'tendencia', e.promedio === null ? '—' : `${e.promedio}%`, 'Promedio')}
        </section>

        <div class="bar">
          <h2>${def.titulo}</h2>
          <div class="chips" role="group" aria-label="Filtrar por estado">
            ${Object.keys(ETIQUETA_FILTRO).map(
              f => html`<button type="button" class="chip" data-action="filtro" data-filtro="${f}" aria-pressed="${f === filtro ? 'true' : 'false'}">
                ${ETIQUETA_FILTRO[f]}${f === 'papelera' && e.enPapelera ? html`<em>${e.enPapelera}</em>` : ''}
              </button>`,
            )}
          </div>
        </div>

        ${filtro === 'papelera' && visibles.length
          ? html`<div class="banner">
              ${icon('info')}<span><b>${visibles.length}</b> en papelera · puedes restaurarlas o borrarlas definitivamente</span>
              <button type="button" class="btn sm dng" data-action="vaciar">${icon('papelera')} Vaciar papelera</button>
            </div>`
          : ''}

        <div class="list" aria-live="polite">
          ${todas === null ? html`<div class="sk lg"></div><div class="sk lg"></div><div class="sk lg"></div>` : visibles.length ? visibles.map(fila) : vacio()}
        </div>`,
    );
  };

  const ejecutar = async (boton, tarea, exito) => {
    try {
      await conBloqueo(boton, tarea);
      if (exito) toast(exito, 'ok');
    } catch (error) {
      toast(mensajeDeError(error, error?.message?.startsWith('Primero') ? error.message : undefined), 'error');
    }
  };

  async function nueva() {
    const { el: dlg, cerrar } = abrirDialogo({
      titulo: `Nueva ${def.singular}`,
      descripcion: 'Elige la institución. La sede y la fecha se completan en la lista.',
      contenido: html`<form id="f-nueva" method="dialog">
        <fieldset class="opts">
          <legend class="sr">Institución</legend>
          ${Object.values(INSTITUCIONES).map(
            (inst, i) => html`<label class="opt">
              <input type="radio" name="institucion" value="${inst.id}" ${i === 0 ? html`checked` : ''}>
              ${logoInstitucion(inst)}
              <span><b>${inst.nombre}</b><small>${inst.nombreLargo}</small></span>
            </label>`,
          )}
        </fieldset>
        <div class="dlg-f">
          <button type="button" class="btn" data-cerrar="">Cancelar</button>
          <button type="submit" class="btn pri">${icon('continuar')} Iniciar auditoría</button>
        </div>
      </form>`,
    });
    dlg.querySelector('#f-nueva').addEventListener('submit', evento => {
      evento.preventDefault();
      const institucion = new FormData(evento.target).get('institucion');
      // La pestaña se abre en el mismo gesto del clic; después de un `await` el navegador la bloquearía.
      const pestana = window.open('about:blank', '_blank');
      if (pestana) pestana.opener = null;
      ejecutar(evento.target.querySelector('[type=submit]'), async () => {
        try {
          const id = await repo.crear(tipo, ctx.sesion, institucion);
          const destino = new URL(urlLista(tipo, { id, institucion }, ctx.sesion.uid), location.href).href;
          if (pestana) pestana.location.replace(destino);
          cerrar();
          toast(pestana ? 'Auditoría creada. Se abrió la lista en otra pestaña.' : 'Auditoría creada. Ábrela desde la lista.', 'ok');
        } catch (error) {
          pestana?.close();
          throw error;
        }
      });
    });
  }

  const bajaClicks = delegar(el, 'click', {
    nueva,
    filtro: boton => {
      filtro = boton.dataset.filtro;
      pintar();
    },
    papelera: boton => {
      const a = buscar(boton.dataset.id);
      if (a) ejecutar(boton, () => repo.enviarAPapelera(tipo, ctx.sesion, a), 'Auditoría enviada a la papelera.');
    },
    restaurar: boton => {
      const a = buscar(boton.dataset.id);
      if (a) ejecutar(boton, () => repo.restaurar(tipo, ctx.sesion, a), 'Auditoría restaurada.');
    },
    borrar: async boton => {
      const a = buscar(boton.dataset.id);
      if (!a) return;
      const si = await confirmar({
        titulo: '¿Eliminar definitivamente?',
        descripcion: `«${tituloAuditoria(a)}» se borrará con todas sus respuestas. Esta acción no se puede deshacer.`,
        accion: 'Eliminar',
        peligro: true,
      });
      if (si) ejecutar(boton, () => repo.eliminarDefinitivo(tipo, ctx.sesion, a), 'Auditoría eliminada.');
    },
    vaciar: async boton => {
      const si = await confirmar({
        titulo: '¿Vaciar la papelera?',
        descripcion: 'Se borrarán definitivamente todas las auditorías de la papelera que te pertenecen.',
        accion: 'Vaciar',
        peligro: true,
      });
      if (!si) return;
      try {
        const n = await conBloqueo(boton, () => repo.vaciarPapelera(tipo, ctx.sesion, mias()));
        toast(`Papelera vaciada (${n}).`, 'ok');
      } catch (error) {
        toast(mensajeDeError(error), 'error');
      }
    },
  });

  pintar();
  const bajaDatos = repo.observar(
    tipo,
    datos => {
      todas = datos;
      pintar();
    },
    error => {
      todas = [];
      pintar();
      toast(mensajeDeError(error, 'No se pudieron cargar las auditorías.'), 'error');
    },
  );

  if (ctx.ruta.resto[1] === 'nueva' && puede(ctx.sesion, 'auditoria.crear')) {
    history.replaceState(null, '', `#/auditorias/${tipo}`);
    nueva();
  }

  return () => {
    bajaClicks();
    bajaDatos();
  };
}
