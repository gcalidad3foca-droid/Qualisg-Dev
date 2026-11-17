# Qualisig

Sistema de gestión de calidad de FOCA y VIU. Aplicación web modular, sin paso de compilación: GitHub Pages sirve los archivos tal cual.

## Estructura

```
index.html                 Entrada de producción (CSP estricta, sin código en línea)
assets/css/                tokens · base · components · layout · views
src/
  boot.js                  Conecta la app con Firebase
  app.js                   Ingreso → cuenta pendiente → aplicación
  config.js                Configuración pública (aquí no van secretos)
  core/                    security · permissions · session · router · backend/
  data/                    Único punto que lee y escribe en la base de datos
  ui/                      icons · toast · dialog · dom · graficos (SVG, sin librerías)
  modules/                 registry + un módulo por carpeta (inicio, auditorias, dashboard, equipo, admin)
firebase/database.rules.json   Reglas de seguridad de la base de datos
worker/                    Worker de Cloudflare para subir archivos a R2 sin llaves en el navegador
legacy/index.html          Versión clásica: módulos aún no migrados
dev/demo.html              Demostración con datos ficticios (no toca Firebase)
tests/                     unit · rules · e2e · check-static
Lista_*.html               Listas de verificación (sin cambios)
```

## Uso

```bash
npm install          # solo para las pruebas
npm start            # http://localhost:8080  ·  demostración en /dev/demo.html
npm run check        # secretos, HTML sin sanear, CSP
npm test             # unitarias (seguridad, permisos, sesión, auditorías, Worker)
npm run test:rules   # reglas de la base de datos
npm run test:e2e     # navegador (requiere `pip install playwright` y Chrome)
```

Cuentas de la demostración: `admin@demo.co`, `gestor@demo.co`, `auditor@demo.co`, `lector@demo.co`, `nueva@demo.co` — clave `demo1234`.

## Reglas del código

1. Nada de `innerHTML` con cadenas: se usa ``render(el, html`…`)``, que escapa cada dato.
2. Nada de `onclick=` ni `style=` en línea: eventos con `data-action` y `delegar()`.
3. Toda escritura pasa por `src/data/` y comprueba el permiso con `puede()`.
4. Ningún secreto en el repositorio. Lo que necesite una llave vive en el Worker.
5. Un módulo nuevo = una carpeta en `src/modules/` + una línea en `registry.js`.

Antes de publicar, sigue [docs/SEGURIDAD.md](docs/SEGURIDAD.md). El plan de traslado de módulos está en [docs/MIGRACION.md](docs/MIGRACION.md).
