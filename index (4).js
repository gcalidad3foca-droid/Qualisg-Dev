/** Equipo: desempeño y carga de cada auditor (solo gestores y administradores). */
import { HOSTS_IMAGEN, INSTITUCIONES } from '../../config.js';
import { html, render, safeUrl } from '../../core/security.js';
import { delegar, iniciales } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { mensajeDeError, toast } from '../../ui/toast.js';
import { ESTADOS, fechaCorta, nivel } from '../auditorias/model.js';
import { institucionDe, logoInstitucion, pastillaNota } from '../auditorias/partes.js';
import { nombreMes } from '../dashboard/model.js';
import { agruparPorAuditor, mesesDisponibles } from './model.js';

const INST = [['todas', 'Todas'], ...Object.values(INSTITUCIONES).map(i => [i.id, i.nombre])];
const TONOS = ['sky', 'lav', 'mint', 'sand'];
const MAX_FILAS = 6;

/** Tono estable por persona (no depende del orden de la lista). */
const tonoDe = uid => TONOS[[...String(uid)].reduce((s, c) => s + c.charCodeAt(0), 0) % TONOS.length];

export function mount(el, ctx) {
  let auditorias = null;
  let perfiles = {};
  const filtros = { institucion: 'todas', mes: '' };
  const abiertos = new Set();

  const tarjeta = p => {
    const foto = safeUrl(p.avatarUrl, HOSTS_IMAGEN);
    const filas = abiertos.has(p.uid) ? p.visibles : p.visibles.slice(0, MAX_FILAS);
    return html`<article class="card mbr">
      <header class="mbr-h">
        <span class="av xl ${tonoDe(p.uid)}">${iniciales(p.nombre)}${foto ? html`<img src="${foto}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
        <div class="rt"><b>${p.nombre}</b><small>${p.cargo}</small></div>
      </header>
      <dl class="mbr-k">
        <div><dt>Total</dt><dd>${p.total}</dd></div>
        <div><dt>Completadas</dt><dd class="ok">${p.completadas}</dd></div>
        <div><dt>En progreso</dt><dd class="pr">${p.enProgreso}</dd></div>
        <div><dt>Promedio</dt><dd class="${nivel(p.promedio)}">${p.promedio === null ? '—' : `${p.promedio}%`}</dd></div>
      </dl>
      <div class="mbr-l">
        <div class="mbr-t"><span>Auditorías</span><small>${p.visibles.length} en el filtro</small></div>
        ${p.visibles.length
          ? html`${filas.map(
              a => html`<div class="row mini">
                ${logoInstitucion(institucionDe(a))}
                <span class="rt"><b>${a.sede || 'Sin sede'}</b><small>${fechaCorta(a.fecha)}</small></span>
                ${pastillaNota(a.porcentaje)}
                <span class="badge ${a.estado === 'completada' ? 'ok' : 'pr'}">${ESTADOS[a.estado] || ESTADOS['en-progreso']}</span>
              </div>`,
            )}
            ${p.visibles.length > MAX_FILAS
              ? html`<button type="button" class="lk mas" data-action="mas" data-id="${p.uid}">${abiertos.has(p.uid) ? 'Ver menos' : `Ver las ${p.visibles.length}`}</button>`
              : ''}`
          : html`<div class="empty sm"><span>Sin auditorías en este filtro.</span></div>`}
      </div>
    </article>`;
  };

  const pintar = () => {
    if (auditorias === null) {
      render(el, html`<header class="top"><div><h1>Equipo</h1><p>Cargando…</p></div></header><div class="team">${[1, 2, 3].map(() => html`<div class="sk lg"></div>`)}</div>`);
      return;
    }
    const meses = mesesDisponibles(auditorias);
    if (filtros.mes && !meses.includes(filtros.mes)) filtros.mes = '';
    const equipo = agruparPorAuditor(auditorias, perfiles, filtros);
    const total = equipo.reduce((s, p) => s + p.total, 0);

    render(
      el,
      html`<header class="top">
          <div>
            <h1>Equipo</h1>
            <p>${equipo.length ? html`<b>${equipo.length}</b> ${equipo.length === 1 ? 'auditor' : 'auditores'} · <b>${total}</b> auditorías vigentes` : 'Desempeño y carga de cada auditor.'}</p>
          </div>
        </header>
        <div class="fbar" role="group" aria-label="Filtros">
          <div class="chips" role="group" aria-label="Institución">
            ${INST.map(([id, nombre]) => html`<button type="button" class="chip" data-action="inst" data-id="${id}" aria-pressed="${filtros.institucion === id}">${nombre}</button>`)}
          </div>
          <div class="fsel">
            <label class="sel"><span class="sr">Mes</span>
              <select class="inp sm" data-filtro="mes">
                <option value="">Todos los meses</option>
                ${meses.map(m => html`<option value="${m}" ${m === filtros.mes ? 'selected' : ''}>${nombreMes(m, true)}</option>`)}
              </select>
            </label>
          </div>
        </div>
        ${equipo.length
          ? html`<div class="team">${equipo.map(tarjeta)}</div>`
          : html`<section class="card"><div class="empty">${icon('equipo')}<b>Sin datos del equipo</b><span>Las tarjetas aparecen cuando los auditores registran auditorías.</span></div></section>`}`,
    );
  };

  const bajaClic = delegar(el, 'click', {
    inst: b => {
      filtros.institucion = b.dataset.id;
      pintar();
    },
    mas: b => {
      const uid = b.dataset.id;
      if (abiertos.has(uid)) abiertos.delete(uid);
      else abiertos.add(uid);
      pintar();
    },
  });
  const alCambiar = e => {
    if (e.target.dataset?.filtro === 'mes') {
      filtros.mes = e.target.value;
      pintar();
    }
  };
  el.addEventListener('change', alCambiar);

  const fallo = error => {
    if (auditorias === null) auditorias = [];
    pintar();
    toast(mensajeDeError(error, 'No se pudo cargar el equipo.'), 'error');
  };
  pintar();
  const bajas = [
    ctx.repos.perfiles.observar(p => {
      perfiles = p;
      if (auditorias !== null) pintar();
    }, fallo),
    ctx.repos.auditorias.observar(
      'servicio',
      lista => {
        auditorias = lista;
        pintar();
      },
      fallo,
    ),
  ];
  return () => {
    bajas.forEach(b => b());
    bajaClic();
    el.removeEventListener('change', alCambiar);
  };
}
