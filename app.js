/**
 * Arranque de la aplicación. Recibe un backend (Firebase o memoria) y monta:
 * ingreso → cuenta pendiente → aplicación (barra lateral + módulo activo).
 */
import { APP, HOSTS_IMAGEN } from './config.js';
import { puede, ROLES } from './core/permissions.js';
import { createRouter } from './core/router.js';
import { html, render, safeUrl } from './core/security.js';
import { createSession, vigilarInactividad } from './core/session.js';
import { createAuditoriasRepo } from './data/auditorias.js';
import { createPerfilesRepo } from './data/perfiles.js';
import { createUsuariosRepo } from './data/usuarios.js';
import * as clasico from './modules/clasico.js';
import { MODULOS, buscarModulo } from './modules/registry.js';
import { montarIngreso, montarPendiente } from './modules/ingreso.js';
import { confirmar } from './ui/dialog.js';
import { delegar, iniciales, protegerImagenes } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { mensajeDeError, toast } from './ui/toast.js';

export function start(backend, { raiz = document.getElementById('app') } = {}) {
  const repos = { auditorias: createAuditoriasRepo(backend), perfiles: createPerfilesRepo(backend), usuarios: createUsuariosRepo(backend) };
  let fase = null;
  let sesion = null;
  let limpiarVista = () => {};
  let limpiarModulo = () => {};
  let router = null;
  let pararInactividad = () => {};
  let turno = 0;

  protegerImagenes(document);

  const session = createSession(backend, {
    onChange: estado => {
      const antes = sesion;
      sesion = estado.sesion;
      if (estado.fase !== fase) return cambiarFase(estado.fase);
      if (fase !== 'activo') return undefined;
      pintarUsuario();
      if (antes?.rol !== sesion.rol) {
        pintarNav();
        router.iniciar();
      }
      return undefined;
    },
  });

  function cambiarFase(nueva) {
    fase = nueva;
    limpiarModulo();
    limpiarVista();
    limpiarModulo = limpiarVista = () => {};
    pararInactividad();
    pararInactividad = () => {};
    router?.destroy();
    router = null;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());

    if (nueva === 'cargando') return render(raiz, html`<div class="splash" role="status"><span class="spin"></span><span class="sr">Cargando</span></div>`);
    if (nueva === 'anonimo') return (limpiarVista = montarIngreso(raiz, session));
    if (nueva === 'pendiente') return (limpiarVista = montarPendiente(raiz, session, () => sesion));
    return montarApp();
  }

  const ctxBase = () => ({
    backend,
    repos,
    get sesion() {
      return sesion;
    },
    ir: ruta => router.ir(ruta),
  });

  const visibles = () => MODULOS.filter(m => !m.permiso || puede(sesion, m.permiso));

  function montarApp() {
    render(
      raiz,
      html`<a class="salto" href="#vista">Saltar al contenido</a>
        <div class="app">
          <aside class="side" id="side" aria-label="Navegación">
            <div class="brand">
              <span class="logo" aria-hidden="true">Q</span>
              <div><b>${APP.nombre}</b><span>${APP.descripcion}</span></div>
            </div>
            <div class="sscroll"><nav class="nav" id="nav" aria-label="Módulos"></nav></div>
            <div class="sfoot">
              <div class="me" id="me"></div>
            </div>
          </aside>
          <button type="button" class="scrim" data-action="menu" aria-label="Cerrar menú" tabindex="-1"></button>
          <div class="col">
            <header class="mbar">
              <button type="button" class="iconbtn" data-action="menu" aria-label="Abrir menú" aria-controls="side">${icon('menu')}</button>
              <b>${APP.nombre}</b>
            </header>
            <main class="main" id="vista" tabindex="-1"><div id="pane"></div></main>
          </div>
        </div>`,
    );
    pintarNav();
    pintarUsuario();

    const baja = delegar(raiz, 'click', {
      menu: () => raiz.querySelector('.app').classList.toggle('menu'),
      salir: async () => {
        const si = await confirmar({ titulo: 'Cerrar sesión', descripcion: '¿Quieres salir de Qualisig en este equipo?', accion: 'Cerrar sesión' });
        if (si) session.signOut().catch(e => toast(mensajeDeError(e), 'error'));
      },
    });
    limpiarVista = baja;

    pararInactividad = vigilarInactividad({
      minutos: APP.minutosInactividad,
      alExpirar: () => {
        session.signOut().catch(() => {});
        toast('Cerramos tu sesión por inactividad.', 'info', 8000);
      },
    });

    router = createRouter({ porDefecto: '#/inicio', alCambiar: mostrar });
    router.iniciar();
    return undefined;
  }

  function pintarNav() {
    const nav = raiz.querySelector('#nav');
    if (!nav) return;
    const grupos = [...new Set(visibles().map(m => m.grupo))];
    render(
      nav,
      html`${grupos.map(
        g => html`${g === 'General' ? '' : html`<h4>${g}</h4>`}
          ${visibles()
            .filter(m => m.grupo === g)
            .map(m => html`<a class="nv" href="#/${m.id}" data-mod="${m.id}">${icon(m.icono)}<span>${m.nombre}</span>${m.clasico ? html`<em>Clásico</em>` : ''}</a>`)}`,
      )}`,
    );
    marcarNav(router?.actual().modulo);
  }

  function marcarNav(id) {
    raiz.querySelectorAll('.nv').forEach(a => {
      if (a.dataset.mod === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function pintarUsuario() {
    const me = raiz.querySelector('#me');
    if (!me || !sesion) return;
    const avatar = safeUrl(sesion.avatarUrl, HOSTS_IMAGEN);
    render(
      me,
      html`<span class="av">${iniciales(sesion.nombre)}${avatar ? html`<img src="${avatar}" alt="" referrerpolicy="no-referrer">` : ''}</span>
        <div><b>${sesion.nombre}</b><small>${ROLES[sesion.rol]?.etiqueta || ''}</small></div>
        <button type="button" class="iconbtn" data-action="salir" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('salir')}</button>`,
    );
  }

  async function mostrar(ruta) {
    const mio = ++turno;
    let modulo = buscarModulo(ruta.modulo);
    if (!modulo || (modulo.permiso && !puede(sesion, modulo.permiso))) {
      modulo = buscarModulo('inicio');
      ruta = { modulo: 'inicio', sub: '', resto: [] };
    }
    raiz.querySelector('.app')?.classList.remove('menu');
    marcarNav(modulo.id);
    document.title = `${modulo.nombre} · ${APP.nombre}`;

    limpiarModulo();
    limpiarModulo = () => {};
    const pane = raiz.querySelector('#pane');
    pane.className = '';
    try {
      const impl = modulo.clasico ? clasico : await modulo.cargar();
      if (mio !== turno || fase !== 'activo') return;
      void pane.offsetWidth; // reinicia la animación de entrada
      pane.className = 'entra';
      limpiarModulo = impl.mount(pane, { ...ctxBase(), get sesion() { return sesion; }, modulo, ruta }) || (() => {});
    } catch (error) {
      if (mio !== turno) return;
      console.error(error);
      render(pane, html`<section class="card puente"><span class="tile sand">${icon('alerta')}</span><h2>No se pudo abrir ${modulo.nombre}</h2><p>Recarga la página. Si continúa, avisa al administrador.</p></section>`);
    }
    raiz.querySelector('#vista')?.scrollTo?.(0, 0);
  }

  cambiarFase('cargando');
  return { destroy: () => { cambiarFase('cargando'); session.destroy(); } };
}
