/** Usuarios: el administrador activa cuentas creadas en Firebase y asigna roles. */
import { ROLES, cambioDeUsuarioPermitido } from '../../core/permissions.js';
import { html, render } from '../../core/security.js';
import { nombreDesdeEmail } from '../../core/session.js';
import { delegar, iniciales } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { mensajeDeError, toast } from '../../ui/toast.js';

const opcionesRol = actual =>
  Object.entries(ROLES).map(([id, r]) => html`<option value="${id}" ${id === actual ? html`selected` : ''}>${r.etiqueta}</option>`);

export function mount(el, ctx) {
  const repo = ctx.repos.usuarios;
  let datos = null;

  const nombre = (uid, email) => datos.perfiles[uid]?.nombre || nombreDesdeEmail(email) || 'Sin nombre';

  const pintar = () => {
    if (!datos) return render(el, html`<header class="top"><div><h1>Usuarios</h1><p>Cargando…</p></div></header><div class="sk lg"></div>`);
    const s = ctx.sesion;
    const pendientes = Object.entries(datos.solicitudes).filter(([uid]) => datos.usuarios[uid]?.activo !== true);
    const usuarios = Object.entries(datos.usuarios).sort((a, b) => nombre(a[0], a[1].email).localeCompare(nombre(b[0], b[1].email), 'es'));

    return render(
      el,
      html`<header class="top">
          <div>
            <h1>Usuarios</h1>
            <p>Las cuentas se crean en Firebase Authentication. Aquí se activan y se les asigna un rol.</p>
          </div>
        </header>

        <section class="card">
          <div class="ch"><h2>Solicitudes pendientes</h2>${pendientes.length ? html`<span class="badge pr">${pendientes.length}</span>` : ''}</div>
          <div class="rows">
            ${pendientes.length
              ? pendientes.map(
                  ([uid, sol]) => html`<div class="row static">
                    <span class="av">${iniciales(nombre(uid, sol.email))}</span>
                    <span class="rt"><b>${sol.email || 'Sin correo'}</b><small class="mono">${uid}</small></span>
                    <label class="sr" for="rol-${uid}">Rol</label>
                    <select class="inp sm" id="rol-${uid}">${opcionesRol('auditor')}</select>
                    <button type="button" class="btn sm pri" data-action="aprobar" data-uid="${uid}">${icon('ok')} Activar</button>
                    <button type="button" class="iconbtn" data-action="descartar" data-uid="${uid}" aria-label="Descartar solicitud">${icon('cerrar')}</button>
                  </div>`,
                )
              : html`<div class="empty sm">${icon('ok')}<b>Sin solicitudes</b><span>Cuando alguien ingrese con una cuenta nueva aparecerá aquí.</span></div>`}
          </div>
        </section>

        <section class="card">
          <div class="ch"><h2>Cuentas con acceso</h2></div>
          <div class="rows">
            ${usuarios.map(([uid, u]) => {
              const yo = uid === s.uid;
              return html`<div class="row static ${u.activo === true ? '' : 'gone'}">
                <span class="av">${iniciales(nombre(uid, u.email))}</span>
                <span class="rt"><b>${nombre(uid, u.email)}${yo ? ' (tú)' : ''}</b><small>${u.email || uid}</small></span>
                <label class="sr" for="rol-${uid}">Rol</label>
                <select class="inp sm" id="rol-${uid}" data-action="rol" data-uid="${uid}" ${yo ? html`disabled` : ''}>${opcionesRol(u.rol)}</select>
                <button type="button" class="btn sm ${u.activo === true ? 'dng' : ''}" data-action="activo" data-uid="${uid}" ${yo ? html`disabled` : ''}>
                  ${u.activo === true ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>`;
            })}
          </div>
        </section>

        <section class="card note">
          ${icon('info')}
          <div>
            <b>Roles</b>
            <ul>${Object.values(ROLES).map(r => html`<li><b>${r.etiqueta}:</b> ${r.descripcion}.</li>`)}</ul>
          </div>
        </section>`,
    );
  };

  const hacer = async (tarea, exito) => {
    try {
      await tarea();
      toast(exito, 'ok');
    } catch (error) {
      toast(mensajeDeError(error), 'error');
      pintar();
    }
  };

  const bajaClick = delegar(el, 'click', {
    aprobar: b => {
      const uid = b.dataset.uid;
      const rol = el.querySelector(`#${CSS.escape(`rol-${uid}`)}`).value;
      hacer(() => repo.aprobar(ctx.sesion, uid, rol, datos.solicitudes[uid]?.email), 'Cuenta activada.');
    },
    descartar: b => hacer(() => repo.descartarSolicitud(ctx.sesion, b.dataset.uid), 'Solicitud descartada.'),
    activo: b => {
      const uid = b.dataset.uid;
      const activo = datos.usuarios[uid]?.activo !== true;
      if (!cambioDeUsuarioPermitido(ctx.sesion, uid, { activo })) return;
      hacer(() => repo.guardar(ctx.sesion, uid, { activo }), activo ? 'Cuenta reactivada.' : 'Cuenta desactivada.');
    },
  });
  const bajaCambio = delegar(el, 'change', {
    rol: sel => hacer(() => repo.guardar(ctx.sesion, sel.dataset.uid, { rol: sel.value }), 'Rol actualizado.'),
  });

  pintar();
  const bajaDatos = repo.observar(
    d => {
      datos = d;
      pintar();
    },
    error => toast(mensajeDeError(error, 'No se pudieron cargar los usuarios.'), 'error'),
  );

  return () => {
    bajaClick();
    bajaCambio();
    bajaDatos();
  };
}
