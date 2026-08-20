// Worker que genera un tablero de Sudoku sin bloquear al servidor.
//
// Generar un tablero dificil cuesta caro: con 30 pistas la mediana es de un
// segundo y el peor caso pasa los cinco, y con 28 se va a seis. Como Node es de
// un solo hilo, hacerlo en el proceso principal dejaria al servidor sin
// responder, cortando las partidas online que esten en curso.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const rutaVendor = path.resolve(aqui, '../../frontend/shared/vendor/sudoku-lib.js');

// La libreria externa se cuelga del objeto global, igual que en el navegador
new Function(fs.readFileSync(rutaVendor, 'utf8')).call(globalThis);

const { crearPartidaSudoku } = await import('../../frontend/shared/sudoku.js');

try {
  const partida = crearPartidaSudoku(workerData.dificultad, { semilla: workerData.semilla });

  parentPort.postMessage({
    ok: true,
    dificultad: partida.dificultad,
    puzzle: partida.puzzle,
    solucion: partida.solucion
  });
} catch (error) {
  parentPort.postMessage({ ok: false, mensaje: error.message });
}
