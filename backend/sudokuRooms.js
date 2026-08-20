const { randomBytes } = require('crypto');
const { cargarMotorSudoku, generarEnWorker } = require('./sudokuDiario');

const LONGITUD_SALA = 4;
const TIEMPO_RECONEXION_MS = 60 * 1000;
const TIEMPO_LIMPIEZA_MS = 30 * 60 * 1000;
const JUGADORES_PARA_ARRANCAR = 2;
const MAXIMO_JUGADORES = 6;

const COLORES = ['#7bd0ff', '#f0a6c0', '#8ff0c0', '#ffd76b', '#c9a7ff', '#ff8fb1'];

const salas = new Map();
const indiceSalaPorSocket = new Map();

let motor = null;

async function prepararMotorSalasSudoku() {
  motor = await cargarMotorSudoku();

  return motor;
}

function exigirMotor() {
  if (!motor) {
    throw new Error('El motor del Sudoku todavia no esta cargado.');
  }

  return motor;
}

function crearSalaSudoku(socketId, opciones = {}) {
  const dificultad = exigirMotor().obtenerDificultadSudoku(opciones.dificultad).id;
  const salaId = crearIdSala();

  const sala = {
    id: salaId,
    juegoId: 'sudoku',
    modo: 'carrera',
    modoId: 'sudoku-carrera',
    dificultad,
    jugadores: { [socketId]: crearJugador(1) },
    ordenJugadores: [socketId],
    fase: 'esperando',
    puzzle: '',
    solucion: '',
    tableroInicial: null,
    tablerosPorJugador: {},
    ganador: null,
    iniciadaEn: null,
    creadaEn: new Date(),
    temporizadorEliminacion: null
  };

  salas.set(salaId, sala);
  indiceSalaPorSocket.set(socketId, salaId);

  return sala;
}

function obtenerSalaSudoku(salaId) {
  const normalizada = normalizarSalaId(salaId);

  if (!normalizada || !salas.has(normalizada)) {
    throw new Error('La sala de Sudoku no existe o ya expiro.');
  }

  return salas.get(normalizada);
}

function obtenerSalaSudokuPorSocket(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  return salaId ? salas.get(salaId) || null : null;
}

function unirseASalaSudoku(salaId, socketId) {
  const sala = obtenerSalaSudoku(salaId);

  if (sala.jugadores[socketId]) {
    sala.jugadores[socketId].conectado = true;
    sala.jugadores[socketId].desconectadoEn = null;
    indiceSalaPorSocket.set(socketId, sala.id);
    cancelarEliminacionPendiente(sala);

    return { sala, debeArrancar: false };
  }

  // En la carrera se puede entrar tarde: se arranca desde el tablero original,
  // con la desventaja de lo que los demas ya llevan hecho.
  if (sala.ordenJugadores.length >= MAXIMO_JUGADORES) {
    throw new Error('La sala ya esta completa.');
  }

  sala.jugadores[socketId] = crearJugador(sala.ordenJugadores.length + 1);
  sala.ordenJugadores.push(socketId);
  indiceSalaPorSocket.set(socketId, sala.id);
  cancelarEliminacionPendiente(sala);

  if (sala.fase === 'jugando') {
    sala.tablerosPorJugador[socketId] = clonar(sala.tableroInicial);
  }

  const debeArrancar = sala.fase === 'esperando'
    && contarConectados(sala) >= JUGADORES_PARA_ARRANCAR;

  if (debeArrancar) {
    sala.fase = 'generando';
  }

  return { sala, debeArrancar };
}

/**
 * Genera el tablero de la carrera. Va por worker porque un tablero dificil
 * puede tardar segundos y el servidor tiene que seguir atendiendo las otras
 * partidas mientras tanto.
 */
async function arrancarCarrera(sala) {
  const { stringATablero } = exigirMotor();
  const tablero = await generarEnWorker(sala.dificultad, aleatorio());

  sala.puzzle = tablero.puzzle;
  sala.solucion = tablero.solucion;
  sala.tableroInicial = stringATablero(tablero.puzzle);
  sala.tablerosPorJugador = {};
  sala.ganador = null;
  sala.iniciadaEn = new Date();
  sala.fase = 'jugando';

  sala.ordenJugadores.forEach((jugadorId) => {
    sala.tablerosPorJugador[jugadorId] = clonar(sala.tableroInicial);
    sala.jugadores[jugadorId].correctas = contarCorrectasDe(sala, jugadorId);
    sala.jugadores[jugadorId].termino = false;
  });

  return sala;
}

/**
 * Anota una jugada. El servidor es el arbitro: mantiene el tablero de cada
 * persona, cuenta cuantas celdas coinciden con la solucion y decide quien
 * termino primero.
 */
function registrarJugadaSudoku(salaId, socketId, fila, columna, valor) {
  const sala = obtenerSalaSudoku(salaId);
  const { normalizarEntradaSudoku, esCeldaEditable, estaSudokuResuelto, stringATablero } = exigirMotor();

  if (!sala.jugadores[socketId]) {
    throw new Error('No estas en esa sala.');
  }

  if (sala.fase !== 'jugando') {
    throw new Error('La carrera no esta en curso.');
  }

  const tablero = sala.tablerosPorJugador[socketId];

  if (!tablero || !tablero[fila] || tablero[fila][columna] === undefined) {
    throw new Error('Esa celda no existe en el tablero.');
  }

  if (!esCeldaEditable(sala.tableroInicial, fila, columna)) {
    throw new Error('Esa celda venia fija en el tablero.');
  }

  tablero[fila][columna] = normalizarEntradaSudoku(valor);
  sala.jugadores[socketId].correctas = contarCorrectasDe(sala, socketId);

  const resolvio = estaSudokuResuelto(tablero, stringATablero(sala.solucion));
  let resultadoFinal = null;

  if (resolvio) {
    sala.jugadores[socketId].termino = true;
    sala.fase = 'terminada';
    sala.ganador = socketId;
    resultadoFinal = { ganador: socketId, solucion: sala.solucion };
  }

  return { sala, resolvio, resultadoFinal };
}

function reiniciarSalaSudoku(salaId, socketId) {
  const sala = obtenerSalaSudoku(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No estas en esa sala.');
  }

  if (contarConectados(sala) < JUGADORES_PARA_ARRANCAR) {
    throw new Error('Falta gente para correr otra.');
  }

  sala.fase = 'generando';

  return sala;
}

function contarCorrectasDe(sala, socketId) {
  const { contarCeldasCorrectas, stringATablero } = exigirMotor();

  return contarCeldasCorrectas(sala.tablerosPorJugador[socketId], stringATablero(sala.solucion));
}

/**
 * Estado para una persona. Incluye su propio tablero y el avance del resto,
 * pero nunca el tablero de los demas ni la solucion hasta que termina.
 */
function obtenerEstadoSudokuPublico(sala, socketId) {
  const propio = sala.tablerosPorJugador[socketId] || null;

  return {
    salaId: sala.id,
    modo: sala.modo,
    dificultad: sala.dificultad,
    fase: sala.fase,
    ganador: sala.ganador,
    puzzle: sala.fase === 'esperando' ? null : sala.puzzle,
    tablero: propio ? propio.map((fila) => fila.slice()) : null,
    solucion: sala.fase === 'terminada' ? sala.solucion : null,
    jugadores: sala.ordenJugadores.map((jugadorId) => ({
      id: jugadorId,
      numero: sala.jugadores[jugadorId].numero,
      color: sala.jugadores[jugadorId].color,
      conectado: sala.jugadores[jugadorId].conectado,
      correctas: sala.jugadores[jugadorId].correctas,
      termino: sala.jugadores[jugadorId].termino,
      soyYo: jugadorId === socketId
    }))
  };
}

function registrarDesconexionSudoku(socketId) {
  const sala = obtenerSalaSudokuPorSocket(socketId);

  indiceSalaPorSocket.delete(socketId);

  if (!sala || !sala.jugadores[socketId]) {
    return null;
  }

  sala.jugadores[socketId].conectado = false;
  sala.jugadores[socketId].desconectadoEn = new Date();

  const quedanConectados = contarConectados(sala) > 0;

  if (!quedanConectados) {
    programarEliminacion(sala);
  }

  return { salaId: sala.id, hayOtroJugadorConectado: quedanConectados };
}

function cerrarSalaSudoku(salaId) {
  const sala = salas.get(normalizarSalaId(salaId));

  if (!sala) {
    return;
  }

  cancelarEliminacionPendiente(sala);
  sala.ordenJugadores.forEach((jugadorId) => indiceSalaPorSocket.delete(jugadorId));
  salas.delete(sala.id);
}

function iniciarLimpiezaSudokuPeriodica() {
  const temporizador = setInterval(() => {
    const ahora = Date.now();

    salas.forEach((sala) => {
      if (ahora - sala.creadaEn.getTime() > TIEMPO_LIMPIEZA_MS && contarConectados(sala) === 0) {
        cerrarSalaSudoku(sala.id);
      }
    });
  }, TIEMPO_LIMPIEZA_MS);

  if (temporizador.unref) {
    temporizador.unref();
  }

  return temporizador;
}

function crearJugador(numero) {
  return {
    numero,
    color: COLORES[(numero - 1) % COLORES.length],
    conectado: true,
    desconectadoEn: null,
    correctas: 0,
    termino: false
  };
}

function contarConectados(sala) {
  return sala.ordenJugadores.filter((jugadorId) => sala.jugadores[jugadorId].conectado).length;
}

function clonar(tablero) {
  return tablero.map((fila) => fila.slice());
}

function aleatorio() {
  return randomBytes(4).readUInt32BE(0);
}

function programarEliminacion(sala) {
  cancelarEliminacionPendiente(sala);

  sala.temporizadorEliminacion = setTimeout(() => {
    if (contarConectados(sala) === 0) {
      cerrarSalaSudoku(sala.id);
    }
  }, TIEMPO_RECONEXION_MS);

  if (sala.temporizadorEliminacion.unref) {
    sala.temporizadorEliminacion.unref();
  }
}

function cancelarEliminacionPendiente(sala) {
  if (sala.temporizadorEliminacion) {
    clearTimeout(sala.temporizadorEliminacion);
    sala.temporizadorEliminacion = null;
  }
}

function crearIdSala() {
  let salaId = '';

  do {
    salaId = randomBytes(LONGITUD_SALA).toString('hex').slice(0, LONGITUD_SALA).toLowerCase();
  } while (salas.has(salaId));

  return salaId;
}

function normalizarSalaId(salaId) {
  return typeof salaId === 'string' ? salaId.trim().toLowerCase() : '';
}

module.exports = {
  prepararMotorSalasSudoku,
  crearSalaSudoku,
  obtenerSalaSudoku,
  obtenerSalaSudokuPorSocket,
  unirseASalaSudoku,
  arrancarCarrera,
  registrarJugadaSudoku,
  reiniciarSalaSudoku,
  obtenerEstadoSudokuPublico,
  registrarDesconexionSudoku,
  cerrarSalaSudoku,
  iniciarLimpiezaSudokuPeriodica
};
