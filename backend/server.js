const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const {
  crearSala,
  obtenerSalaPorSocket,
  unirseASala,
  registrarIntento,
  registrarTipeo,
  reiniciarSala,
  registrarDesconexion,
  obtenerEstadoPublico,
  iniciarLimpiezaPeriodica,
  eliminarSala
} = require('./rooms');
const {
  crearSalaVersus,
  obtenerSalaVersusPorSocket,
  unirseASalaVersus,
  registrarIntentoVersus,
  reiniciarSalaVersus,
  cerrarSalaVersus,
  registrarDesconexionVersus,
  obtenerEstadoVersusPublico,
  iniciarLimpiezaVersusPeriodica
} = require('./versusRooms');

const {
  cargarMotorBuscaminas,
  crearSalaBuscaminas,
  obtenerSalaBuscaminasPorSocket,
  unirseASalaBuscaminas,
  revelarEnSala,
  marcarEnSala,
  reiniciarSalaBuscaminas,
  obtenerEstadoBuscaminasPublico,
  registrarDesconexionBuscaminas,
  cerrarSalaBuscaminas,
  iniciarLimpiezaBuscaminasPeriodica
} = require('./buscaminasRooms');

const {
  prepararMotorSalasSudoku,
  crearSalaSudoku,
  obtenerSalaSudokuPorSocket,
  unirseASalaSudoku,
  arrancarCarrera,
  registrarJugadaSudoku,
  reiniciarSalaSudoku,
  obtenerEstadoSudokuPublico,
  registrarDesconexionSudoku,
  cerrarSalaSudoku,
  iniciarLimpiezaSudokuPeriodica
} = require('./sudokuRooms');
const {
  cargarMotorSudoku,
  pedirSudokuDiario,
  precalentarSudokuDiario
} = require('./sudokuDiario');

const PUERTO = Number(process.env.PORT) || 3000;
const app = express();
const servidorHttp = http.createServer(app);
const io = new Server(servidorHttp, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

const rutaFrontend = path.resolve(__dirname, '../frontend');
const rutaHub = path.join(rutaFrontend, 'hub', 'index.html');

app.use(express.json());
app.use((solicitud, respuesta, siguiente) => {
  respuesta.setHeader('Access-Control-Allow-Origin', '*');
  respuesta.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  respuesta.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (solicitud.method === 'OPTIONS') {
    respuesta.sendStatus(204);
    return;
  }

  siguiente();
});

// Servimos el frontend completo desde la raiz para que el hub y los juegos
// queden disponibles con rutas simples como /hub/ o /co-wordle/.
app.use(express.static(rutaFrontend));

// El tablero del dia: el mismo para todo el mundo, generado una vez por dia
app.get('/api/sudoku/diario', async (_solicitud, respuesta) => {
  try {
    const pedido = await pedirSudokuDiario();

    if (!pedido.listo) {
      respuesta.status(202).json({ listo: false, fecha: pedido.fecha });
      return;
    }

    respuesta.json({ listo: true, ...pedido.tablero });
  } catch (error) {
    console.error('Error al servir el Sudoku diario:', error);
    respuesta.status(500).json({ error: 'No pude preparar el tablero de hoy.' });
  }
});

app.get('/salud', (_solicitud, respuesta) => {
  respuesta.json({
    ok: true,
    servicio: 'catanet-backend',
    tiempo: new Date().toISOString()
  });
});

app.get('/', (_solicitud, respuesta) => {
  if (fs.existsSync(rutaHub)) {
    respuesta.sendFile(rutaHub);
    return;
  }

  respuesta.json({
    mensaje: 'Servidor de CataNet corriendo.',
    frontendDisponible: fs.existsSync(rutaFrontend)
  });
});

iniciarLimpiezaPeriodica();
iniciarLimpiezaVersusPeriodica();
iniciarLimpiezaBuscaminasPeriodica();
iniciarLimpiezaSudokuPeriodica();

io.on('connection', (socket) => {
  manejarEventoSeguro(socket, 'crear-sala', (payload) => {
    const opcionesSala = payload && typeof payload === 'object' ? payload : {};
    const sala = crearSala(socket.id, {
      juegoId: opcionesSala.juegoId,
      modoId: opcionesSala.modoId
    });
    socket.join(sala.id);

    socket.emit('sala-creada', {
      salaId: sala.id,
      link: construirLinkSala(socket, sala.id),
      estado: obtenerEstadoPublico(sala)
    });
  });

  manejarEventoSeguro(socket, 'unirse-sala', ({ salaId }) => {
    const resultadoUnion = unirseASala(salaId, socket.id);
    const estado = obtenerEstadoPublico(resultadoUnion.sala);

    socket.join(resultadoUnion.sala.id);

    if (hayDosJugadoresConectados(estado)) {
      io.to(resultadoUnion.sala.id).emit('partida-iniciada', { estado });

      if (resultadoUnion.sala.fase === 'terminada') {
        io.to(resultadoUnion.sala.id).emit('partida-terminada', {
          ganador: resultadoUnion.sala.ganador,
          resultado: resultadoUnion.sala.resultado,
          palabraSecreta: resultadoUnion.sala.palabraSecreta,
          estado: obtenerEstadoPublico(resultadoUnion.sala)
        });
      }
    }
  });

  manejarEventoSeguro(socket, 'enviar-intento', ({ salaId, intento }) => {
    const resultado = registrarIntento(salaId, socket.id, intento);

    io.to(resultado.sala.id).emit('intento-registrado', {
      jugadorId: socket.id,
      intento: resultado.intento,
      colores: resultado.colores,
      estado: resultado.estado
    });

    if (resultado.resultadoFinal) {
      io.to(resultado.sala.id).emit('partida-terminada', resultado.resultadoFinal);
    }
  });

  manejarEventoSeguro(socket, 'tipeo', ({ salaId, letras }) => {
    const resultado = registrarTipeo(salaId, socket.id, letras);

    socket.to(resultado.sala.id).emit('oponente-tipeando', {
      jugadorId: socket.id,
      letras: resultado.letras
    });
  });

  manejarEventoSeguro(socket, 'reiniciar-sala', ({ salaId }) => {
    const sala = reiniciarSala(salaId, socket.id);

    io.to(sala.id).emit('partida-iniciada', {
      estado: obtenerEstadoPublico(sala)
    });
  });

  manejarEventoSeguro(socket, 'cerrar-sala', ({ salaId }) => {
    const sala = obtenerSalaPorSocket(socket.id);

    if (!sala || sala.id !== salaId) {
      return;
    }

    io.to(sala.id).emit('sala-cerrada', {
      jugadorId: socket.id,
      motivo: 'volver-al-hub'
    });

    eliminarSala(sala.id);
  });

  manejarEventoSeguro(socket, 'versus-crear-sala', (payload) => {
    const opcionesSala = payload && typeof payload === 'object' ? payload : {};
    const sala = crearSalaVersus(socket.id, {
      juegoId: opcionesSala.juegoId,
      modoId: opcionesSala.modoId
    });

    socket.join(sala.id);

    socket.emit('versus-sala-creada', {
      salaId: sala.id,
      link: construirLinkPorRuta(socket, sala.id, '/wordle/versus-tiempo/'),
      estado: obtenerEstadoVersusPublico(sala)
    });
  });

  manejarEventoSeguro(socket, 'versus-unirse-sala', ({ salaId }) => {
    const resultadoUnion = unirseASalaVersus(salaId, socket.id, emitirFinalVersus);
    const estado = obtenerEstadoVersusPublico(resultadoUnion.sala);

    socket.join(resultadoUnion.sala.id);

    if (resultadoUnion.partidaIniciada) {
      io.to(resultadoUnion.sala.id).emit('versus-partida-iniciada', { estado });
      return;
    }

    socket.emit('versus-estado', { estado });
  });

  manejarEventoSeguro(socket, 'versus-enviar-intento', ({ salaId, intento }) => {
    const resultado = registrarIntentoVersus(salaId, socket.id, intento);

    io.to(resultado.sala.id).emit('versus-intento-registrado', {
      jugadorId: socket.id,
      intento: resultado.intento,
      colores: resultado.colores,
      tableroCompletado: resultado.tableroCompletado,
      acertado: resultado.acertado,
      sumoPunto: resultado.sumoPunto,
      palabraAnterior: resultado.palabraAnterior,
      estado: resultado.estado
    });
  });

  manejarEventoSeguro(socket, 'versus-reiniciar-sala', ({ salaId }) => {
    const sala = reiniciarSalaVersus(salaId, socket.id, emitirFinalVersus);

    io.to(sala.id).emit('versus-partida-iniciada', {
      estado: obtenerEstadoVersusPublico(sala)
    });
  });

  manejarEventoSeguro(socket, 'versus-cerrar-sala', ({ salaId }) => {
    const sala = obtenerSalaVersusPorSocket(socket.id);

    if (!sala || sala.id !== salaId) {
      return;
    }

    io.to(sala.id).emit('versus-sala-cerrada', {
      jugadorId: socket.id,
      motivo: 'volver-al-menu'
    });

    cerrarSalaVersus(sala.id);
  });

  manejarEventoSeguro(socket, 'buscaminas-crear-sala', (payload) => {
    const opciones = payload && typeof payload === 'object' ? payload : {};
    const sala = crearSalaBuscaminas(socket.id, {
      modo: opciones.modo,
      dificultad: opciones.dificultad
    });

    socket.join(sala.id);

    socket.emit('buscaminas-sala-creada', {
      salaId: sala.id,
      link: construirLinkPorRuta(socket, sala.id, rutaDeBuscaminas(sala.modo)),
      estado: obtenerEstadoBuscaminasPublico(sala, socket.id)
    });
  });

  manejarEventoSeguro(socket, 'buscaminas-unirse-sala', ({ salaId }) => {
    const { sala, partidaIniciada } = unirseASalaBuscaminas(salaId, socket.id);

    socket.join(sala.id);

    if (partidaIniciada) {
      emitirEstadoBuscaminas(sala, 'buscaminas-partida-iniciada');
      return;
    }

    // Quien se suma recibe el estado, y el resto se entera de que llego
    socket.emit('buscaminas-estado', {
      estado: obtenerEstadoBuscaminasPublico(sala, socket.id)
    });
    emitirEstadoBuscaminas(sala, 'buscaminas-estado', { excepto: socket.id });
  });

  manejarEventoSeguro(socket, 'buscaminas-revelar', ({ salaId, fila, columna }) => {
    const resultado = revelarEnSala(salaId, socket.id, Number(fila), Number(columna));

    emitirEstadoBuscaminas(resultado.sala, 'buscaminas-celdas-reveladas', {
      extra: { jugadorId: socket.id, celdas: resultado.celdas }
    });

    if (resultado.resultadoFinal) {
      emitirEstadoBuscaminas(resultado.sala, 'buscaminas-partida-terminada', {
        extra: resultado.resultadoFinal
      });
    }
  });

  manejarEventoSeguro(socket, 'buscaminas-bandera', ({ salaId, fila, columna }) => {
    const resultado = marcarEnSala(salaId, socket.id, Number(fila), Number(columna));

    if (!resultado.cambio) {
      return;
    }

    emitirEstadoBuscaminas(resultado.sala, 'buscaminas-bandera-cambiada', {
      extra: {
        jugadorId: socket.id,
        fila: Number(fila),
        columna: Number(columna),
        puesta: resultado.puesta
      }
    });
  });

  manejarEventoSeguro(socket, 'buscaminas-reiniciar', ({ salaId }) => {
    const sala = reiniciarSalaBuscaminas(salaId, socket.id);

    emitirEstadoBuscaminas(sala, 'buscaminas-partida-iniciada');
  });

  manejarEventoSeguro(socket, 'buscaminas-cerrar-sala', ({ salaId }) => {
    const sala = obtenerSalaBuscaminasPorSocket(socket.id);

    if (!sala || sala.id !== salaId) {
      return;
    }

    io.to(sala.id).emit('buscaminas-sala-cerrada', {
      jugadorId: socket.id,
      motivo: 'volver-al-menu'
    });

    cerrarSalaBuscaminas(sala.id);
  });

  manejarEventoSeguro(socket, 'sudoku-crear-sala', (payload) => {
    const opciones = payload && typeof payload === 'object' ? payload : {};
    const sala = crearSalaSudoku(socket.id, { dificultad: opciones.dificultad });

    socket.join(sala.id);

    socket.emit('sudoku-sala-creada', {
      salaId: sala.id,
      link: construirLinkPorRuta(socket, sala.id, '/sudoku/carrera/'),
      estado: obtenerEstadoSudokuPublico(sala, socket.id)
    });
  });

  manejarEventoSeguro(socket, 'sudoku-unirse-sala', ({ salaId }) => {
    const { sala, debeArrancar } = unirseASalaSudoku(salaId, socket.id);

    socket.join(sala.id);

    if (!debeArrancar) {
      emitirEstadoSudoku(sala, 'sudoku-estado');
      return;
    }

    // Generar el tablero tarda, asi que primero avisamos y despues repartimos
    emitirEstadoSudoku(sala, 'sudoku-estado');

    arrancarCarrera(sala)
      .then(() => emitirEstadoSudoku(sala, 'sudoku-partida-iniciada'))
      .catch((error) => {
        sala.fase = 'esperando';
        io.to(sala.id).emit('error-sala', { mensaje: error.message });
      });
  });

  manejarEventoSeguro(socket, 'sudoku-jugada', ({ salaId, fila, columna, valor }) => {
    const resultado = registrarJugadaSudoku(
      salaId, socket.id, Number(fila), Number(columna), valor
    );

    emitirEstadoSudoku(resultado.sala, 'sudoku-jugada-registrada');

    if (resultado.resultadoFinal) {
      emitirEstadoSudoku(resultado.sala, 'sudoku-partida-terminada', {
        extra: resultado.resultadoFinal
      });
    }
  });

  manejarEventoSeguro(socket, 'sudoku-reiniciar', ({ salaId }) => {
    const sala = reiniciarSalaSudoku(salaId, socket.id);

    emitirEstadoSudoku(sala, 'sudoku-estado');

    arrancarCarrera(sala)
      .then(() => emitirEstadoSudoku(sala, 'sudoku-partida-iniciada'))
      .catch((error) => {
        sala.fase = 'terminada';
        io.to(sala.id).emit('error-sala', { mensaje: error.message });
      });
  });

  manejarEventoSeguro(socket, 'sudoku-cerrar-sala', ({ salaId }) => {
    const sala = obtenerSalaSudokuPorSocket(socket.id);

    if (!sala || sala.id !== salaId) {
      return;
    }

    io.to(sala.id).emit('sudoku-sala-cerrada', { jugadorId: socket.id });
    cerrarSalaSudoku(sala.id);
  });

  socket.on('disconnect', () => {
    try {
      const resultado = registrarDesconexion(socket.id);

      if (resultado && resultado.hayOtroJugadorConectado) {
        socket.to(resultado.salaId).emit('jugador-desconectado');
      }

      const resultadoSudoku = registrarDesconexionSudoku(socket.id);

      if (resultadoSudoku && resultadoSudoku.hayOtroJugadorConectado) {
        socket.to(resultadoSudoku.salaId).emit('sudoku-jugador-desconectado', {
          jugadorId: socket.id
        });
      }

      const resultadoBuscaminas = registrarDesconexionBuscaminas(socket.id);

      if (resultadoBuscaminas && resultadoBuscaminas.hayOtroJugadorConectado) {
        socket.to(resultadoBuscaminas.salaId).emit('buscaminas-jugador-desconectado', {
          jugadorId: socket.id
        });
      }

      const resultadoVersus = registrarDesconexionVersus(socket.id);

      if (resultadoVersus && resultadoVersus.hayOtroJugadorConectado) {
        socket.to(resultadoVersus.salaId).emit('versus-sala-cerrada', {
          jugadorId: socket.id,
          motivo: 'rival-desconectado'
        });
        cerrarSalaVersus(resultadoVersus.salaId);
      }
    } catch (error) {
      console.error('Error al manejar una desconexion:', error);
    }
  });
});

iniciarServidor();

async function iniciarServidor() {
  try {
    // El motor del Buscaminas es un modulo ES y este archivo es CommonJS, asi
    // que se carga con import() dinamico antes de empezar a escuchar.
    await cargarMotorBuscaminas();
    await cargarMotorSudoku();
    await prepararMotorSalasSudoku();
  } catch (error) {
    console.error('No pude cargar el motor del Buscaminas:', error);
    process.exit(1);
  }

  // Arrancamos a generar el tablero del dia ya mismo, para que nadie lo espere
  precalentarSudokuDiario();

  servidorHttp.listen(PUERTO, () => {
    console.log(`Servidor de CataNet escuchando en http://localhost:${PUERTO}`);
  });
}

function rutaDeBuscaminas(modo) {
  return modo === 'versus' ? '/buscaminas/versus/' : '/buscaminas/cooperativo/';
}

// Cada persona ve su propio tablero, asi que el estado va personalizado
function emitirEstadoSudoku(sala, evento, opciones = {}) {
  const { extra = {} } = opciones;

  sala.ordenJugadores.forEach((jugadorId) => {
    io.to(jugadorId).emit(evento, {
      ...extra,
      estado: obtenerEstadoSudokuPublico(sala, jugadorId)
    });
  });
}

// En versus cada persona ve su propio tablero, asi que el estado va personalizado
function emitirEstadoBuscaminas(sala, evento, opciones = {}) {
  const { extra = {}, excepto = null } = opciones;

  sala.ordenJugadores.forEach((jugadorId) => {
    if (jugadorId === excepto) {
      return;
    }

    io.to(jugadorId).emit(evento, {
      ...extra,
      estado: obtenerEstadoBuscaminasPublico(sala, jugadorId)
    });
  });
}

function manejarEventoSeguro(socket, nombreEvento, controlador) {
  socket.on(nombreEvento, (payload = {}) => {
    try {
      controlador(payload);
    } catch (error) {
      console.error(`Error en el evento "${nombreEvento}":`, error);
      socket.emit('error-sala', {
        mensaje: error.message || 'Ocurrio un error inesperado en el servidor.'
      });
    }
  });
}

function construirLinkSala(socket, salaId) {
  return construirLinkPorRuta(socket, salaId, '/co-wordle/');
}

function construirLinkPorRuta(socket, salaId, ruta) {
  const origen = socket.handshake.headers.origin;

  if (origen) {
    return `${origen.replace(/\/$/, '')}${ruta}?sala=${salaId}`;
  }

  const protocolo = socket.handshake.headers['x-forwarded-proto'] || 'http';
  const host = socket.handshake.headers['x-forwarded-host']
    || socket.handshake.headers.host
    || `localhost:${PUERTO}`;

  return `${protocolo}://${host}${ruta}?sala=${salaId}`;
}

function hayDosJugadoresConectados(estado) {
  const jugadoresConectados = Object.values(estado.jugadores)
    .filter((jugador) => jugador.conectado);

  return jugadoresConectados.length === 2;
}

function emitirFinalVersus(sala) {
  io.to(sala.id).emit('versus-partida-terminada', {
    estado: obtenerEstadoVersusPublico(sala)
  });
}
