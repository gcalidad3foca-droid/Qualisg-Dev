/**
 * Verificación estática de las reglas de seguridad del proyecto. Falla el CI si:
 *  - aparece un patrón con forma de secreto en el código publicado,
 *  - se asigna innerHTML fuera de core/security.js,
 *  - hay manejadores o estilos en línea (incompatibles con la CSP),
 *  - un import relativo no existe.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const recorrer = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? recorrer(p) : [p];
});

const fallos = [];
const propios = [...recorrer('src'), ...recorrer('dev'), ...recorrer('worker/src'), 'index.html'];
const publicados = [...propios, ...recorrer('legacy'), ...recorrer('assets'), ...readdirSync('.').filter(f => f.endsWith('.html'))];

const SECRETOS = [
  [/secretAccessKey\s*[:=]\s*['"][^'"]+['"]/i, 'llave secreta de almacenamiento'],
  [/accessKeyId\s*[:=]\s*['"][^'"]+['"]/i, 'identificador de llave de almacenamiento'],
  [/gsk_[A-Za-z0-9]{20,}/, 'llave de Groq'],
  [/sk-[A-Za-z0-9_-]{24,}/, 'llave de API'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'llave privada'],
  [/"private_key"\s*:/, 'cuenta de servicio'],
];
for (const f of new Set(publicados)) {
  const texto = readFileSync(f, 'utf8');
  for (const [re, nombre] of SECRETOS) if (re.test(texto)) fallos.push(`${f}: posible ${nombre}`);
}

for (const f of propios) {
  const texto = readFileSync(f, 'utf8');
  if (f.endsWith('.js')) {
    if (!f.endsWith('core/security.js') && /\.(innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML|document\.write/.test(texto)) fallos.push(`${f}: HTML sin sanear (usa render/html)`);
    if (/\beval\s*\(|new Function\s*\(/.test(texto)) fallos.push(`${f}: eval / new Function`);
    for (const m of texto.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      if (!existsSync(resolve(dirname(f), m[1]))) fallos.push(`${f}: import inexistente ${m[1]}`);
    }
  }
  if (/\son[a-z]+\s*=\s*["'`]/i.test(texto)) fallos.push(`${f}: manejador de evento en línea`);
  if (/<[a-z][^>]*\sstyle\s*=/i.test(texto)) fallos.push(`${f}: estilo en línea`);
  if (f.endsWith('.html') && /<script(?![^>]*\ssrc=)[^>]*>/i.test(texto)) fallos.push(`${f}: script en línea`);
}

for (const f of ['index.html', 'dev/demo.html']) {
  const texto = readFileSync(f, 'utf8');
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(texto)?.[1] || '';
  if (!csp.includes("default-src 'none'")) fallos.push(`${f}: falta CSP estricta`);
  if (/unsafe-inline|unsafe-eval/.test(csp)) fallos.push(`${f}: la CSP permite código en línea`);
}

try {
  JSON.parse(readFileSync('firebase/database.rules.json', 'utf8'));
} catch {
  fallos.push('firebase/database.rules.json: JSON inválido');
}

if (fallos.length) {
  console.error(fallos.join('\n'));
  process.exit(1);
}
console.log(`Verificación estática correcta (${propios.length} archivos propios, ${new Set(publicados).size} publicados).`);
