/*
 * Script clásico (no módulo): corre aunque los módulos estén bloqueados.
 * 1) Si la página se abrió con doble clic (file://), el navegador bloquea los módulos:
 *    se explica cómo abrirla.
 * 2) Si a los 12 s la app sigue en la pantalla de carga, se ofrece recargar.
 * Solo usa textContent y createElement: nada de HTML en cadenas.
 */
(function () {
  'use strict';

  function mostrar(titulo, lineas, conBoton) {
    var app = document.getElementById('app');
    if (!app || !app.querySelector('.splash')) return;
    var caja = document.createElement('div');
    caja.className = 'login';
    var tarjeta = document.createElement('div');
    tarjeta.className = 'lcard';
    var cuerpo = document.createElement('div');
    cuerpo.className = 'lwait';
    var h = document.createElement('h2');
    h.textContent = titulo;
    cuerpo.appendChild(h);
    lineas.forEach(function (texto, i) {
      var p = document.createElement(i === 1 ? 'code' : 'p');
      p.textContent = texto;
      if (i === 1) p.className = 'cmd';
      cuerpo.appendChild(p);
    });
    tarjeta.appendChild(cuerpo);
    if (conBoton) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn pri full';
      b.textContent = 'Recargar';
      b.addEventListener('click', function () { location.reload(); });
      tarjeta.appendChild(b);
    }
    caja.appendChild(tarjeta);
    app.replaceChildren(caja);
  }

  if (location.protocol === 'file:') {
    var listo = function () {
      mostrar(
        'Abre Qualisig desde un servidor',
        [
          'Por seguridad, el navegador no ejecuta la aplicación si se abre con doble clic. Ábrela desde su dirección web publicada, o en tu computador, dentro de la carpeta del proyecto, ejecuta:',
          'python -m http.server 8080',
          'y entra a http://localhost:8080',
        ],
        false,
      );
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo);
    else listo();
    return;
  }

  setTimeout(function () {
    mostrar('Qualisig está tardando en cargar', ['Revisa tu conexión a internet o si una extensión del navegador bloquea gstatic.com o firebaseio.com, y vuelve a intentarlo.'], true);
  }, 12000);
})();
