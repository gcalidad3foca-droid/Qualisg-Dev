/**
 * Configuración pública de la aplicación.
 * Aquí NO van secretos: todo este archivo es visible para cualquier visitante.
 * La configuración web de Firebase es pública por diseño; la protección real
 * está en las reglas (firebase/database.rules.json).
 */

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyDdATmr1x7nNObgKjcqKiexbM2YNMP0D9Y',
  authDomain: 'qualisig-auditorias.firebaseapp.com',
  databaseURL: 'https://qualisig-auditorias-default-rtdb.firebaseio.com',
  projectId: 'qualisig-auditorias',
  appId: '1:155027246268:web:75a8394fbb0a2a2ccb54b9',
});

export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.0';

export const APP = Object.freeze({
  nombre: 'Qualisig',
  descripcion: 'Gestión de calidad',
  /** Cierre de sesión por inactividad. */
  minutosInactividad: 30,
  /** Subidas de archivos: Worker de Cloudflare (ver worker/). Vacío = subidas deshabilitadas. */
  urlSubidas: '',
  /** Módulos aún no migrados se abren en la versión clásica. */
  urlClasica: './legacy/index.html',
});

export const INSTITUCIONES = Object.freeze({
  foca: Object.freeze({ id: 'foca', nombre: 'FOCA', nombreLargo: 'Fundación Oftalmológica del Caribe', logo: 'https://i.imgur.com/gkAallJ.png' }),
  viu: Object.freeze({ id: 'viu', nombre: 'VIU', nombreLargo: 'VIU', logo: 'https://i.imgur.com/IitwgHx.png' }),
});

/** Hosts desde los que se aceptan imágenes guardadas en la base de datos. */
export const HOSTS_IMAGEN = Object.freeze(['i.imgur.com', 'res.cloudinary.com', '*.r2.dev']);

/** Listas de verificación (páginas hermanas en el mismo origen). */
export const LISTAS = Object.freeze({
  servicio: Object.freeze({
    foca: './Lista_Verificacion_FOCA.html',
    viu: './Lista_Verificacion_VIU.html',
  }),
  pi: Object.freeze({
    foca: './Lista_Paciente_Incognito_FOCA%20(15).html',
    viu: './Lista_Paciente_Incognito_VIU%20(9).html',
  }),
});

/** Umbrales de calificación (los mismos de la versión clásica). */
export const UMBRALES = Object.freeze({ alto: 92, medio: 85 });
