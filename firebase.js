/**
 * Adaptador de Firebase (Auth + Realtime Database) con el SDK modular.
 * Es el único archivo que conoce Firebase; el resto de la app usa esta interfaz:
 *
 *   auth: onChange(cb) · signIn(email, clave) · signOut() · resetPassword(email)
 *   db:   get(ruta) · set(ruta, v) · update(ruta, v) · remove(ruta) · subscribe(ruta, cb, onError) · now()
 */
import { FIREBASE_CONFIG, FIREBASE_SDK } from '../../config.js';

export async function createFirebaseBackend() {
  const [appMod, authMod, dbMod] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-auth.js`),
    import(`${FIREBASE_SDK}/firebase-database.js`),
  ]);

  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  const db = dbMod.getDatabase(app);
  // Persistencia local (la predeterminada): las listas de verificación se abren en otra
  // pestaña del mismo origen y necesitan compartir la sesión. El cierre por inactividad
  // lo aplica core/session.js.

  const ref = ruta => dbMod.ref(db, ruta);
  const usuario = u => (u ? { uid: u.uid, email: u.email || '' } : null);

  return {
    auth: {
      onChange: cb => authMod.onAuthStateChanged(auth, u => cb(usuario(u))),
      signIn: async (email, clave) => usuario((await authMod.signInWithEmailAndPassword(auth, email, clave)).user),
      signOut: () => authMod.signOut(auth),
      resetPassword: email => authMod.sendPasswordResetEmail(auth, email),
    },
    db: {
      get: async ruta => (await dbMod.get(ref(ruta))).val(),
      set: (ruta, valor) => dbMod.set(ref(ruta), valor),
      update: (ruta, valores) => dbMod.update(ref(ruta), valores),
      remove: ruta => dbMod.remove(ref(ruta)),
      subscribe: (ruta, cb, onError) => dbMod.onValue(ref(ruta), snap => cb(snap.val()), err => onError?.(err)),
      now: () => Date.now(),
    },
  };
}
