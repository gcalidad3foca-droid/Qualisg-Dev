/**
 * Demostración con datos ficticios en memoria. No se conecta a Firebase.
 * Sirve para revisar el diseño y para las pruebas de extremo a extremo.
 * Cuentas: admin@demo.co · gestor@demo.co · auditor@demo.co · lector@demo.co · nueva@demo.co — clave: demo1234
 */
import { start } from '../src/app.js';
import { createMemoryBackend } from '../src/core/backend/memory.js';
import { CATEGORIAS, idItem } from '../src/modules/auditorias/catalogo.js';

const hoy = new Date();
const dia = n => {
  const d = new Date(hoy);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const t = n => hoy.getTime() - n * 86_400_000;
const aud = (uid, nombre, institucion, sede, n, estado, porcentaje, extra = {}) => ({
  uid, email: `${uid}@demo.co`, auditorNombre: nombre, auditorCargo: 'Auditor', institucion, sede,
  fecha: dia(n), estado, porcentaje, createdAt: t(n), updatedAt: t(n), ...extra,
});

/** Borrador determinista: cada auditoría responde los ítems con un patrón propio. */
const OBS = ['No se evidenció el saludo protocolario.', 'Tiempo de espera superior al estándar.', 'Falta señalización en la caja preferencial.', 'Se explicó de forma incompleta.', '<img src=x on' + 'error="window.__xss=2">'];
const borrador = (semilla, rigor) => {
  const radios = {};
  const obs = {};
  let k = semilla;
  CATEGORIAS.forEach(c =>
    c.items.forEach((texto, i) => {
      k = (k * 9301 + 49297) % 233280;
      const r = k / 233280;
      const res = r < rigor * 0.55 ? 'NC' : r < rigor ? 'CP' : r > 0.95 ? 'NA' : 'C';
      radios[idItem(c.nombre, i)] = res;
      if (res !== 'C' && res !== 'NA' && r < rigor * 0.4) obs[texto.replace(/[.#$[\]/]/g, '_')] = OBS[(semilla + i) % OBS.length];
    }),
  );
  return { draft: { radios, obs } };
};
const historico = Object.fromEntries(
  [
    ['u-auditor', 'Carlos Prueba', 'foca', 'Sede Norte', 35, 86, 0.22],
    ['u-auditor', 'Carlos Prueba', 'viu', 'Sede Centro', 40, 92, 0.12],
    ['u-gestor', 'Gina Gestión', 'foca', 'Sede Sur', 62, 81, 0.3],
    ['u-gestor', 'Gina Gestión', 'foca', 'Sede Norte', 70, 84, 0.25],
    ['u-auditor', 'Carlos Prueba', 'viu', 'Sede Centro', 95, 79, 0.32],
    ['u-gestor', 'Gina Gestión', 'foca', 'Sede Sur', 120, 83, 0.28],
    ['u-auditor', 'Carlos Prueba', 'foca', 'Sede Norte', 150, 76, 0.36],
    ['u-gestor', 'Gina Gestión', 'viu', 'Sede Antigua', 18, 94, 0.08],
  ].map(([uid, nombre, inst, sede, n, pct, rigor], i) => [
    `AUD-DEMO-H${String(i + 1).padStart(3, '0')}`,
    aud(uid, nombre, inst, sede, n, 'completada', pct, borrador(i + 11, rigor)),
  ]),
);

const backend = createMemoryBackend({
  usuarios: [
    { uid: 'u-admin', email: 'admin@demo.co', clave: 'demo1234' },
    { uid: 'u-auditor', email: 'auditor@demo.co', clave: 'demo1234' },
    { uid: 'u-lector', email: 'lector@demo.co', clave: 'demo1234' },
    { uid: 'u-nueva', email: 'nueva@demo.co', clave: 'demo1234' },
    { uid: 'u-gestor', email: 'gestor@demo.co', clave: 'demo1234' },
  ],
  datos: {
    usuarios: {
      'u-admin': { rol: 'admin', activo: true, email: 'admin@demo.co' },
      'u-auditor': { rol: 'auditor', activo: true, email: 'auditor@demo.co' },
      'u-lector': { rol: 'lector', activo: true, email: 'lector@demo.co' },
      'u-gestor': { rol: 'gestor', activo: true, email: 'gestor@demo.co' },
    },
    solicitudes: { 'u-nueva': { email: 'nueva@demo.co', creada: t(0) } },
    perfiles: {
      'u-admin': { nombre: 'Ana Demo', cargo: 'Gestora de Calidad' },
      'u-auditor': { nombre: 'Carlos Prueba', cargo: 'Auditor' },
      'u-lector': { nombre: 'Lucía Lectura', cargo: 'Consulta' },
      'u-gestor': { nombre: 'Gina Gestión', cargo: 'Gestora de Calidad' },
    },
    auditorias: {
      'AUD-DEMO-0001': aud('u-admin', 'Ana Demo', 'foca', 'Sede Norte', 1, 'en-progreso', 78, borrador(1, 0.24)),
      'AUD-DEMO-0002': aud('u-admin', 'Ana Demo', 'viu', 'Sede Centro', 4, 'completada', 95, borrador(2, 0.05)),
      'AUD-DEMO-0003': aud('u-admin', 'Ana Demo', 'foca', 'Sede Sur', 9, 'completada', 88, borrador(3, 0.14)),
      'AUD-DEMO-0004': aud('u-admin', 'Ana Demo', 'foca', '', 0, 'en-progreso', null),
      'AUD-DEMO-0005': aud('u-admin', 'Ana Demo', 'viu', 'Sede Antigua', 30, 'completada', 91, { deletedAt: t(2) }),
      'AUD-DEMO-0006': aud('u-admin', 'Ana Demo', 'foca', '<img src=x on' + 'error="window.__xss=1">', 2, 'en-progreso', 60, borrador(4, 0.4)),
      ...historico,
      'AUD-DEMO-0007': aud('u-auditor', 'Carlos Prueba', 'foca', 'Sede Norte', 3, 'completada', 93, borrador(5, 0.08)),
    },
    auditorias_pi: {
      'PI-DEMO-0001': { tipo: 'paciente-incognito', ...aud('u-admin', 'Ana Demo', 'foca', 'Sede Norte', 2, 'completada', 90) },
      'PI-DEMO-0002': { tipo: 'paciente-incognito', origen: 'qr-paciente', institucion: 'viu', sede: 'Sede Centro', fecha: dia(1), estado: 'en-progreso', porcentaje: null, createdAt: t(1), updatedAt: t(1) },
    },
  },
});

start(backend);
