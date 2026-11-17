/** Pantallas previas a la aplicación: ingreso y cuenta pendiente de activación. */
import { APP } from '../config.js';
import { html, render } from '../core/security.js';
import { mensajeDeAuth } from '../core/session.js';
import { conBloqueo, delegar } from '../ui/dom.js';
import { icon } from '../ui/icons.js';

const marca = html`<div class="lbrand">
  <span class="logo lg" aria-hidden="true">Q</span>
  <b>${APP.nombre}</b>
  <span>${APP.descripcion}</span>
</div>`;

export function montarIngreso(raiz, session) {
  let modo = 'ingreso';

  const pintar = (aviso = null, email = '') => {
    render(
      raiz,
      html`<div class="login">
        <form class="lcard" id="f-ingreso" method="post" novalidate>
          ${marca}
          ${aviso ? html`<div class="lerr ${aviso.ok ? 'ok' : ''}" role="alert">${icon(aviso.ok ? 'ok' : 'alerta')}<span>${aviso.texto}</span></div>` : ''}
          <label class="fld">
            <span>Correo</span>
            <input class="inp" type="email" name="email" autocomplete="username" inputmode="email" required maxlength="120" value="${email}" placeholder="nombre@institucion.co">
          </label>
          ${modo === 'ingreso'
            ? html`<label class="fld">
                  <span>Contraseña</span>
                  <span class="pw">
                    <input class="inp" type="password" name="clave" autocomplete="current-password" required maxlength="128" placeholder="••••••••">
                    <button type="button" class="iconbtn" data-action="ver" aria-label="Mostrar contraseña" aria-pressed="false">${icon('ver')}</button>
                  </span>
                </label>
                <button type="submit" class="btn pri full">Ingresar</button>
                <button type="button" class="lforgot" data-action="modo">¿Olvidaste tu contraseña?</button>`
            : html`<p class="lhint">Te enviaremos un enlace para crear una contraseña nueva.</p>
                <button type="submit" class="btn pri full">Enviar enlace</button>
                <button type="button" class="lforgot" data-action="modo">Volver al ingreso</button>`}
          <p class="lfoot">${icon('candado')} Acceso solo para cuentas autorizadas</p>
        </form>
      </div>`,
    );
    raiz.querySelector(email ? '[name=clave], [type=submit]' : '[name=email]')?.focus();
  };

  const alEnviar = evento => {
    if (evento.target.id !== 'f-ingreso') return;
    evento.preventDefault();
    const datos = new FormData(evento.target);
    const email = String(datos.get('email') || '').trim();
    const boton = evento.target.querySelector('[type=submit]');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return pintar({ texto: 'Escribe un correo válido.' }, email);

    conBloqueo(boton, async () => {
      if (modo === 'reset') {
        // Mismo mensaje exista o no la cuenta: no se revela quién está registrado.
        await session.resetPassword(email).catch(() => {});
        modo = 'ingreso';
        return pintar({ ok: true, texto: 'Si el correo está registrado, recibirás un enlace en unos minutos.' }, email);
      }
      const clave = String(datos.get('clave') || '');
      if (!clave) return pintar({ texto: 'Escribe tu contraseña.' }, email);
      try {
        await session.signIn(email, clave);
      } catch (error) {
        pintar({ texto: mensajeDeAuth(error) }, email);
      }
      return undefined;
    });
    return undefined;
  };

  raiz.addEventListener('submit', alEnviar);
  const baja = delegar(raiz, 'click', {
    modo: () => {
      const email = raiz.querySelector('[name=email]')?.value || '';
      modo = modo === 'ingreso' ? 'reset' : 'ingreso';
      pintar(null, email);
    },
    ver: boton => {
      const campo = raiz.querySelector('[name=clave]');
      const visible = campo.type === 'text';
      campo.type = visible ? 'password' : 'text';
      boton.setAttribute('aria-pressed', String(!visible));
      boton.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      render(boton, icon(visible ? 'ver' : 'ocultar'));
    },
  });

  pintar();
  return () => {
    raiz.removeEventListener('submit', alEnviar);
    baja();
  };
}

export function montarPendiente(raiz, session, leerSesion) {
  render(
    raiz,
    html`<div class="login">
      <div class="lcard">
        ${marca}
        <div class="lwait">
          <span class="tile sand">${icon('reloj')}</span>
          <h2>Tu cuenta está pendiente de activación</h2>
          <p>Un administrador debe autorizar el acceso de <b>${leerSesion()?.email || ''}</b>. Esta pantalla se actualizará sola cuando lo haga.</p>
        </div>
        <button type="button" class="btn full" data-action="salir">${icon('salir')} Cerrar sesión</button>
      </div>
    </div>`,
  );
  return delegar(raiz, 'click', { salir: () => session.signOut().catch(() => {}) });
}
