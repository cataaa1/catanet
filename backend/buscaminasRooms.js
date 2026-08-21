const { randomBytes } = require('crypto');

const LONGITUD_SALA = 4;
const TIEMPO_RECONEXION_MS = 60 * 1000;
const TIEMPO_LIMPIEZA_MS = 30 * 60 * 1000;
const JUGADORES_PARA_ARRANCAR = 2;
// La apertura inicial no deberia pasar de esta parte del tablero sin minas
const PROPORCION_APERTURA = 0.12;
const INTENTOS_APERTURA = 40;
const MAXIMO_JUGADORES = { coop: 6, versus: 2 };

// Un color por jugador, para ver quien destapo cada celda en el cooperativo
const COLORES = ['#7bd0ff', '#f0a6c0', '#8ff0c0', '#ffd76b', '#c9a7ff', '#ff8fb1'];

// Cuantas salas puede tener abiertas un mismo socket. Sin esto, un cliente que
// crea salas en bucle las acumula en memoria: la limpieza periodica solo borra
// las que quedaron sin nadie conectado, y quien las creo figura conectado.
const MAXIMO_SALAS_POR_SOCKET = 5;

const salas = new Map();
const indiceSalaPorSocket = new Map();

// El motor vive en frontend/shared y es un modulo ES, asi que hay que cargarlo
// con import() dinamico. server.js lo espera antes de escuchar conexiones.
let motor = null;

async function cargarMotorBuscaminas() {
  if (!motor) {
    motor = await import('../frontend/shared/buscaminas.js');
  }

  return motor;
}

function exigirMotor() {
  if (!motor) {
    throw new Error('El motor del Buscaminas todavia no esta cargado.');
  }

  return motor;
}

function crearSalaBuscaminas(socketId, opciones = {}) {
  exigirCupoDeSalas(socketId);

  const modo = opciones.modo === 'versus' ? 'versus' : 'coop';
  const dificultad = exigirMotor().obtenerDificultadBuscaminas(opciones.dificultad).id;
  const salaId = crearIdSala();

  const sala = {
    id: salaId,
    juegoId: 'buscaminas',
    modo,
    modoId: modo === 'versus' ? 'buscaminas-versus' : 'buscaminas-cooperativo',
    dificultad,
    jugadores: { [socketId]: crearJugador(1) },
    ordenJugadores: [socketId],
    fase: 'esperando',
    partidaCompartida: null,
    partidasPorJugador: {},
    minas: [],
    aperturaInicial: null,
    ganador: null,
    resultado: null,
    creadaEn: new Date(),
    temporizadorEliminacion: null
  };

  salas.set(salaId, sala);
  indiceSalaPorSocket.set(socketId, salaId);

  return sala;
}

function obtenerSalaBuscaminas(salaId) {
  const normalizada = normalizarSalaId(salaId);

  if (!normalizada || !salas.has(normalizada)) {
    throw new Error('La sala de Buscaminas no existe o ya expiro.');
  }

  return salas.get(normalizada);
}

function obtenerSalaBuscaminasPorSocket(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  return salaId ? salas.get(salaId) || null : null;
}

function unirseASalaBuscaminas(salaId, socketId) {
  const sala = obtenerSalaBuscaminas(salaId);

  // Reingreso de alguien que ya estaba en la sala
  if (sala.jugadores[socketId]) {
    sala.jugadores[socketId].conectado = true;
    sala.jugadores[socketId].desconectadoEn = null;
    indiceSalaPorSocket.set(socketId, sala.id);
    cancelarEliminacionPendiente(sala);

    return { sala, partidaIniciada: false, tipoUnion: 'reingreso' };
  }

  // En cooperativo se puede entrar con la partida ya empezada: la gente llega
  // cuando puede y se suma al tablero en curso. En versus no, porque son dos y
  // los dos tienen que arrancar juntos.
  if (sala.fase !== 'esperando' && sala.modo === 'versus') {
    throw new Error('Esa partida ya empezo.');
  }

  if (sala.ordenJugadores.length >= MAXIMO_JUGADORES[sala.modo]) {
    throw new Error('La sala ya esta completa.');
  }

  sala.jugadores[socketId] = crearJugador(sala.ordenJugadores.length + 1);
  sala.ordenJugadores.push(socketId);
  indiceSalaPorSocket.set(socketId, sala.id);
  cancelarEliminacionPendiente(sala);

  // Solo arrancamos si la partida todavia no empezo
  const partidaIniciada = sala.fase === 'esperando'
    && contarConectados(sala) >= JUGADORES_PARA_ARRANCAR;

  if (partidaIniciada) {
    arrancarPartida(sala);
  }

  return { sala, partidaIniciada, tipoUnion: 'nuevo' };
}

/**
 * Genera el tablero y abre un area inicial.
 *
 * El area se abre a proposito antes de la primera jugada: si las minas se
 * colocaran en el primer click de cada persona, en versus los dos tableros
 * saldrian distintos, y si se colocaran de entrada, el primer click podria ser
 * una mina. Abriendo la misma area para todos, el tablero es identico y nadie
 * puede morir en la primera jugada.
 */
function arrancarPartida(sala) {
  const {
    crearPartidaBuscaminas, revelarCelda, obtenerMinas, sembrarMinas, elegirAperturaMinima
  } = exigirMotor();

  const { minas, apertura } = buscarTableroConAperturaChica(sala.dificultad);
  const partida = crearPartidaBuscaminas(sala.dificultad);

  sala.minas = minas;
  sembrarMinas(partida, minas);
  revelarCelda(partida, apertura.fila, apertura.columna);
  sala.aperturaInicial = apertura;
  sala.fase = 'jugando';
  sala.ganador = null;
  sala.resultado = null;

  if (sala.modo === 'coop') {
    sala.partidaCompartida = partida;
    sala.partidasPorJugador = {};
  } else {
    // En versus cada quien juega su copia del mismo tablero
    sala.partidaCompartida = null;
    sala.partidasPorJugador = {};

    sala.ordenJugadores.forEach((jugadorId) => {
      const propia = crearPartidaBuscaminas(sala.dificultad);

      sembrarMinas(propia, sala.minas);
      revelarCelda(propia, apertura.fila, apertura.columna);
      sala.partidasPorJugador[jugadorId] = propia;
    });
  }

  sala.ordenJugadores.forEach((jugadorId) => {
    sala.jugadores[jugadorId].celdasReveladas = obtenerPartida(sala, jugadorId).celdasReveladas;
    sala.jugadores[jugadorId].perdio = false;
  });
}

/**
 * Sortea tableros hasta encontrar uno cuya apertura inicial sea chica.
 *
 * A veces todo el tablero es una sola region vacia, y entonces abrir por
 * cualquier lado destapa casi todo. Como generar un tablero es barato, se
 * prueban varios y se elige el de la apertura mas discreta.
 */
function buscarTableroConAperturaChica(dificultadId) {
  const {
    crearPartidaBuscaminas, revelarCelda, obtenerMinas, sembrarMinas,
    elegirAperturaMinima, obtenerDificultadBuscaminas
  } = exigirMotor();

  const dificultad = obtenerDificultadBuscaminas(dificultadId);
  const sinMina = (dificultad.filas * dificultad.columnas) - dificultad.minas;
  const objetivo = Math.max(6, Math.round(sinMina * PROPORCION_APERTURA));

  let mejor = null;

  for (let intento = 0; intento < INTENTOS_APERTURA; intento += 1) {
    const sorteo = crearPartidaBuscaminas(dificultadId);

    revelarCelda(
      sorteo,
      Math.floor(Math.random() * sorteo.filas),
      Math.floor(Math.random() * sorteo.columnas)
    );

    const minas = obtenerMinas(sorteo);
    const limpio = crearPartidaBuscaminas(dificultadId);

    sembrarMinas(limpio, minas);

    const apertura = elegirAperturaMinima(limpio);

    if (!apertura) {
      continue;
    }

    if (!mejor || apertura.destapadas < mejor.apertura.destapadas) {
      mejor = { minas, apertura };
    }

    if (apertura.destapadas <= objetivo) {
      break;
    }
  }

  return mejor;
}

function obtenerPartida(sala, socketId) {
  return sala.modo === 'coop' ? sala.partidaCompartida : sala.partidasPorJugador[socketId];
}

function revelarEnSala(salaId, socketId, fila, columna) {
  const sala = exigirSalaJugable(salaId, socketId);
  const { revelarCelda, revelarVecinos } = exigirMotor();
  const partida = obtenerPartida(sala, socketId);
  const celda = partida.tablero[fila] && partida.tablero[fila][columna];

  if (!celda) {
    throw new Error('Esa celda no existe en el tablero.');
  }

  // Sobre una celda ya destapada, el click intenta el chording
  const resultado = celda.revelada
    ? revelarVecinos(partida, fila, columna)
    : revelarCelda(partida, fila, columna);

  sala.jugadores[socketId].celdasReveladas = partida.celdasReveladas;

  // Marcamos quien destapo cada celda, para pintarlas de su color en coop
  if (sala.modo === 'coop') {
    resultado.celdas.forEach((c) => {
      partida.tablero[c.fila][c.columna].jugadorId = socketId;
    });
  }

  const resultadoFinal = resolverFinal(sala, socketId, resultado);

  return {
    sala,
    celdas: resultado.celdas.map((c) => ({ ...c, jugadorId: socketId })),
    exploto: resultado.exploto,
    gano: resultado.gano,
    resultadoFinal
  };
}

function marcarEnSala(salaId, socketId, fila, columna) {
  const sala = exigirSalaJugable(salaId, socketId);
  const partida = obtenerPartida(sala, socketId);
  const { cambio, puesta } = exigirMotor().alternarBandera(partida, fila, columna);

  if (cambio && sala.modo === 'coop') {
    partida.tablero[fila][columna].jugadorId = puesta ? socketId : null;
  }

  return { sala, cambio, puesta };
}

// Traduce el resultado de una jugada al final de la partida, segun el modo
function resolverFinal(sala, socketId, resultado) {
  if (!resultado.exploto && !resultado.gano) {
    return null;
  }

  sala.fase = 'terminada';

  if (sala.modo === 'coop') {
    sala.resultado = resultado.gano ? 'victoria' : 'derrota';
    sala.ganador = null;
  } else if (resultado.exploto) {
    sala.jugadores[socketId].perdio = true;
    sala.resultado = 'derrota';
    sala.ganador = obtenerRival(sala, socketId);
  } else {
    sala.resultado = 'victoria';
    sala.ganador = socketId;
  }

  return {
    resultado: sala.resultado,
    ganador: sala.ganador,
    perdedor: sala.modo === 'versus' && resultado.exploto ? socketId : null,
    minas: sala.minas
  };
}

function obtenerRival(sala, socketId) {
  return sala.ordenJugadores.find((jugadorId) => jugadorId !== socketId) || null;
}

function reiniciarSalaBuscaminas(salaId, socketId) {
  const sala = obtenerSalaBuscaminas(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No estas en esa sala.');
  }

  if (contarConectados(sala) < JUGADORES_PARA_ARRANCAR) {
    throw new Error('Falta gente para empezar otra partida.');
  }

  // Solo se reinicia una partida terminada: si no, cualquiera puede cambiarle
  // el tablero al resto en el medio de la partida.
  if (sala.fase !== 'terminada') {
    throw new Error('La partida sigue en curso.');
  }


  arrancarPartida(sala);

  return sala;
}

/**
 * Estado para mandarle a una persona. Nunca incluye donde estan las minas, salvo
 * que la partida haya terminado: hasta entonces, el tablero es secreto.
 */
function obtenerEstadoBuscaminasPublico(sala, socketId) {
  const { obtenerVistaPublica } = exigirMotor();
  const partida = obtenerPartida(sala, socketId);
  const terminada = sala.fase === 'terminada';

  return {
    salaId: sala.id,
    modo: sala.modo,
    dificultad: sala.dificultad,
    fase: sala.fase,
    resultado: sala.resultado,
    ganador: sala.ganador,
    jugadores: sala.ordenJugadores.map((jugadorId) => ({
      id: jugadorId,
      numero: sala.jugadores[jugadorId].numero,
      color: sala.jugadores[jugadorId].color,
      conectado: sala.jugadores[jugadorId].conectado,
      celdasReveladas: sala.jugadores[jugadorId].celdasReveladas,
      perdio: sala.jugadores[jugadorId].perdio,
      soyYo: jugadorId === socketId
    })),
    tablero: partida ? construirVista(obtenerVistaPublica(partida), partida, sala.modo) : null,
    minas: terminada ? sala.minas : null
  };
}

// La vista del motor no trae de quien es cada celda, que solo importa en coop
function construirVista(vista, partida, modo) {
  if (modo !== 'coop') {
    return vista;
  }

  return {
    ...vista,
    celdas: vista.celdas.map((celda) => ({
      ...celda,
      jugadorId: partida.tablero[celda.fila][celda.columna].jugadorId || null
    }))
  };
}

function registrarDesconexionBuscaminas(socketId) {
  const sala = obtenerSalaBuscaminasPorSocket(socketId);

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

function cerrarSalaBuscaminas(salaId) {
  const sala = salas.get(normalizarSalaId(salaId));

  if (!sala) {
    return;
  }

  cancelarEliminacionPendiente(sala);
  sala.ordenJugadores.forEach((jugadorId) => indiceSalaPorSocket.delete(jugadorId));
  salas.delete(sala.id);
}

function iniciarLimpiezaBuscaminasPeriodica() {
  const temporizador = setInterval(() => {
    const ahora = Date.now();

    salas.forEach((sala) => {
      if (ahora - sala.creadaEn.getTime() > TIEMPO_LIMPIEZA_MS && contarConectados(sala) === 0) {
        cerrarSalaBuscaminas(sala.id);
      }
    });
  }, TIEMPO_LIMPIEZA_MS);

  if (temporizador.unref) {
    temporizador.unref();
  }

  return temporizador;
}

function exigirSalaJugable(salaId, socketId) {
  const sala = obtenerSalaBuscaminas(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No estas en esa sala.');
  }

  if (sala.fase !== 'jugando') {
    throw new Error('La partida no esta en juego.');
  }

  return sala;
}

function crearJugador(numero) {
  return {
    numero,
    color: COLORES[(numero - 1) % COLORES.length],
    conectado: true,
    desconectadoEn: null,
    celdasReveladas: 0,
    perdio: false
  };
}

function contarConectados(sala) {
  return sala.ordenJugadores.filter((jugadorId) => sala.jugadores[jugadorId].conectado).length;
}

function programarEliminacion(sala) {
  cancelarEliminacionPendiente(sala);

  sala.temporizadorEliminacion = setTimeout(() => {
    if (contarConectados(sala) === 0) {
      cerrarSalaBuscaminas(sala.id);
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

// Cuenta las salas que este socket dejo abiertas y frena si se pasa del cupo
function exigirCupoDeSalas(socketId) {
  let abiertas = 0;

  salas.forEach((sala) => {
    if (sala.jugadores[socketId]) {
      abiertas += 1;
    }
  });

  if (abiertas >= MAXIMO_SALAS_POR_SOCKET) {
    throw new Error('Tenes demasiadas salas abiertas. Cerra alguna antes de crear otra.');
  }
}

function normalizarSalaId(salaId) {
  return typeof salaId === 'string' ? salaId.trim().toLowerCase() : '';
}

module.exports = {
  cargarMotorBuscaminas,
  crearSalaBuscaminas,
  obtenerSalaBuscaminas,
  obtenerSalaBuscaminasPorSocket,
  unirseASalaBuscaminas,
  revelarEnSala,
  marcarEnSala,
  reiniciarSalaBuscaminas,
  obtenerEstadoBuscaminasPublico,
  registrarDesconexionBuscaminas,
  cerrarSalaBuscaminas,
  iniciarLimpiezaBuscaminasPeriodica
};
