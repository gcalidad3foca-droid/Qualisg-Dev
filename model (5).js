/** Lógica pura de Equipo: agrupa las auditorías vigentes por auditor. */
import { mesDe } from '../dashboard/model.js';

/**
 * @param lista auditorías (aLista)
 * @param perfiles nodo `perfiles` { uid: { nombre, cargo, avatarUrl } }
 * @param filtros { institucion: 'todas'|'foca'|'viu', mes: 'AAAA-MM'|'' } — filtran la lista de cada tarjeta
 */
export function agruparPorAuditor(lista, perfiles = {}, { institucion = 'todas', mes = '' } = {}) {
  const grupos = {};
  lista
    .filter(a => !a.deletedAt && a.uid)
    .forEach(a => {
      const p = perfiles[a.uid] && typeof perfiles[a.uid] === 'object' ? perfiles[a.uid] : {};
      const g = (grupos[a.uid] ||= {
        uid: a.uid,
        nombre: String(p.nombre || a.auditorNombre || a.email || 'Sin nombre').slice(0, 80),
        cargo: String(p.cargo || a.auditorCargo || 'Auditor').slice(0, 80),
        avatarUrl: p.avatarUrl || '',
        todas: [],
      });
      g.todas.push(a);
    });

  return Object.values(grupos)
    .map(g => {
      const notas = g.todas.filter(a => a.porcentaje !== null && a.porcentaje !== undefined).map(a => a.porcentaje);
      const visibles = g.todas
        .filter(a => (institucion === 'todas' || (a.institucion || 'foca') === institucion) && (!mes || mesDe(a) === mes))
        .sort((x, y) => String(y.fecha || '').localeCompare(String(x.fecha || '')) || (y.createdAt || 0) - (x.createdAt || 0));
      return {
        uid: g.uid,
        nombre: g.nombre,
        cargo: g.cargo,
        avatarUrl: g.avatarUrl,
        total: g.todas.length,
        completadas: g.todas.filter(a => a.estado === 'completada').length,
        enProgreso: g.todas.filter(a => a.estado !== 'completada').length,
        promedio: notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null,
        visibles,
      };
    })
    .sort((x, y) => y.total - x.total || x.nombre.localeCompare(y.nombre, 'es'));
}

export function mesesDisponibles(lista) {
  return [...new Set(lista.filter(a => !a.deletedAt).map(mesDe).filter(Boolean))].sort().reverse();
}
