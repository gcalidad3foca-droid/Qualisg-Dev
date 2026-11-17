/** Dashboard: resultados de las auditorías de servicio de todo el equipo. */
import { INSTITUCIONES } from '../../config.js';
import { html, render } from '../../core/security.js';
import { abrirDialogo } from '../../ui/dialog.js';
import { delegar } from '../../ui/dom.js';
import { barra, barraApilada, linea } from '../../ui/graficos.js';
import { icon } from '../../ui/icons.js';
import { mensajeDeError, toast } from '../../ui/toast.js';
import { NOMBRE_RESULTADO } from '../auditorias/catalogo.js';
import { ETIQUETA_NIVEL, fechaCorta, nivel } from '../auditorias/model.js';
import { aplicarFiltros, distribucion, hallazgos, nombreMes, opciones, porCategoria, porSede, resumen, tendencia, variacion } from './model.js';

const INST = [['todas', 'Todas'], ...Object.values(INSTITUCIONES).map(i => [i.id, i.nombre])];
const TONO_RESULTADO = { C: 'alto', CP: 'medio', NC: 'bajo', NA: 'nd' };
/** «AMBIENTE HUMANIZADO» → «Ambiente humanizado»; siglas como «PQRS» se conservan. */
const capitalizar = t => (/^[A-ZÁÉÍÓÚÑ]{2,5}$/.test(t) ? t : t.charAt(0) + t.slice(1).toLowerCase());

export function mount(el, ctx) {
  let todas = null;
  const filtros = { institucion: 'todas', mes: '', sede: '' };
  let tipoHallazgo = 'NC';
  let vistaHallazgos = [];

  const kpi = (tono, icono, valor, etiqueta, detalle) =>
    html`<div class="kpi ${tono}"><span class="tile ${tono}">${icon(icono)}</span><span class="kv">${valor}</span><span class="kl">${etiqueta}</span><span class="ks">${detalle}</span></div>`;

  const selector = (nombre, etiqueta, valor, lista, texto) =>
    html`<label class="sel"><span class="sr">${etiqueta}</span>
      <select class="inp sm" name="${nombre}" data-filtro="${nombre}">
        <option value="">${etiqueta}</option>
        ${lista.map(v => html`<option value="${v}" ${v === valor ? 'selected' : ''}>${texto(v)}</option>`)}
      </select></label>`;

  const pintar = () => {
    if (todas === null) {
      render(el, html`<header class="top"><div><h1>Dashboard</h1><p>Cargando resultados…</p></div></header>
        <section class="kpis">${[1, 2, 3, 4].map(() => html`<div class="sk lg"></div>`)}</section><div class="sk lg"></div>`);
      return;
    }
    const op = opciones(todas);
    if (filtros.mes && !op.meses.includes(filtros.mes)) filtros.mes = '';
    if (filtros.sede && !op.sedes.includes(filtros.sede)) filtros.sede = '';
    const datos = aplicarFiltros(todas, filtros);
    const r = resumen(datos);
    const serie = tendencia(datos);
    const delta = variacion(serie);
    const dist = distribucion(datos);
    const cats = porCategoria(datos);
    const sedes = porSede(datos);
    vistaHallazgos = hallazgos(datos, tipoHallazgo);
    const activos = filtros.institucion !== 'todas' || filtros.mes || filtros.sede;
    const pct = n => (dist.total ? Math.round((n / dist.total) * 100) : 0);

    render(
      el,
      html`<header class="top">
          <div>
            <h1>Dashboard</h1>
            <p>${r.total
              ? html`<b>${r.total}</b> auditorías calificadas · <b>${r.sedes}</b> sedes · <b>${dist.total}</b> ítems evaluados`
              : 'Resultados de las auditorías de servicio del equipo.'}</p>
          </div>
        </header>

        <div class="fbar" role="group" aria-label="Filtros">
          <div class="chips" role="group" aria-label="Institución">
            ${INST.map(([id, nombre]) => html`<button type="button" class="chip" data-action="inst" data-id="${id}" aria-pressed="${filtros.institucion === id}">${nombre}</button>`)}
          </div>
          <div class="fsel">
            ${selector('mes', 'Todos los meses', filtros.mes, op.meses, m => nombreMes(m, true))}
            ${selector('sede', 'Todas las sedes', filtros.sede, op.sedes, s => s)}
            ${activos ? html`<button type="button" class="btn sm" data-action="limpiar">${icon('cerrar')} Limpiar</button>` : ''}
          </div>
        </div>

        ${!r.total
          ? html`<section class="card"><div class="empty">${icon('dashboard')}<b>Sin resultados para mostrar</b><span>${activos ? 'Ninguna auditoría calificada coincide con los filtros.' : 'Los resultados aparecen cuando las auditorías tienen calificación.'}</span></div></section>`
          : html`<section class="kpis" aria-label="Indicadores">
                ${kpi('sky', 'auditorias', r.total, 'Auditorías', `${r.sedes} ${r.sedes === 1 ? 'sede' : 'sedes'}`)}
                ${kpi('lav', 'tendencia', `${r.promedio}%`, 'Promedio', ETIQUETA_NIVEL[nivel(r.promedio)])}
                ${kpi('mint', 'ok', r.riesgoBajo, 'Riesgo bajo', `${Math.round((r.riesgoBajo / r.total) * 100)}% del total · ${r.riesgoMedio} en riesgo medio`)}
                ${kpi('sand', 'alerta', r.riesgoAlto, 'Riesgo alto', r.riesgoAlto ? 'requieren plan de acción' : 'sin auditorías en riesgo alto')}
              </section>

              <div class="grid2">
                <section class="card">
                  <div class="ch">
                    <h2>Tendencia mensual</h2>
                    ${delta === null ? '' : html`<span class="delta ${delta > 0 ? 'sube' : delta < 0 ? 'baja' : ''}">${icon('tendencia')} ${delta > 0 ? '+' : ''}${delta} pts vs. mes anterior</span>`}
                  </div>
                  ${serie.length > 1 ? linea(serie, { titulo: 'Promedio mensual', compacto: el.clientWidth < 640 }) : html`<div class="empty sm">${icon('tendencia')}<b>${serie[0]?.valor ?? '—'}% en ${serie[0]?.etiqueta ?? ''}</b><span>La tendencia aparece con dos meses o más.</span></div>`}
                </section>

                <section class="card">
                  <div class="ch"><h2>Respuestas</h2><small class="ks">${dist.total} ítems</small></div>
                  ${dist.total
                    ? html`${barraApilada(['C', 'CP', 'NC', 'NA'].map(k => ({ valor: dist[k], tono: TONO_RESULTADO[k], etiqueta: `${NOMBRE_RESULTADO[k]}: ${dist[k]}` })), 'Distribución de respuestas')}
                        <ul class="leyenda">
                          ${['C', 'CP', 'NC', 'NA'].map(
                            k => html`<li><i class="pt ${TONO_RESULTADO[k]}"></i><span>${NOMBRE_RESULTADO[k]}</span><b>${dist[k]}</b><small>${pct(dist[k])}%</small></li>`,
                          )}
                        </ul>`
                    : html`<div class="empty sm"><b>Sin respuestas detalladas</b><span>Las auditorías filtradas no tienen ítems diligenciados.</span></div>`}
                </section>
              </div>

              <div class="grid2 eq">
                <section class="card">
                  <div class="ch"><h2>Cumplimiento por categoría</h2></div>
                  ${cats.length
                    ? html`<div class="bars">
                        ${cats.map(
                          c => html`<div class="br">
                            <span class="bn" title="${c.nombre}">${capitalizar(c.nombre)}</span>
                            ${barra(c.valor, nivel(c.valor), `${c.nombre}: ${c.valor}%`)}
                            <b class="bv ${nivel(c.valor)}">${c.valor}%</b>
                          </div>`,
                        )}
                      </div>`
                    : html`<div class="empty sm"><b>Sin ítems evaluados</b></div>`}
                </section>

                <section class="card">
                  <div class="ch"><h2>Por sede</h2><small class="ks">de menor a mayor</small></div>
                  <div class="bars">
                    ${sedes.map(
                      s => html`<button type="button" class="br btnr" data-action="sede" data-id="${s.sede}" title="Filtrar por ${s.sede}">
                        <span class="bn"><em class="ins">${INSTITUCIONES[s.institucion]?.nombre || ''}</em>${s.sede}</span>
                        ${barra(s.valor, nivel(s.valor), `${s.sede}: ${s.valor}%`)}
                        <b class="bv ${nivel(s.valor)}">${s.valor}%</b>
                      </button>`,
                    )}
                  </div>
                </section>
              </div>

              <section class="card">
                <div class="ch">
                  <h2>Hallazgos frecuentes</h2>
                  <div class="chips" role="group" aria-label="Tipo de hallazgo">
                    ${['NC', 'CP'].map(k => html`<button type="button" class="chip" data-action="tipo" data-id="${k}" aria-pressed="${tipoHallazgo === k}">${NOMBRE_RESULTADO[k]} <em class="${k === 'NC' ? '' : 'w'}">${dist[k]}</em></button>`)}
                  </div>
                </div>
                ${vistaHallazgos.length
                  ? html`<div class="rows">
                      ${vistaHallazgos.map(
                        (h, i) => html`<button type="button" class="row hz" data-action="hallazgo" data-id="${i}">
                          <span class="hz-n ${TONO_RESULTADO[tipoHallazgo]}">${h.veces}×</span>
                          <span class="rt"><b>${h.texto}</b><small>${capitalizar(h.categoria)}${h.sedes.length ? ` · ${h.sedes.slice(0, 3).join(', ')}${h.sedes.length > 3 ? ` +${h.sedes.length - 3}` : ''}` : ''}</small></span>
                          ${h.observaciones.length ? html`<span class="badge">${h.observaciones.length} obs.</span>` : ''}
                          ${icon('chevron')}
                        </button>`,
                      )}
                    </div>`
                  : html`<div class="empty sm">${icon('ok')}<b>Sin hallazgos de este tipo</b><span>Ningún ítem quedó como ${NOMBRE_RESULTADO[tipoHallazgo].toLowerCase()} con estos filtros.</span></div>`}
              </section>`}`,
    );
  };

  const detalle = h =>
    abrirDialogo({
      titulo: `${NOMBRE_RESULTADO[tipoHallazgo]} · ${h.veces} ${h.veces === 1 ? 'vez' : 'veces'}`,
      descripcion: h.texto,
      clase: 'dlg-lg',
      contenido: html`<div class="dd">
        <div class="dd-k"><span>Categoría</span><b>${capitalizar(h.categoria)}</b></div>
        <div class="dd-k"><span>Sedes</span><div class="tags">${h.sedes.length ? h.sedes.map(s => html`<span class="tag">${s}</span>`) : '—'}</div></div>
      </div>
      <h3 class="dd-t">Observaciones de los auditores</h3>
      ${h.observaciones.length
        ? html`<ol class="obs">${h.observaciones.map(o => html`<li><p>${o.texto}</p><small>${o.sede || 'Sin sede'} · ${fechaCorta(o.fecha)}</small></li>`)}</ol>`
        : html`<p class="ks">No se registraron observaciones para este ítem.</p>`}`,
    });

  const bajaClic = delegar(el, 'click', {
    inst: b => {
      filtros.institucion = b.dataset.id;
      filtros.sede = '';
      pintar();
    },
    sede: b => {
      filtros.sede = filtros.sede === b.dataset.id ? '' : b.dataset.id;
      pintar();
    },
    limpiar: () => {
      Object.assign(filtros, { institucion: 'todas', mes: '', sede: '' });
      pintar();
    },
    tipo: b => {
      tipoHallazgo = b.dataset.id === 'CP' ? 'CP' : 'NC';
      pintar();
    },
    hallazgo: b => {
      const h = vistaHallazgos[Number(b.dataset.id)];
      if (h) detalle(h);
    },
  });
  const alCambiar = e => {
    const campo = e.target.dataset?.filtro;
    if (campo === 'mes' || campo === 'sede') {
      filtros[campo] = e.target.value;
      pintar();
    }
  };
  el.addEventListener('change', alCambiar);

  pintar();
  const baja = ctx.repos.auditorias.observar(
    'servicio',
    lista => {
      todas = lista;
      pintar();
    },
    error => {
      todas = [];
      pintar();
      toast(mensajeDeError(error, 'No se pudieron cargar los resultados.'), 'error');
    },
  );
  return () => {
    baja();
    bajaClic();
    el.removeEventListener('change', alCambiar);
  };
}
