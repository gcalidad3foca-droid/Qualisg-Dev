/**
 * Sesión: une la cuenta de Firebase Auth con su ficha de acceso (`usuarios/{uid}`)
 * y su perfil (`perfiles/{uid}`).
 *
 * Estados: 'cargando' → 'anonimo' | 'pendiente' | 'activo'
 *  - pendiente: la cuenta existe pero un administrador aún no la ha activado.
 *  - activo: tiene ficha con `activo: true` y un rol válido.
 * La ficha se observa en vivo: si un administrador la desactiva, la sesión cae al instante.
 */
import { sesionActiva } from './permissions.js';
import { limpiarTexto } from './security.js';

export function nombreDesdeEmail(email) {
  return String(email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/(^|\s)\p{L}/gu, c => c.toUpperCase())
    .trim();
}

export function createSession(backend, { onChange, onError = () => {} }) {
  let estado = { fase: 'cargando', sesion: null };
  let bajas = [];

  const emitir = nuevo => {
    estado = nuevo;
    onChange(estado);
  };
  const soltar = () => {
    bajas.forEach(b => b());
    bajas = [];
  };

  const bajaAuth = backend.auth.onChange(cuenta => {
    soltar();
    if (!cuenta) return emitir({ fase: 'anonimo', sesion: null });

    let ficha;
    let perfil;
    const componer = () => {
      if (ficha === undefined || perfil === undefined) return;
      const sesion = {
        uid: cuenta.uid,
        email: cuenta.email,
        rol: ficha?.rol ?? null,
        activo: ficha?.activo === true,
        nombre: limpiarTexto(perfil?.nombre, 80) || nombreDesdeEmail(cuenta.email),
        cargo: limpiarTexto(perfil?.cargo, 80),
        avatarUrl: typeof perfil?.avatarUrl === 'string' ? perfil.avatarUrl : '',
      };
      emitir({ fase: sesionActiva(sesion) ? 'activo' : 'pendiente', sesion });
    };

    bajas.push(
      backend.db.subscribe(
        `usuarios/${cuenta.uid}`,
        v => {
          const antes = ficha;
          ficha = v;
          if (antes === undefined && !sesionActiva(v)) {
            // Deja constancia para que el administrador vea la solicitud. Es de solo-creación.
            backend.db
              .set(`solicitudes/${cuenta.uid}`, { email: cuenta.email, creada: backend.db.now() })
              .catch(() => {});
          }
          componer();
        },
        err => {
          // Sin permiso de lectura = sin ficha.
          ficha = null;
          onError(err);
          componer();
        },
      ),
      backend.db.subscribe(
        `perfiles/${cuenta.uid}`,
        v => {
          perfil = v;
          componer();
        },
        () => {
          perfil = null;
          componer();
        },
      ),
    );
  });

  return {
    get estado() {
      return estado;
    },
    signIn: (email, clave) => backend.auth.signIn(String(email).trim(), clave),
    signOut: () => backend.auth.signOut(),
    resetPassword: email => backend.auth.resetPassword(String(email).trim()),
    destroy() {
      soltar();
      bajaAuth();
    },
  };
}

/** Cierra la sesión tras `minutos` sin actividad. Devuelve una función para detenerlo. */
export function vigilarInactividad({ minutos, alExpirar, objetivo = globalThis, temporizador = globalThis }) {
  const limite = minutos * 60_000;
  let id = null;
  const reiniciar = () => {
    temporizador.clearTimeout(id);
    id = temporizador.setTimeout(alExpirar, limite);
  };
  const eventos = ['pointerdown', 'keydown', 'visibilitychange'];
  eventos.forEach(e => objetivo.addEventListener(e, reiniciar, { passive: true }));
  reiniciar();
  return () => {
    temporizador.clearTimeout(id);
    eventos.forEach(e => objetivo.removeEventListener(e, reiniciar));
  };
}

const MENSAJES_AUTH = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contacta al administrador.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
};

/** Mensaje para el usuario; no revela si el correo existe. */
export function mensajeDeAuth(error) {
  return MENSAJES_AUTH[error?.code] || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}
