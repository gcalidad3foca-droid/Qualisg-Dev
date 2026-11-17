/**
 * Backend en memoria con la misma interfaz que el de Firebase.
 * Se usa en pruebas y en la vista de demostración (dev/demo.html). No toca datos reales.
 */

const partes = ruta => String(ruta).split('/').filter(Boolean);
const clonar = v => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

function podar(nodo) {
  if (nodo === null || typeof nodo !== 'object') return nodo ?? null;
  const salida = {};
  for (const [k, v] of Object.entries(nodo)) {
    const hijo = podar(v);
    if (hijo !== null) salida[k] = hijo;
  }
  return Object.keys(salida).length ? salida : null;
}

export function createMemoryBackend({ datos = {}, usuarios = [], reloj = () => Date.now(), sesionInicial = null } = {}) {
  let raiz = podar(clonar(datos)) || {};
  const escuchas = new Set();
  const escuchasAuth = new Set();
  let actual = sesionInicial;

  const leer = ruta => {
    let nodo = raiz;
    for (const p of partes(ruta)) {
      if (nodo === null || typeof nodo !== 'object' || !(p in nodo)) return null;
      nodo = nodo[p];
    }
    return clonar(nodo);
  };

  const escribir = (ruta, valor) => {
    const ps = partes(ruta);
    if (!ps.length) {
      raiz = podar(clonar(valor)) || {};
      return;
    }
    let nodo = raiz;
    for (const p of ps.slice(0, -1)) {
      if (nodo[p] === null || typeof nodo[p] !== 'object') nodo[p] = {};
      nodo = nodo[p];
    }
    const limpio = podar(clonar(valor));
    if (limpio === null) delete nodo[ps.at(-1)];
    else nodo[ps.at(-1)] = limpio;
    raiz = podar(raiz) || {};
  };

  const relacionadas = (a, b) => {
    const pa = partes(a).join('/');
    const pb = partes(b).join('/');
    return pa === pb || pa.startsWith(pb + '/') || pb.startsWith(pa + '/') || !pa || !pb;
  };

  const avisar = ruta => {
    for (const e of [...escuchas]) if (relacionadas(e.ruta, ruta)) e.cb(leer(e.ruta));
  };

  const error = code => Object.assign(new Error(code), { code });

  return {
    auth: {
      onChange(cb) {
        escuchasAuth.add(cb);
        queueMicrotask(() => escuchasAuth.has(cb) && cb(actual));
        return () => escuchasAuth.delete(cb);
      },
      async signIn(email, clave) {
        const u = usuarios.find(x => x.email.toLowerCase() === String(email).toLowerCase() && x.clave === clave);
        if (!u) throw error('auth/invalid-credential');
        actual = { uid: u.uid, email: u.email };
        for (const cb of [...escuchasAuth]) cb(actual);
        return actual;
      },
      async signOut() {
        actual = null;
        for (const cb of [...escuchasAuth]) cb(null);
      },
      async resetPassword() {},
    },
    db: {
      get: async ruta => leer(ruta),
      async set(ruta, valor) {
        escribir(ruta, valor);
        avisar(ruta);
      },
      async update(ruta, valores) {
        for (const [k, v] of Object.entries(valores)) escribir(`${ruta}/${k}`, v);
        avisar(ruta);
      },
      async remove(ruta) {
        escribir(ruta, null);
        avisar(ruta);
      },
      subscribe(ruta, cb) {
        const e = { ruta, cb };
        escuchas.add(e);
        queueMicrotask(() => escuchas.has(e) && cb(leer(ruta)));
        return () => escuchas.delete(e);
      },
      now: reloj,
    },
    /** Solo para pruebas. */
    _dump: () => clonar(raiz),
  };
}
