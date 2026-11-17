import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { puede } from '../../src/core/permissions.js';
import { CATEGORIAS, ITEMS, idItem } from '../../src/modules/auditorias/catalogo.js';
import { aplicarFiltros, distribucion, hallazgos, mesDe, nombreMes, opciones, porCategoria, porSede, respuestas, resumen, tendencia, variacion } from '../../src/modules/dashboard/model.js';
import { agruparPorAuditor, mesesDisponibles } from '../../src/modules/equipo/model.js';
import { barra, linea } from '../../src/ui/graficos.js';

const id0 = idItem('ADMISIÓN', 0);
const id1 = idItem('ADMISIÓN', 1);
const idP = idItem('PQRS', 0);
const textoP = ITEMS[idP].texto;

const lista = [
  { id: 'a', uid: 'u1', institucion: 'foca', sede: 'Norte', fecha: '2026-10-05', estado: 'completada', porcentaje: 80, draft: { radios: { [id0]: 'NC', [id1]: 'C', [idP]: 'NC', basura: 'NC', [idItem('PQRS', 1)]: '<b>' }, obs: { [textoP.replace(/[.#$[\]/]/g, '_')]: '  Sin buzón  ' } } },
  { id: 'b', uid: 'u2', institucion: 'viu', sede: 'Centro', fecha: '2026-11-02', estado: 'completada', porcentaje: 95, draft: { radios: { [id0]: 'CP', [id1]: 'NA' } } },
  { id: 'c', uid: 'u1', institucion: 'foca', sede: 'Norte', fecha: '2026-11-10', estado: 'en-progreso', porcentaje: 88 },
  { id: 'd', uid: 'u1', institucion: 'foca', sede: 'Sur', fecha: '2026-11-11', estado: 'en-progreso', porcentaje: null },
  { id: 'e', uid: 'u2', institucion: 'foca', sede: 'Sur', fecha: '2026-09-01', estado: 'completada', porcentaje: 50, deletedAt: 9 },
];

test('el catálogo coincide con las listas de verificación FOCA y VIU', () => {
  for (const archivo of ['Lista_Verificacion_FOCA.html', 'Lista_Verificacion_VIU.html']) {
    const fuente = readFileSync(new URL(`../../${archivo}`, import.meta.url), 'utf8');
    const bloque = /const DATA = (\[[\s\S]*?\n\]);/.exec(fuente)[1];
    const data = Function(`"use strict"; return ${bloque};`)();
    assert.deepEqual(
      data.map(s => ({ nombre: s.name, peso: s.weight, items: s.items })),
      CATEGORIAS.map(c => ({ nombre: c.nombre, peso: c.peso, items: [...c.items] })),
      `${archivo} cambió: actualiza src/modules/auditorias/catalogo.js`,
    );
  }
  assert.equal(id0, 'admisi-n-0');
});

test('fechas, filtros y opciones ignoran papelera y sin calificar', () => {
  assert.equal(mesDe({ fecha: '2026-11-02' }), '2026-11');
  assert.equal(mesDe({ fecha: '2026-13-02' }), '');
  assert.equal(nombreMes('2026-11'), 'Nov 26');
  assert.equal(nombreMes('2026-11', true), 'Noviembre 2026');
  assert.deepEqual(opciones(lista), { meses: ['2026-11', '2026-10'], sedes: ['Centro', 'Norte'] });
  assert.deepEqual(aplicarFiltros(lista).map(a => a.id), ['a', 'b', 'c']);
  assert.deepEqual(aplicarFiltros(lista, { institucion: 'viu' }).map(a => a.id), ['b']);
  assert.deepEqual(aplicarFiltros(lista, { mes: '2026-11', sede: 'Norte' }).map(a => a.id), ['c']);
});

test('resumen, tendencia y sedes', () => {
  const d = aplicarFiltros(lista);
  assert.deepEqual(resumen(d), { total: 3, promedio: 88, sedes: 2, riesgoBajo: 1, riesgoMedio: 1, riesgoAlto: 1 });
  const serie = tendencia(d);
  assert.deepEqual(serie.map(p => [p.mes, p.valor, p.n]), [['2026-10', 80, 1], ['2026-11', 92, 2]]);
  assert.equal(variacion(serie), 12);
  assert.equal(variacion(serie.slice(0, 1)), null);
  assert.deepEqual(porSede(d).map(s => [s.sede, s.valor]), [['Norte', 84], ['Centro', 95]]);
  assert.deepEqual(resumen([]).promedio, null);
});

test('respuestas: solo ítems del catálogo y resultados válidos', () => {
  assert.equal(respuestas(lista[0]).length, 3);
  assert.deepEqual(respuestas({}), []);
  assert.deepEqual(respuestas({ draft: { radios: 'x' } }), []);
  const d = aplicarFiltros(lista);
  assert.deepEqual(distribucion(d), { C: 1, CP: 1, NC: 2, NA: 1, total: 5 });
  const cats = porCategoria(d);
  assert.deepEqual(cats.map(c => [c.nombre, c.valor, c.noConformes]), [['ADMISIÓN', 63, 1], ['PQRS', 0, 1]]);
});

test('hallazgos agrupan por ítem con sedes y observaciones recortadas', () => {
  const h = hallazgos(aplicarFiltros(lista), 'NC');
  assert.equal(h.length, 2);
  const pq = h.find(x => x.id === idP);
  assert.deepEqual(pq.sedes, ['Norte']);
  assert.deepEqual(pq.observaciones, [{ texto: 'Sin buzón', sede: 'Norte', fecha: '2026-10-05' }]);
  assert.equal(hallazgos(aplicarFiltros(lista), 'CP')[0].veces, 1);
  assert.equal(hallazgos(aplicarFiltros(lista), 'NC', 1).length, 1);
});

test('equipo: agrupa por auditor, usa el perfil y filtra solo la lista visible', () => {
  const eq = agruparPorAuditor(lista, { u1: { nombre: 'Ana <b>', cargo: 'Gestora' } }, { institucion: 'foca', mes: '2026-11' });
  assert.deepEqual(eq.map(p => [p.uid, p.nombre, p.total, p.completadas, p.enProgreso, p.promedio, p.visibles.map(a => a.id)]), [
    ['u1', 'Ana <b>', 3, 1, 2, 84, ['d', 'c']],
    ['u2', 'Sin nombre', 1, 1, 0, 95, []],
  ]);
  assert.deepEqual(mesesDisponibles(lista), ['2026-11', '2026-10']);
});

test('Equipo solo para gestor y administrador', () => {
  const s = rol => ({ uid: 'x', rol, activo: true });
  assert.deepEqual(['admin', 'gestor', 'auditor', 'lector'].map(r => puede(s(r), 'equipo.ver')), [true, true, false, false]);
  assert.equal(puede({ uid: 'x', rol: 'admin', activo: false }, 'equipo.ver'), false);
});

test('gráficos: valores acotados y texto escapado', () => {
  assert.match(String(barra(140)), /width="100"/);
  assert.match(String(barra('x')), /class="hb-v marca" width="0"/);
  const svg = String(linea([{ etiqueta: '<i>', valor: 80 }, { etiqueta: 'b', valor: 90 }]));
  assert.ok(!svg.includes('<i>') && svg.includes('&lt;i&gt;'));
  assert.equal(String(linea([])), '');
});
