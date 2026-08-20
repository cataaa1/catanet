const path = require('path');
const { Worker } = require('worker_threads');

const DIFICULTAD_DIARIA = 'experto';
const RUTA_WORKER = path.resolve(__dirname, 'workers', 'generarSudoku.mjs');

let motor = null;
let cache = null;
let generacionEnCurso = null;

// El motor vive en frontend/shared y es un modulo ES, igual que en buscaminasRooms
async function cargarMotorSudoku() {
  if (!motor) {
    motor = await import('../frontend/shared/sudoku.js');
  }

  return motor;
}

/**
 * Devuelve el Sudoku del dia. Es el mismo para todo el mundo porque se genera
 * a partir de una semilla derivada de la fecha, asi que aunque el servidor se
 * reinicie vuelve a salir identico.
 *
 * El primer pedido del dia espera a que el worker termine; los demas salen del
 * cache al instante.
 */
async function obtenerSudokuDiario(momento = new Date()) {
  const { obtenerFechaDiaria } = await cargarMotorSudoku();
  const fecha = obtenerFechaDiaria(momento);

  if (cache && cache.fecha === fecha) {
    return cache;
  }

  if (!generacionEnCurso || generacionEnCurso.fecha !== fecha) {
    generacionEnCurso = { fecha, promesa: generarTableroDelDia(fecha) };
  }

  return generacionEnCurso.promesa;
}

async function generarTableroDelDia(fecha) {
  const { semillaDeFecha } = await cargarMotorSudoku();

  try {
    const tablero = await generarEnWorker(DIFICULTAD_DIARIA, semillaDeFecha(fecha));

    cache = { fecha, ...tablero };

    return cache;
  } finally {
    generacionEnCurso = null;
  }
}

function generarEnWorker(dificultad, semilla) {
  return new Promise((resolver, rechazar) => {
    const worker = new Worker(RUTA_WORKER, { workerData: { dificultad, semilla } });

    worker.once('message', (mensaje) => {
      worker.terminate();

      if (mensaje && mensaje.ok) {
        resolver({
          dificultad: mensaje.dificultad,
          puzzle: mensaje.puzzle,
          solucion: mensaje.solucion
        });
        return;
      }

      rechazar(new Error(mensaje ? mensaje.mensaje : 'El worker no devolvio un tablero.'));
    });

    worker.once('error', rechazar);
    worker.once('exit', (codigo) => {
      if (codigo !== 0) {
        rechazar(new Error(`El worker del Sudoku termino con codigo ${codigo}.`));
      }
    });
  });
}

/**
 * Version que no espera: devuelve el tablero si ya esta, y si no arranca la
 * generacion y avisa que todavia no. Evita dejar una peticion HTTP colgada los
 * veinte y pico de segundos que puede tardar un tablero experto.
 */
async function pedirSudokuDiario(momento = new Date()) {
  const { obtenerFechaDiaria } = await cargarMotorSudoku();
  const fecha = obtenerFechaDiaria(momento);

  if (cache && cache.fecha === fecha) {
    return { listo: true, tablero: cache };
  }

  obtenerSudokuDiario(momento).catch((error) => {
    console.error('Fallo la generacion del Sudoku diario:', error.message);
  });

  return { listo: false, fecha };
}

/** Genera el tablero del dia apenas arranca el servidor, para que nadie espere. */
function precalentarSudokuDiario() {
  obtenerSudokuDiario().catch((error) => {
    console.error('No pude precalcular el Sudoku diario:', error.message);
  });
}

module.exports = {
  cargarMotorSudoku,
  obtenerSudokuDiario,
  pedirSudokuDiario,
  precalentarSudokuDiario,
  generarEnWorker,
  DIFICULTAD_DIARIA
};
