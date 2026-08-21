// Rutas del proyecto, resueltas desde este archivo para que las pruebas
// funcionen sin importar desde donde se las ejecute.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export const RAIZ = path.resolve(AQUI, '..', '..');
export const FRONTEND = path.join(RAIZ, 'frontend');
export const BACKEND = path.join(RAIZ, 'backend');

/** Ruta absoluta a partir de una relativa al repo: ruta('frontend/shared/x.js') */
export function ruta(...partes) {
  return path.join(RAIZ, ...partes);
}

/** La misma ruta pero como URL, que es lo que necesita un import() dinamico. */
export function urlDe(...partes) {
  return pathToFileURL(ruta(...partes)).href;
}
