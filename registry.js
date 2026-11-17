/**
 * Registro de módulos. Para añadir uno: crea su carpeta con `index.js`
 * (exporta `mount(el, ctx)` y devuelve una función de limpieza) y regístralo aquí.
 * Los módulos con `clasico: true` aún viven en la versión anterior.
 */
export const MODULOS = Object.freeze([
  { id: 'inicio', nombre: 'Inicio', icono: 'inicio', grupo: 'General', cargar: () => import('./inicio/index.js') },
  { id: 'auditorias', nombre: 'Auditorías', icono: 'auditorias', grupo: 'Gestión', descripcion: 'Listas de verificación y paciente incógnito', cargar: () => import('./auditorias/index.js') },
  { id: 'dashboard', nombre: 'Dashboard', icono: 'dashboard', grupo: 'Gestión', descripcion: 'Resultados, riesgo y tendencias', cargar: () => import('./dashboard/index.js') },
  { id: 'documentos', nombre: 'Documentos', icono: 'documentos', grupo: 'Gestión', descripcion: 'Elaboración, revisión y listado maestro', clasico: true },
  { id: 'indicadores', nombre: 'Indicadores', icono: 'indicadores', grupo: 'Gestión', descripcion: 'Seguimiento y fichas de medición', clasico: true },
  { id: 'iso', nombre: 'ISO 9001', icono: 'iso', grupo: 'Gestión', descripcion: 'Autoevaluación y plan de acción', clasico: true },
  { id: 'equipo', nombre: 'Equipo', icono: 'equipo', grupo: 'Gestión', descripcion: 'Auditores y carga de trabajo', permiso: 'equipo.ver', cargar: () => import('./equipo/index.js') },
  { id: 'usuarios', nombre: 'Usuarios', icono: 'ajustes', grupo: 'Administración', descripcion: 'Accesos y roles', permiso: 'usuarios.administrar', cargar: () => import('./admin/index.js') },
].map(Object.freeze));

export const buscarModulo = id => MODULOS.find(m => m.id === id) || null;
