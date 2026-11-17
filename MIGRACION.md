# Plan de migración

## Estado

| Módulo | Estado | Notas |
|---|---|---|
| Ingreso y sesión | Migrado | Solo correo/contraseña; cuenta pendiente; cierre por inactividad (30 min) |
| Inicio | Migrado | «Documentos por atender» vuelve cuando se migre Documentos |
| Auditorías (servicio y paciente incógnito) | Migrado | Listado, filtros, crear, papelera. El detalle e informe de paciente incógnito siguen en la clásica |
| Usuarios | Nuevo | Activación de cuentas y roles |
| Dashboard | Migrado | Se calcula desde Firebase (`auditorias` y su borrador), ya no desde el Apps Script público. Filtros por institución, mes y sede; tendencia, respuestas, categorías, sedes y hallazgos con observaciones |
| Equipo | Migrado | Solo gestor y administrador. Tarjeta por auditor con totales y sus auditorías |
| Documentos, Indicadores, ISO 9001 | Versión clásica | Se abren desde el menú con la etiqueta «Clásico» |

## Cambios de comportamiento respecto a la clásica

- El ingreso con Google se retiró: solo entran cuentas creadas en Firebase y activadas por un administrador.
- Los identificadores nuevos terminan en 8 caracteres aleatorios (antes, 4 dígitos del reloj, que podían repetirse).
- La fecha de creación usa la hora local (antes UTC: después de las 7 p. m. marcaba el día siguiente).
- La papelera ya no anuncia un borrado automático a los 30 días, porque nunca existió.
- Las subidas de la clásica pasan por el Worker; quedan deshabilitadas hasta configurarlo.
- Dashboard: los resultados salen de los mismos datos que guardan las listas, con su mismo puntaje (C = 1, CP = 0,5, NC = 0, N/A = 1). Las auditorías anteriores sin borrador en Firebase cuentan en promedios y tendencia, pero no en respuestas ni hallazgos.
- Equipo deja de verse para auditores y lectores. Ojo: las reglas siguen permitiendo que cualquier usuario activo lea `auditorias` (el Dashboard lo necesita); la restricción de Equipo es de interfaz.
- Los gráficos son SVG propios: se retiraron Chart.js y su plugin, que exigían relajar la CSP.

## Cómo migrar un módulo

1. Crea `src/modules/<nombre>/` con `model.js` (lógica pura, con pruebas) e `index.js` (`mount(el, ctx)` que devuelve su limpieza).
2. Lleva las lecturas y escrituras a `src/data/<nombre>.js` y comprueba permisos con `puede()`.
3. Añade las reglas del nodo en `firebase/database.rules.json` con validación por campo, y sus casos en `tests/rules/`.
4. En `registry.js` cambia `clasico: true` por `cargar: () => import('./<nombre>/index.js')`.
5. Si usa una librería externa, fija la versión, añade `integrity` y declara su origen en la CSP de `index.html`.

## Orden sugerido

1. ~~Equipo y Dashboard~~ (hecho).
2. **Detalle e informe de paciente incógnito.**
3. **Indicadores** (incluye subidas con el Worker y PDF).
4. **Documentos** (el más grande: editor, flujo de aprobación).
5. **ISO 9001.**
6. Listas de verificación: unificar FOCA y VIU en una sola con configuración, y renombrar los archivos con «(15)» manteniendo redirecciones para los QR impresos.

Cuando no quede ningún módulo con `clasico: true`, se elimina `legacy/`.
