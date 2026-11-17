/** Inicio: resumen de la gestión del usuario. */
import { puede } from '../../core/permissions.js';
import { html, render } from '../../core/security.js';
import { icon } from '../../ui/icons.js';
import { mensajeDeError, toast } from '../../ui/toast.js';
import { ETIQUETA_NIVEL, delMes, estadisticas, fechaCorta, nivel, visiblesPara } from '../auditorias/model.js';
import { institucionDe, logoInstitucion, pastillaNota, urlLista } from '../auditorias/partes.js';
import { MODULOS } from '../registry.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const saludo = hora => (hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches');
export const fechaLarga = d => `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

export function mount(el, ctx) {
  let lista = null;

  const kpi = (tono, icono, valor, etiqueta, detalle, destino) =>
    html`<a class="kpi ${tono}" href="${destino}">
      <span class="tile ${tono}">${icon(icono)}</span>
      <span class="kv">${valor}</span>
      <span class="kl">${etiqueta}</span>
      <span class="ks">${detalle}</span>
    </a>`;

  const pintar = () => {
    const s = ctx.sesion;
    const ahora = new Date();
    const mias = lista ? visiblesPara(lista, 'servicio', s.uid) : [];
    const e = estadisticas(mias);
    const recientes = mias
      .filter(a => !a.deletedAt)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
      .slice(0, 5);
    const primerNombre = s.nombre.split(/\s+/)[0];
    const accesos = MODULOS.filter(m => m.id !== 'inicio' && (!m.permiso || puede(s, m.permiso)));
    const tonos = ['sky', 'lav', 'mint', 'sand'];

    render(
      el,
      html`<header class="hero">
          <div>
            <span class="eyebrow">${fechaLarga(ahora)}</span>
            <h1>${saludo(ahora.getHours())}, ${primerNombre}</h1>
            <p>
              ${lista === null
                ? 'Cargando tu resumen…'
                : e.enProgreso
                  ? html`Tienes <b>${e.enProgreso}</b> ${plural(e.enProgreso, 'auditoría', 'auditorías')} en progreso.`
                  : 'No tienes auditorías pendientes.'}
            </p>
          </div>
          ${puede(s, 'auditoria.crear') ? html`<a class="btn pri" href="#/auditorias/servicio/nueva">${icon('mas')} Nueva auditoría</a>` : ''}
        </header>

        <section class="kpis" aria-label="Indicadores">
          ${kpi('sky', 'reloj', e.enProgreso, 'En progreso', 'auditorías abiertas', '#/auditorias')}
          ${kpi('mint', 'ok', e.completadas, 'Completadas', `de ${e.total} · ${delMes(mias, ahora)} este mes`, '#/auditorias')}
          ${kpi('lav', 'tendencia', e.promedio === null ? '—' : `${e.promedio}%`, 'Promedio', ETIQUETA_NIVEL[nivel(e.promedio)].toLowerCase(), '#/auditorias')}
          ${kpi('sand', 'papelera', e.enPapelera, 'En papelera', 'se pueden restaurar', '#/auditorias')}
        </section>

        <div class="grid2">
          <section class="card">
            <div class="ch"><h2>Auditorías recientes</h2><a class="lk" href="#/auditorias">Ver todas ${icon('flecha')}</a></div>
            <div class="rows">
              ${lista === null
                ? html`<div class="sk"></div><div class="sk"></div><div class="sk"></div>`
                : recientes.length
                  ? recientes.map(
                      a => html`<a class="row" href="${urlLista('servicio', a, s.uid)}" target="_blank" rel="noopener">
                        ${logoInstitucion(institucionDe(a))}
                        <span class="rt"><b>${a.sede || 'Sin sede'}</b><small>${fechaCorta(a.fecha)} · ${institucionDe(a).nombre}</small></span>
                        ${pastillaNota(a.porcentaje)}
                        <span class="badge ${a.estado === 'completada' ? 'ok' : 'pr'}">${a.estado === 'completada' ? 'Completada' : 'En progreso'}</span>
                      </a>`,
                    )
                  : html`<div class="empty sm">${icon('auditorias')}<b>Sin auditorías todavía</b><span>Crea la primera para empezar a medir.</span></div>`}
            </div>
          </section>

          <section class="card">
            <div class="ch"><h2>Módulos</h2></div>
            <div class="mods">
              ${accesos.map(
                (m, i) => html`<a class="mod" href="#/${m.id}">
                  <span class="tile ${tonos[i % tonos.length]}">${icon(m.icono)}</span>
                  <span><b>${m.nombre}</b><small>${m.descripcion || ''}</small></span>
                  ${icon('chevron')}
                </a>`,
              )}
            </div>
          </section>
        </div>`,
    );
  };

  pintar();
  const baja = ctx.repos.auditorias.observar(
    'servicio',
    datos => {
      lista = datos;
      pintar();
    },
    error => {
      lista = [];
      pintar();
      toast(mensajeDeError(error, 'No se pudieron cargar las auditorías.'), 'error');
    },
  );
  return baja;
}
