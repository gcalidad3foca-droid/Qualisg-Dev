import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SafeHtml, escapeHtml, esClaveValida, html, idAleatorio, limpiarTexto, raw, render, safeUrl, sanearClave } from '../../src/core/security.js';

test('escapeHtml neutraliza los caracteres peligrosos', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&\``), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;&#96;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(0), '0');
});

test('html escapa interpolaciones y respeta fragmentos seguros', () => {
  const mal = '<script>alert(1)</script>';
  const out = html`<p title="${'" onmouseover="x'}">${mal}${html`<b>${mal}</b>`}${[html`<i>1</i>`, '<2>']}${null}${false}${0}</p>`;
  assert.ok(out instanceof SafeHtml);
  assert.equal(
    out.texto,
    '<p title="&quot; onmouseover=&quot;x">&lt;script&gt;alert(1)&lt;/script&gt;<b>&lt;script&gt;alert(1)&lt;/script&gt;</b><i>1</i>&lt;2&gt;0</p>',
  );
});

test('un objeto que imita a SafeHtml no se cuela', () => {
  const falso = { texto: '<img src=x onerror=1>', toString: () => '<img src=x onerror=1>' };
  assert.ok(!html`${falso}`.texto.includes('<img'));
});

test('render rechaza cadenas sin sanear', () => {
  const el = { innerHTML: '' };
  assert.throws(() => render(el, '<b>hola</b>'), TypeError);
  render(el, raw('<b>ok</b>'));
  assert.equal(el.innerHTML, '<b>ok</b>');
});

test('safeUrl solo admite https en hosts permitidos', () => {
  const hosts = ['i.imgur.com', '*.r2.dev'];
  assert.equal(safeUrl('https://i.imgur.com/a.png', hosts), 'https://i.imgur.com/a.png');
  assert.equal(safeUrl('https://pub-1.r2.dev/x.png', hosts), 'https://pub-1.r2.dev/x.png');
  for (const mala of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'http://i.imgur.com/a.png', 'https://evil.com/i.imgur.com', 'https://i.imgur.com.evil.com/a', 'https://user:pw@i.imgur.com/a', 'https://r2.dev.evil.com/a', '//i.imgur.com/a', '', null, 42]) {
    assert.equal(safeUrl(mala, hosts), '', String(mala));
  }
});

test('claves de Firebase', () => {
  assert.ok(esClaveValida('AUD-20261116-ABCD2345'));
  for (const mala of ['', 'a/b', 'a.b', 'a#b', 'a$b', 'a[b', 'a]b', 'x'.repeat(129), 'a\nb', null]) assert.ok(!esClaveValida(mala), String(mala));
  assert.equal(sanearClave('Sede 1.2/Norte#[x]$'), 'Sede 1_2_Norte__x__');
  assert.equal(sanearClave(''), '_');
  assert.ok(esClaveValida(sanearClave('../../usuarios')));
});

test('limpiarTexto recorta y quita caracteres de control', () => {
  assert.equal(limpiarTexto('  hola\u0000\u0007 mundo  ', 8), 'hola mun');
  assert.equal(limpiarTexto(undefined), '');
});

test('idAleatorio es del largo pedido y no se repite', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => idAleatorio(8)));
  assert.equal(ids.size, 2000);
  for (const id of ids) assert.match(id, /^[A-HJKMNP-Z2-9]{8}$/);
});
