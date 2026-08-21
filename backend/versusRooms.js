const { randomBytes } = require('crypto');
const { calcularColores } = require('./motorWordle');
const {
  obtenerPalabraAleatoria,
  esPalabraAceptada,
  normalizarPalabra
} = require('./words');

const LONGITUD_SALA = 4;
const LONGITUD_PALABRA = 5;
const MAXIMO_INTENTOS = 6;
const DURACION_PARTIDA_MS = 90 * 1000;
const TIEMPO_RECONEXION_MS = 60 * 1000;
const TIEMPO_LIMPIEZA_MS = 30 * 60 * 1000;

const salasVersus = new Map();
const indiceSalaPorSocket = new Map();

function crearSalaVersus(socketId, opciones = {}) {
  const salaId = crearIdSala();
  const sala = {
    id: salaId,
    juegoId: normalizarIdentificador(opciones.juegoId) || 'wordle',
    modoId: normalizarIdentificador(opciones.modoId) || 'wordle-versus-tiempo',
    jugadores: {
      [socketId]: crearJugador(1)
    },
    ordenJugadores: [socketId],
    fase: 'esperando',
    duracionMs: DURACION_PARTIDA_MS,
    iniciadaEn: null,
    terminaEn: null,
    ganador: null,
    resultado: null,
    creadaEn: new Date(),
    temporizadorFinal: null,
    temporizadorEliminacion: null
  };

  salasVersus.set(salaId, sala);
  indiceSalaPorSocket.set(socketId, salaId);

  return sala;
}

function obtenerSalaVersus(salaId) {
  const salaNormalizada = normalizarSalaId(salaId);

  if (!salaNormalizada || !salasVersus.has(salaNormalizada)) {
    throw new Error('La sala versus no existe o ya expiro.');
  }

  return salasVersus.get(salaNormalizada);
}

function obtenerSalaVersusPorSocket(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  if (!salaId) {
    return null;
  }

  return salasVersus.get(salaId) || null;
}

function unirseASalaVersus(salaId, socketId, onFinalizar) {
  const sala = obtenerSalaVersus(salaId);

  if (sala.jugadores[socketId]) {
    sala.jugadores[socketId].conectado = true;
    sala.jugadores[socketId].desconectadoEn = null;
    indiceSalaPorSocket.set(socketId, sala.id);
    limpiarEliminacionPendiente(sala);

    return {
      sala,
      tipoUnion: 'reingreso',
      partidaIniciada: false
    };
  }

  const jugadorDesconectado = Object.entries(sala.jugadores)
    .find(([, jugador]) => !jugador.conectado);

  if (jugadorDesconectado) {
    const [socketAnterior, jugador] = jugadorDesconectado;

    delete sala.jugadores[socketAnterior];
    indiceSalaPorSocket.delete(socketAnterior);

    jugador.conectado = true;
    jugador.desconectadoEn = null;
    sala.jugadores[socketId] = jugador;
    sala.ordenJugadores = sala.ordenJugadores.map((jugadorId) => (
      jugadorId === socketAnterior ? socketId : jugadorId
    ));
    indiceSalaPorSocket.set(socketId, sala.id);
    limpiarEliminacionPendiente(sala);

    return {
      sala,
      tipoUnion: 'reconexion',
      partidaIniciada: false
    };
  }

  if (Object.keys(sala.jugadores).length >= 2) {
    throw new Error('La sala ya esta llena.');
  }

  if (sala.fase !== 'esperando') {
    throw new Error('La partida ya empezo.');
  }

  sala.jugadores[socketId] = crearJugador(2);
  sala.ordenJugadores.push(socketId);
  indiceSalaPorSocket.set(socketId, sala.id);
  limpiarEliminacionPendiente(sala);

  iniciarPartidaVersus(sala, onFinalizar);

  return {
    sala,
    tipoUnion: 'nuevo',
    partidaIniciada: true
  };
}

function registrarIntentoVersus(salaId, socketId, intentoCrudo) {
  const sala = obtenerSalaVersus(salaId);
  const jugador = sala.jugadores[socketId];

  if (!jugador) {
    throw new Error('No perteneces a esta sala versus.');
  }

  finalizarSiExpiro(sala);

  if (sala.fase === 'terminada') {
    throw new Error('La partida ya termino.');
  }

  if (sala.fase !== 'jugando') {
    throw new Error('La partida todavia no esta lista para jugar.');
  }

  if (!jugador.conectado) {
    throw new Error('Tu conexion no esta activa en esta sala.');
  }

  const intento = normalizarIntento(intentoCrudo);

  if (!/^[A-Z\u00D1]{5}$/.test(intento)) {
    throw new Error('El intento debe tener 5 letras y usar solo A-Z o Ñ, sin tildes.');
  }

  if (!esPalabraAceptada(intento)) {
    throw new Error('Esa palabra no esta en la lista del juego.');
  }

  const tablero = jugador.tableroActual;

  if (tablero.historialIntentos.length >= MAXIMO_INTENTOS) {
    throw new Error('Ese tablero ya no acepta mas intentos.');
  }

  const colores = calcularColores(tablero.palabraSecreta, intento);
  const acertado = intento === tablero.palabraSecreta;

  tablero.historialIntentos.push({
    palabra: intento,
    colores,
    acertado
  });

  jugador.intentosRealizados += 1;

  const tableroCompletado = acertado || tablero.historialIntentos.length >= MAXIMO_INTENTOS;
  const palabraAnterior = tablero.palabraSecreta;
  let sumoPunto = false;

  if (tableroCompletado) {
    if (acertado) {
      jugador.puntaje += 1;
      sumoPunto = true;
    }

    jugador.tablerosJugados += 1;
    jugador.ultimoResultado = {
      acertado,
      palabra: palabraAnterior,
      puntos: jugador.puntaje
    };
    jugador.tableroActual = crearTablero();
  }

  return {
    sala,
    jugadorId: socketId,
    intento,
    colores,
    tableroCompletado,
    acertado,
    sumoPunto,
    palabraAnterior,
    estado: obtenerEstadoVersusPublico(sala)
  };
}

function reiniciarSalaVersus(salaId, socketId, onFinalizar) {
  const sala = obtenerSalaVersus(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No perteneces a esta sala versus.');
  }

  if (Object.keys(sala.jugadores).length < 2) {
    throw new Error('Todavia falta el segundo jugador.');
  }

  // Solo se reinicia una partida terminada: si no, cualquiera puede cambiarle
  // el tablero al resto en el medio de la partida.
  if (sala.fase !== 'terminada') {
    throw new Error('La partida sigue en curso.');
  }


  limpiarTemporizadorFinal(sala);
  sala.fase = 'jugando';
  sala.iniciadaEn = Date.now();
  sala.terminaEn = sala.iniciadaEn + sala.duracionMs;
  sala.ganador = null;
  sala.resultado = null;

  for (const [jugadorId, jugador] of Object.entries(sala.jugadores)) {
    Object.assign(jugador, crearJugador(jugador.asiento));
    sala.jugadores[jugadorId].conectado = true;
  }

  programarFinal(sala, onFinalizar);
  return sala;
}

function cerrarSalaVersus(salaId) {
  const sala = obtenerSalaVersus(salaId);
  eliminarSalaVersus(sala.id);
  return sala;
}

function registrarDesconexionVersus(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  if (!salaId) {
    return null;
  }

  const sala = salasVersus.get(salaId);

  if (!sala || !sala.jugadores[socketId]) {
    indiceSalaPorSocket.delete(socketId);
    return null;
  }

  sala.jugadores[socketId].conectado = false;
  sala.jugadores[socketId].desconectadoEn = new Date();
  indiceSalaPorSocket.delete(socketId);

  const hayOtroJugadorConectado = Object.entries(sala.jugadores)
    .some(([jugadorId, jugador]) => jugadorId !== socketId && jugador.conectado);

  if (!hayOtroJugadorConectado) {
    programarEliminacionSiHaceFalta(sala);
  }

  return {
    salaId: sala.id,
    sala,
    hayOtroJugadorConectado
  };
}

function obtenerEstadoVersusPublico(sala) {
  finalizarSiExpiro(sala);

  return {
    id: sala.id,
    juegoId: sala.juegoId,
    modoId: sala.modoId,
    fase: sala.fase,
    duracionMs: sala.duracionMs,
    iniciadaEn: sala.iniciadaEn,
    terminaEn: sala.terminaEn,
    tiempoRestanteMs: calcularTiempoRestante(sala),
    ganador: sala.ganador,
    resultado: sala.resultado,
    cantidadJugadores: Object.keys(sala.jugadores).length,
    ordenJugadores: [...sala.ordenJugadores],
    maximoIntentos: MAXIMO_INTENTOS,
    longitudPalabra: LONGITUD_PALABRA,
    jugadores: Object.fromEntries(
      Object.entries(sala.jugadores)
        .sort(([, jugadorA], [, jugadorB]) => jugadorA.asiento - jugadorB.asiento)
        .map(([socketId, jugador]) => [
          socketId,
          {
            nombre: jugador.nombre,
            color: jugador.color,
            asiento: jugador.asiento,
            conectado: jugador.conectado,
            puntaje: jugador.puntaje,
            intentosRealizados: jugador.intentosRealizados,
            tablerosJugados: jugador.tablerosJugados,
            ultimoResultado: jugador.ultimoResultado,
            tableroActual: {
              historialIntentos: [...jugador.tableroActual.historialIntentos]
            }
          }
        ])
    )
  };
}

function iniciarLimpiezaVersusPeriodica() {
  const temporizador = setInterval(() => {
    const haceTreintaMinutos = Date.now() - TIEMPO_LIMPIEZA_MS;

    for (const [salaId, sala] of salasVersus.entries()) {
      if (sala.creadaEn.getTime() < haceTreintaMinutos) {
        eliminarSalaVersus(salaId);
      }
    }
  }, TIEMPO_LIMPIEZA_MS);

  if (typeof temporizador.unref === 'function') {
    temporizador.unref();
  }

  return temporizador;
}

function iniciarPartidaVersus(sala, onFinalizar) {
  sala.fase = 'jugando';
  sala.iniciadaEn = Date.now();
  sala.terminaEn = sala.iniciadaEn + sala.duracionMs;
  sala.ganador = null;
  sala.resultado = null;
  programarFinal(sala, onFinalizar);
}

function programarFinal(sala, onFinalizar) {
  limpiarTemporizadorFinal(sala);

  sala.temporizadorFinal = setTimeout(() => {
    finalizarSalaVersus(sala);

    if (typeof onFinalizar === 'function') {
      onFinalizar(sala);
    }
  }, sala.duracionMs);

  if (typeof sala.temporizadorFinal.unref === 'function') {
    sala.temporizadorFinal.unref();
  }
}

function finalizarSiExpiro(sala) {
  if (sala.fase === 'jugando' && calcularTiempoRestante(sala) <= 0) {
    finalizarSalaVersus(sala);
  }
}

function finalizarSalaVersus(sala) {
  if (sala.fase === 'terminada') {
    return sala;
  }

  limpiarTemporizadorFinal(sala);

  const jugadoresOrdenados = sala.ordenJugadores
    .map((jugadorId) => [jugadorId, sala.jugadores[jugadorId]])
    .filter(([, jugador]) => jugador);
  const [primerJugador, segundoJugador] = jugadoresOrdenados;

  sala.fase = 'terminada';
  sala.terminaEn = sala.terminaEn || Date.now();

  if (!primerJugador || !segundoJugador) {
    sala.ganador = primerJugador ? primerJugador[0] : null;
    sala.resultado = 'abandono';
    return sala;
  }

  if (primerJugador[1].puntaje === segundoJugador[1].puntaje) {
    sala.ganador = 'empate';
    sala.resultado = 'empate';
    return sala;
  }

  sala.ganador = primerJugador[1].puntaje > segundoJugador[1].puntaje
    ? primerJugador[0]
    : segundoJugador[0];
  sala.resultado = 'victoria';

  return sala;
}

function crearJugador(numeroJugador) {
  return {
    nombre: `Jugador ${numeroJugador}`,
    color: numeroJugador === 1 ? 'plum' : 'mint',
    asiento: numeroJugador,
    conectado: true,
    desconectadoEn: null,
    puntaje: 0,
    intentosRealizados: 0,
    tablerosJugados: 0,
    ultimoResultado: null,
    tableroActual: crearTablero()
  };
}

function crearTablero() {
  return {
    palabraSecreta: obtenerPalabraAleatoria(),
    historialIntentos: []
  };
}

function crearIdSala() {
  const caracteres = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let salaId = '';

  while (salaId.length < LONGITUD_SALA) {
    const bloqueAleatorio = randomBytes(LONGITUD_SALA);

    for (const byte of bloqueAleatorio) {
      salaId += caracteres[byte % caracteres.length];

      if (salaId.length === LONGITUD_SALA) {
        break;
      }
    }
  }

  if (salasVersus.has(salaId)) {
    return crearIdSala();
  }

  return salaId;
}

function normalizarIntento(intentoCrudo) {
  return normalizarPalabra(intentoCrudo);
}

function calcularTiempoRestante(sala) {
  if (!sala.terminaEn || sala.fase === 'esperando') {
    return sala.duracionMs;
  }

  return Math.max(0, sala.terminaEn - Date.now());
}

function limpiarTemporizadorFinal(sala) {
  if (!sala.temporizadorFinal) {
    return;
  }

  clearTimeout(sala.temporizadorFinal);
  sala.temporizadorFinal = null;
}

function limpiarEliminacionPendiente(sala) {
  if (!sala.temporizadorEliminacion) {
    return;
  }

  clearTimeout(sala.temporizadorEliminacion);
  sala.temporizadorEliminacion = null;
}

function programarEliminacionSiHaceFalta(sala) {
  limpiarEliminacionPendiente(sala);

  sala.temporizadorEliminacion = setTimeout(() => {
    eliminarSalaVersus(sala.id);
  }, TIEMPO_RECONEXION_MS);

  if (typeof sala.temporizadorEliminacion.unref === 'function') {
    sala.temporizadorEliminacion.unref();
  }
}

function eliminarSalaVersus(salaId) {
  const sala = salasVersus.get(salaId);

  if (!sala) {
    return;
  }

  limpiarTemporizadorFinal(sala);
  limpiarEliminacionPendiente(sala);

  for (const socketId of Object.keys(sala.jugadores)) {
    indiceSalaPorSocket.delete(socketId);
  }

  salasVersus.delete(salaId);
}

function normalizarSalaId(salaId) {
  return String(salaId || '').trim().toLowerCase();
}

function normalizarIdentificador(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

module.exports = {
  salasVersus,
  crearSalaVersus,
  obtenerSalaVersus,
  obtenerSalaVersusPorSocket,
  unirseASalaVersus,
  registrarIntentoVersus,
  reiniciarSalaVersus,
  cerrarSalaVersus,
  registrarDesconexionVersus,
  obtenerEstadoVersusPublico,
  iniciarLimpiezaVersusPeriodica
};
