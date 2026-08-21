const { randomBytes } = require('crypto');
const { calcularColores, esIntentoValido, normalizarLetrasParciales } = require('./motorWordle');
const { obtenerPalabraAleatoria, esPalabraAceptada } = require('./words');

const LONGITUD_SALA = 4;
const LONGITUD_PALABRA = 5;
const MAXIMO_INTENTOS = 6;
const TIEMPO_RECONEXION_MS = 60 * 1000;
const TIEMPO_LIMPIEZA_MS = 30 * 60 * 1000;

const salas = new Map();
const indiceSalaPorSocket = new Map();

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

  if (salas.has(salaId)) {
    return crearIdSala();
  }

  return salaId;
}

function crearJugador(numeroJugador) {
  return {
    nombre: `Jugador ${numeroJugador}`,
    color: numeroJugador === 1 ? 'plum' : 'mint',
    asiento: numeroJugador,
    conectado: true,
    desconectadoEn: null,
    intentosRealizados: 0
  };
}

function crearSala(socketId, opciones = {}) {
  const salaId = crearIdSala();
  const sala = {
    id: salaId,
    // Estos identificadores dejan lista la sala para futuros juegos y modos.
    juegoId: normalizarIdentificador(opciones.juegoId) || 'wordle',
    modoId: normalizarIdentificador(opciones.modoId) || 'co-wordle-turnos',
    palabraSecreta: obtenerPalabraAleatoria(),
    jugadores: {
      [socketId]: crearJugador(1)
    },
    ordenJugadores: [socketId],
    historialIntentos: [],
    fase: 'esperando',
    turnoActual: socketId,
    // Guardamos quien arranco la ronda actual para alternar la revancha.
    indiceInicioActual: 0,
    ganador: null,
    resultado: null,
    creadaEn: new Date(),
    temporizadorEliminacion: null
  };

  salas.set(salaId, sala);
  indiceSalaPorSocket.set(socketId, salaId);

  return sala;
}

function obtenerSala(salaId) {
  const salaNormalizada = normalizarSalaId(salaId);

  if (!salaNormalizada || !salas.has(salaNormalizada)) {
    throw new Error('La sala no existe o ya expiro.');
  }

  return salas.get(salaNormalizada);
}

function obtenerSalaPorSocket(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  if (!salaId) {
    return null;
  }

  return salas.get(salaId) || null;
}

function unirseASala(salaId, socketId) {
  const sala = obtenerSala(salaId);

  if (sala.jugadores[socketId]) {
    const jugadorExistente = sala.jugadores[socketId];
    jugadorExistente.conectado = true;
    jugadorExistente.desconectadoEn = null;
    actualizarFaseSegunConexion(sala);
    limpiarEliminacionPendiente(sala);

    return {
      sala,
      jugadorId: socketId,
      tipoUnion: 'reingreso'
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
    indiceSalaPorSocket.set(socketId, sala.id);

    sala.ordenJugadores = sala.ordenJugadores.map((jugadorId) => (
      jugadorId === socketAnterior ? socketId : jugadorId
    ));

    if (sala.turnoActual === socketAnterior) {
      sala.turnoActual = socketId;
    }

    actualizarFaseSegunConexion(sala);
    limpiarEliminacionPendiente(sala);

    return {
      sala,
      jugadorId: socketId,
      tipoUnion: 'reconexion'
    };
  }

  if (Object.keys(sala.jugadores).length >= 2) {
    throw new Error('La sala ya esta llena.');
  }

  sala.jugadores[socketId] = crearJugador(2);
  sala.ordenJugadores.push(socketId);
  indiceSalaPorSocket.set(socketId, sala.id);
  actualizarFaseSegunConexion(sala);

  return {
    sala,
    jugadorId: socketId,
    tipoUnion: 'nuevo'
  };
}

function registrarIntento(salaId, socketId, intentoCrudo) {
  const sala = obtenerSala(salaId);
  const jugador = sala.jugadores[socketId];

  if (!jugador) {
    throw new Error('No perteneces a esta sala.');
  }

  if (sala.fase === 'terminada') {
    throw new Error('La partida ya termino. Pedi revancha para jugar otra vez.');
  }

  if (sala.fase === 'pausada') {
    throw new Error('La partida esta pausada porque el otro jugador se desconecto.');
  }

  if (contarJugadoresConectados(sala) < 2) {
    throw new Error('Todavia falta que se conecte el otro jugador.');
  }

  if (sala.turnoActual !== socketId) {
    throw new Error('Todavia no es tu turno.');
  }

  if (sala.historialIntentos.length >= MAXIMO_INTENTOS) {
    throw new Error('Ya se usaron todos los intentos de la partida.');
  }

  const intento = normalizarIntento(intentoCrudo);

  if (!esIntentoValido(intento, LONGITUD_PALABRA)) {
    throw new Error('El intento debe tener 5 letras y usar solo A-Z o Ñ, sin tildes.');
  }

  if (!esPalabraAceptada(intento)) {
    throw new Error('Esa palabra no esta en la lista del juego.');
  }

  const colores = calcularColores(sala.palabraSecreta, intento);
  const acertado = intento === sala.palabraSecreta;

  sala.historialIntentos.push({
    jugadorId: socketId,
    palabra: intento,
    colores,
    numero: sala.historialIntentos.length + 1,
    acertado
  });

  jugador.intentosRealizados += 1;

  let resultadoFinal = null;

  if (acertado) {
    resultadoFinal = finalizarSala(sala, 'equipo', 'victoria');
  } else if (sala.historialIntentos.length >= MAXIMO_INTENTOS) {
    resultadoFinal = finalizarSala(sala, 'sin-aciertos', 'derrota');
  } else {
    sala.turnoActual = obtenerSiguienteJugadorId(sala, socketId);
    sala.fase = 'jugando';
  }

  return {
    sala,
    intento,
    colores,
    estado: obtenerEstadoPublico(sala),
    resultadoFinal
  };
}

function registrarTipeo(salaId, socketId, letrasCrudas) {
  const sala = obtenerSala(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No perteneces a esta sala.');
  }

  if (sala.fase !== 'jugando') {
    throw new Error('La partida todavia no esta lista para jugar.');
  }

  if (sala.turnoActual !== socketId) {
    throw new Error('Solo puede escribir quien tiene el turno actual.');
  }

  return {
    sala,
    letras: normalizarLetrasParciales(letrasCrudas, LONGITUD_PALABRA)
  };
}

function reiniciarSala(salaId, socketId) {
  const sala = obtenerSala(salaId);

  if (!sala.jugadores[socketId]) {
    throw new Error('No perteneces a esta sala.');
  }

  // Solo se reinicia una partida terminada: si no, cualquiera puede cambiarle
  // el tablero al resto en el medio de la partida.
  if (sala.fase !== 'terminada') {
    throw new Error('La partida sigue en curso.');
  }

  sala.palabraSecreta = obtenerPalabraAleatoria();
  sala.historialIntentos = [];
  sala.fase = 'esperando';
  sala.ganador = null;
  sala.resultado = null;
  sala.indiceInicioActual = obtenerSiguienteIndiceInicio(sala);
  sala.turnoActual = sala.ordenJugadores[sala.indiceInicioActual] || null;

  for (const jugador of Object.values(sala.jugadores)) {
    jugador.intentosRealizados = 0;

    if (jugador.conectado) {
      jugador.desconectadoEn = null;
    }
  }

  actualizarFaseSegunConexion(sala);

  return sala;
}

function registrarDesconexion(socketId) {
  const salaId = indiceSalaPorSocket.get(socketId);

  if (!salaId) {
    return null;
  }

  const sala = salas.get(salaId);

  if (!sala || !sala.jugadores[socketId]) {
    indiceSalaPorSocket.delete(socketId);
    return null;
  }

  sala.jugadores[socketId].conectado = false;
  sala.jugadores[socketId].desconectadoEn = new Date();
  indiceSalaPorSocket.delete(socketId);

  if (sala.fase !== 'terminada') {
    sala.fase = Object.keys(sala.jugadores).length < 2 ? 'esperando' : 'pausada';
  }

  programarEliminacionSiHaceFalta(sala);

  return {
    salaId: sala.id,
    sala,
    hayOtroJugadorConectado: contarJugadoresConectados(sala) > 0
  };
}

function obtenerEstadoPublico(sala) {
  return {
    id: sala.id,
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
            intentosRealizados: jugador.intentosRealizados
          }
        ])
    ),
    ordenJugadores: [...sala.ordenJugadores],
    historialIntentos: [...sala.historialIntentos],
    juegoId: sala.juegoId,
    modoId: sala.modoId,
    fase: sala.fase,
    turnoActual: sala.turnoActual,
    ganador: sala.ganador,
    resultado: sala.resultado,
    creadaEn: sala.creadaEn,
    cantidadJugadores: Object.keys(sala.jugadores).length,
    maximoIntentos: MAXIMO_INTENTOS,
    longitudPalabra: LONGITUD_PALABRA
  };
}

function iniciarLimpiezaPeriodica() {
  const temporizador = setInterval(() => {
    const haceTreintaMinutos = Date.now() - TIEMPO_LIMPIEZA_MS;

    for (const [salaId, sala] of salas.entries()) {
      if (sala.creadaEn.getTime() < haceTreintaMinutos) {
        eliminarSala(salaId);
      }
    }
  }, TIEMPO_LIMPIEZA_MS);

  if (typeof temporizador.unref === 'function') {
    temporizador.unref();
  }

  return temporizador;
}

function actualizarFaseSegunConexion(sala) {
  const cantidadJugadores = Object.keys(sala.jugadores).length;
  const jugadoresConectados = contarJugadoresConectados(sala);

  if (sala.fase === 'terminada') {
    limpiarEliminacionPendiente(sala);
    return;
  }

  if (cantidadJugadores < 2) {
    sala.fase = 'esperando';
    return;
  }

  if (jugadoresConectados < 2) {
    sala.fase = 'pausada';
    return;
  }

  if (!sala.turnoActual) {
    sala.turnoActual = sala.ordenJugadores[sala.indiceInicioActual] || sala.ordenJugadores[0] || null;
  }

  sala.fase = 'jugando';
  limpiarEliminacionPendiente(sala);
}

function finalizarSala(sala, ganador, resultado) {
  sala.fase = 'terminada';
  sala.ganador = ganador;
  sala.resultado = resultado;

  return {
    ganador,
    resultado,
    palabraSecreta: sala.palabraSecreta,
    estado: obtenerEstadoPublico(sala)
  };
}

function obtenerSiguienteJugadorId(sala, socketIdActual) {
  const indiceActual = sala.ordenJugadores.indexOf(socketIdActual);

  if (indiceActual === -1 || sala.ordenJugadores.length < 2) {
    return socketIdActual;
  }

  const indiceSiguiente = (indiceActual + 1) % sala.ordenJugadores.length;
  return sala.ordenJugadores[indiceSiguiente];
}

function obtenerSiguienteIndiceInicio(sala) {
  if (sala.ordenJugadores.length < 2) {
    return 0;
  }

  // En cada revancha cambia quien empieza para repartir la ventaja inicial.
  return (sala.indiceInicioActual + 1) % sala.ordenJugadores.length;
}

function normalizarIntento(intentoCrudo) {
  return String(intentoCrudo || '').trim().toUpperCase();
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

function contarJugadoresConectados(sala) {
  return Object.values(sala.jugadores).filter((jugador) => jugador.conectado).length;
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

  const hayJugadoresDesconectados = Object.values(sala.jugadores)
    .some((jugador) => !jugador.conectado);

  if (!hayJugadoresDesconectados) {
    return;
  }

  sala.temporizadorEliminacion = setTimeout(() => {
    eliminarSala(sala.id);
  }, TIEMPO_RECONEXION_MS);

  if (typeof sala.temporizadorEliminacion.unref === 'function') {
    sala.temporizadorEliminacion.unref();
  }
}

function eliminarSala(salaId) {
  const sala = salas.get(salaId);

  if (!sala) {
    return;
  }

  limpiarEliminacionPendiente(sala);

  for (const socketId of Object.keys(sala.jugadores)) {
    indiceSalaPorSocket.delete(socketId);
  }

  salas.delete(salaId);
}

module.exports = {
  salas,
  crearSala,
  obtenerSala,
  obtenerSalaPorSocket,
  unirseASala,
  registrarIntento,
  registrarTipeo,
  reiniciarSala,
  registrarDesconexion,
  obtenerEstadoPublico,
  iniciarLimpiezaPeriodica,
  eliminarSala
};
