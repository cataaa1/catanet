// Carga el game.js de un juego reescribiendo sus imports.
//
// Los juegos importan con rutas absolutas del sitio (`/shared/sudoku.js`), que
// el navegador resuelve contra el servidor pero Node no. Ademas conviene
// cambiar celebracion.js y resultado.js por stubs. Como no se puede interceptar
// un import de otra forma, se escribe una copia con los imports ya resueltos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ruta, urlDe } from './rutas.mjs';

let contador = 0;

/**
 * @param {string} rutaJuego relativa al repo, ej 'frontend/sudoku/diario/game.js'
 * @param {Object} [opciones]
 * @param {Object} [opciones.reemplazos] mapa de import original -> URL nueva
 * @returns {Promise<*>} el modulo ya importado
 */
export async function cargarJuego(rutaJuego, opciones = {}) {
  const stubs = urlDe('tests', 'ayudas', 'stubs.mjs');
  const reemplazos = {
    "'/shared/sudoku.js'": `'${urlDe('frontend', 'shared', 'sudoku.js')}'`,
    "'/shared/buscaminas.js'": `'${urlDe('frontend', 'shared', 'buscaminas.js')}'`,
    "'/shared/words.js'": `'${urlDe('frontend', 'shared', 'words.js')}'`,
    "'/shared/wordle.js'": `'${urlDe('frontend', 'shared', 'wordle.js')}'`,
    "'/shared/catalog.js'": `'${urlDe('frontend', 'shared', 'catalog.js')}'`,
    "'/shared/celebracion.js'": `'${stubs}'`,
    "'/shared/resultado.js'": `'${stubs}'`,
    ...(opciones.reemplazos || {})
  };

  let fuente = fs.readFileSync(ruta(rutaJuego), 'utf8');

  for (const [original, nuevo] of Object.entries(reemplazos)) {
    fuente = fuente.split(original).join(nuevo);
  }

  contador += 1;

  const destino = path.join(os.tmpdir(), `catanet-prueba-${process.pid}-${contador}.mjs`);

  fs.writeFileSync(destino, fuente);

  try {
    // El sufijo obliga a Node a reimportar: hace falta para simular recargas
    return await import(`${pathToFileURL(destino).href}?n=${contador}`);
  } finally {
    fs.rmSync(destino, { force: true });
  }
}

/** Carga la libreria externa del Sudoku en el global, como hace el navegador. */
export function cargarLibreriaSudoku() {
  const fuente = fs.readFileSync(ruta('frontend', 'shared', 'vendor', 'sudoku-lib.js'), 'utf8');

  new Function(fuente).call(globalThis);

  return globalThis.sudoku;
}
