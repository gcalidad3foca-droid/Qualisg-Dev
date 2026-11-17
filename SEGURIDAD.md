# Seguridad y puesta en producción

Sigue los pasos en orden. Los tres primeros solo los puede hacer quien administra las cuentas de Cloudflare y Firebase.

## 1. Rotar la llave de R2 (urgente)

La llave anterior quedó publicada en el historial de git; borrarla del código no la invalida.

1. Cloudflare → R2 → *Manage API tokens* → revoca el token usado por Qualisig.
2. No crees otro para el navegador: el Worker usa un *binding* y no necesita llaves.
3. Revisa el bucket `qualisigev` por archivos que no reconozcas.

## 2. Desplegar el Worker de archivos

```bash
cd worker
npx wrangler deploy
```

Copia la URL que entrega (`https://qualisig-archivos.<cuenta>.workers.dev`) en `R2_WORKER_URL` dentro de `legacy/index.html`. Ajusta `ALLOWED_ORIGINS` en `wrangler.toml` si cambia el dominio.

El Worker verifica el token de Firebase, exige una ficha activa con rol distinto de lector, limita carpetas, tipos (sin HTML ni SVG), tamaño (20 MB), compara el contenido con el tipo declarado y no sobrescribe archivos.

## 3. Crear el primer administrador y publicar las reglas

1. Firebase → Authentication → *Sign-in method*: deja habilitado solo **Correo/contraseña**. Desactiva Google y el registro abierto si no los usas.
2. Authentication → *Users*: copia tu **UID**.
3. Realtime Database → *Datos*: crea `usuarios/<tu UID>` con `rol: "admin"` y `activo: true` (booleano).
4. Realtime Database → *Reglas*: pega el contenido de `firebase/database.rules.json` y publica. Con Firebase CLI: `firebase deploy --only database` desde `firebase/`.

Publica las reglas **después** de crear tu ficha; si no, nadie podrá entrar.

Comprueba enseguida, con tu cuenta, estas cuatro cosas (ninguna pudo probarse sin acceso al proyecto real):

- entras a `index.html` y ves tus auditorías;
- creas una auditoría y la lista de verificación **guarda** (las listas no se modificaron: dependen de compartir la sesión del mismo dominio);
- una encuesta de paciente incógnito abierta desde el QR, sin sesión, se envía;
- en una ventana privada, `https://qualisig-auditorias-default-rtdb.firebaseio.com/auditorias.json` responde *Permission denied*.

Si la lista no guarda, vuelve a las reglas anteriores y avísame: habrá que añadirle el inicio de sesión explícito.

Las demás personas: se crean en Authentication, ingresan una vez y aparecen en **Usuarios → Solicitudes pendientes**, donde les asignas rol.

## 4. Modelo de acceso

| Rol | Puede |
|---|---|
| Administrador | Todo; gestiona usuarios; edita y borra cualquier registro |
| Gestor de calidad | Crea y gestiona sus auditorías; administra las de paciente incógnito que llegan por QR |
| Auditor | Crea y diligencia sus propias auditorías |
| Lector | Solo consulta |

La misma matriz está en `src/core/permissions.js` (interfaz) y en las reglas (servidor). El servidor es el que manda.

## 5. Riesgos que quedan y por qué

- **Encuesta de paciente incógnito por QR.** El paciente no tiene cuenta, así que las reglas dejan un carril público acotado: crear una encuesta y actualizarla mientras esté en progreso; nunca listar, borrar, cambiar el dueño ni tocar una completada. Alguien que adivine un id podría alterar una encuesta abierta. Mitigación recomendada: activar **Firebase App Check** e ingreso anónimo en esas dos listas.
- **Listas de verificación.** No se modificaron. Usan la sesión del mismo origen; si el auditor no ha iniciado sesión en Qualisig, la lista no podrá guardar.
- **Versión clásica.** Conserva su código original (HTML sin escapar, `onclick` en línea, sin CSP). Las reglas protegen los datos, pero el riesgo de XSS en esa página persiste hasta migrar cada módulo. El perfil «adoptado» por coincidencia de correo deja de funcionar para quien no sea administrador.
- **Bucket público.** Los archivos de R2 siguen siendo legibles por quien tenga la URL. Para hacerlo privado hay que servir las lecturas desde el Worker.
- **Equipo y lectura de auditorías.** Equipo solo aparece para gestor y administrador, pero las reglas dejan leer `auditorias` a todo usuario activo porque el Dashboard muestra resultados del equipo. Si los auditores no deben ver auditorías ajenas, hay que servir el Dashboard con datos agregados (por ejemplo, un resumen que escriba una Cloud Function) y cerrar la lectura.
- **Cabeceras HTTP.** GitHub Pages no permite enviar `frame-ancestors` ni HSTS propios; la CSP va en una etiqueta `<meta>`. Poner Cloudflare delante del dominio lo resuelve.
- **`xlsx@0.18.5`, jsPDF y TinyMCE** siguen cargándose en la versión clásica sin SRI. Al migrar esos módulos se fijan versiones corregidas.

## 6. Qué cubren las pruebas

- Unitarias (38): escape de salida, URLs, claves, permisos (incluido `equipo.ver`), cálculos del Dashboard y Equipo, catálogo sincronizado con las listas, sesión y revocación en vivo, inactividad, repositorios, Worker (tokens falsificados, tipos, rutas).
- Reglas: 7 grupos de casos sobre un simulador de reglas. Antes de publicar, repítelas en el *Simulador de reglas* de la consola de Firebase con un par de casos reales.
- Navegador: 13 escenarios sobre la demostración: ingreso, roles, auditorías, papelera, usuarios, Dashboard (filtros, hallazgos), Equipo, móvil, y datos hostiles en sede y observaciones que deben verse como texto.

No se probó contra el proyecto real de Firebase ni contra Cloudflare: eso ocurre en los pasos 2 y 3.
