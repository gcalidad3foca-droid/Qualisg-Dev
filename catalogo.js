/**
 * Catálogo de la lista de verificación de servicio (igual en FOCA y VIU).
 * Copia de `DATA` en Lista_Verificacion_*.html: si cambian allá, se actualiza aquí
 * (la prueba unitaria compara ambos).
 */

export const CATEGORIAS = Object.freeze([
  {
    nombre: 'ADMISIÓN',
    peso: 0.25,
    items: [
      'Verificar el saludo de bienvenida al usuario',
      'Verificar si el tiempo de atención está en el estándar establecido (3 a 5 min)',
      'Verificar identidad del usuario a través de solicitud de documento de identidad',
      'Verificar actualización de datos del paciente',
      'Verificación del servicio a prestar',
      'Verificar diligenciamiento correcto del nivel y valor de cuota moderadora / copago',
      'Verificar comprensión de la información, incluyendo dudas por parte del paciente/familiar',
      'Verificar invitación al buzón de sugerencias al paciente',
      'Verificar cumplimiento de la caja preferencial (que se encuentre demarcada con movilidad reducida, mujeres embarazadas y niños de brazos)'
    ]
  },
  {
    nombre: 'PRESTACIÓN DEL SERVICIO',
    peso: 0.2,
    items: [
      'El personal de orientación en el Smart Queue brinda información clara y completa, realiza educación sobre el uso de la herramienta y asigna el turno correspondiente al servicio requerido y mantiene trato respetuoso al usuario',
      'Verificar saludo y presentación por parte del equipo médico',
      'Verificar educación al paciente y/o cuidador sobre riesgos y beneficios de la dilatación ocular',
      'Verificar si el tiempo de atención está en el estándar establecido. Oftalmología (Max 20min - Min 10) Optometría (Max 10Min- 5Min)',
      'Verificar que el profesional de salud entregue y explique de manera clara al paciente el diagnóstico, el plan de tratamiento, la prescripción médica, las remisiones, las órdenes de estudios diagnósticos y, cuando aplique, la indicación de cirugía, asegurando su comprensión',
      'Verificar entrega efectiva de copias impresas del ordenamiento médico, incluye recomendaciones universales que incluya: verificación de la correcta identificación del paciente y el tiempo de entrega de orden (10min - 15max)'
    ]
  },
  {
    nombre: 'SEGURIDAD DEL PACIENTE',
    peso: 0.15,
    items: [
      'Verificar que los medicamentos en uso se encuentren rotulados y no superen los 30 días de apertura',
      'Verificar que los insumos se encuentran debidamente rotulados incluyendo: nombre del producto, fecha de apertura, fecha de vencimiento y número de lote',
      'Verificar instalación de señalética de seguridad del paciente en consultorio y baños: QR, correcto lavado de manos y los 5 momentos de lavado de manos',
      'Verificar la correcta aplicación del protocolo de lavado de manos durante la consulta',
      'Validar si existe alguna condición o situación que pueda representar un riesgo para la seguridad de los pacientes',
      'Verificar que los formatos de registro de temperatura y humedad estén correctamente diligenciados y al día'
    ]
  },
  {
    nombre: 'AMBIENTE HUMANIZADO',
    peso: 0.2,
    items: [
      'Verificar el confort térmico en áreas como SIAU, sala de espera y consulta externa al momento de la presente auditoría',
      'Verificar la existencia de ruido y/o información visual exagerada en las áreas inspeccionadas',
      'Verificar disponibilidad de sillas de acuerdo al número de pacientes al momento de realizar la auditoría',
      'Verificar señalización de áreas y personas claves para las actividades de: Ingreso, admisión y consulta',
      'Verificación de segregación de residuos',
      'Verificación de limpieza, organización y cumplimiento del cuarto de residuos según los estándares de habilitación',
      'Verificación de limpieza del puesto de trabajo (asesores auxiliares, coordinador, sede)',
      'Verificación de limpieza en el área de sala de espera',
      'Verificación de limpieza en los consultorios elegidos por el auditor',
      'Verificación de limpieza en los baños de la institución',
      'Verificación de limpieza y orden en la zona del exterior de la sede',
      'Verificar instalación y funcionamiento del sistema de alarma en los baños para discapacitados'
    ]
  },
  {
    nombre: 'PQRS',
    peso: 0.1,
    items: [
      'Verificar la disponibilidad de los mecanismos para la recepción de PQRSF.',
      'Verificar el adecuado funcionamiento de los mecanismos de recepción de PQRSF.',
      'Validar la disponibilidad de formatos físicos y elementos de escritura para la presentación de PQRSF.',
      'Verificar la ausencia de barreras para la presentación de PQRSF por parte de los usuarios.',
      'Revisar los registros de apertura del buzón de sugerencias del último mes.'
    ]
  },
  {
    nombre: 'ATENCIÓN Y EXPERIENCIA AL USUARIO',
    peso: 0,
    items: [
      'Verificar trato cordial, respetuoso y empático durante la atención al usuario.',
      'Verificar la actualización de los datos de contacto del usuario.',
      'Verificar claridad y oportunidad en la información suministrada al usuario.',
      'Verificar adecuada gestión y direccionamiento de solicitudes, inquietudes o inconformidades manifestadas por el usuario.'
    ]
  },
  {
    nombre: 'PROTOCOLO DE IMAGEN',
    peso: 0.1,
    items: [
      'Verificar porte individual de carnet',
      'Verificar uso de accesorios discretos',
      'Verificar restricciones en usos de abrigos, bufandas y buzos de colores diferentes al negro',
      'Revisar uñas, peinado y maquillaje acorde al protocolo de imagen'
    ]
  }
].map(c => Object.freeze({ ...c, items: Object.freeze(c.items) })));

/** Mismo algoritmo que `makeId` en las listas: es la clave de cada respuesta en `draft.radios`. */
export function idItem(categoria, indice) {
  return `${categoria.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${indice}`;
}

/** Puntaje por respuesta, igual que la lista (N/A cuenta como cumplido). */
export const PUNTAJE = Object.freeze({ C: 1, CP: 0.5, NC: 0, NA: 1 });
export const RESULTADOS = Object.freeze(['C', 'CP', 'NC', 'NA']);
export const NOMBRE_RESULTADO = Object.freeze({ C: 'Conforme', CP: 'Cumple parcial', NC: 'No conforme', NA: 'No aplica' });

/** Índice idItem → { categoria, texto }. */
export const ITEMS = Object.freeze(
  Object.fromEntries(CATEGORIAS.flatMap(c => c.items.map((texto, i) => [idItem(c.nombre, i), Object.freeze({ categoria: c.nombre, texto })]))),
);
