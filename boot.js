/** Entrada de producción: conecta la aplicación con Firebase. */
import { start } from './app.js';
import { createFirebaseBackend } from './core/backend/firebase.js';
import { html, render } from './core/security.js';

try {
  start(await createFirebaseBackend());
} catch (error) {
  console.error(error);
  render(
    document.getElementById('app'),
    html`<div class="login"><div class="lcard"><div class="lwait"><h2>No se pudo conectar</h2><p>Revisa tu conexión a internet y recarga la página.</p></div></div></div>`,
  );
}
