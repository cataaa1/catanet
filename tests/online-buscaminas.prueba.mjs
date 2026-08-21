import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Prueba de punta a punta: levanta el servidor real y conecta dos clientes

const require = createRequire(ruta('backend', 'package.json'));
const { io } = require('socket.io-client');

const PUERTO = Number(process.env.PUERTO_PRUEBA) || 3600;
const URL = `http://localhost:${PUERTO}`;

const servidor = spawn(process.execPath, ['server.js'], {
  cwd: ruta('backend'),
  env: { ...process.env, PORT: String(PUERTO) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let salidaServidor = '';
servidor.stdout.on('data', (d) => { salidaServidor += d; });
servidor.stderr.on('data', (d) => { salidaServidor += d; });

// Esperamos a que el servidor avise que escucha
await new Promise((resolve, reject) => {
  const limite = setTimeout(() => reject(new Error('el servidor no arranco:\n' + salidaServidor)), 15000);
  const revisar = setInterval(() => {
    if (salidaServidor.includes('escuchando')) {
      clearInterval(revisar); clearTimeout(limite); resolve();
    }
  }, 100);
});


function conectar() {
  return new Promise((resolve) => {
    const socket = io(URL, { transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
  });
}

const esperar = (socket, evento, ms = 5000) => new Promise((resolve, reject) => {
  const limite = setTimeout(() => reject(new Error(`no llego ${evento}`)), ms);
  socket.once(evento, (datos) => { clearTimeout(limite); resolve(datos); });
});

try {
  // ---------------- Versus ----------------
  const ana = await conectar();
  const beto = await conectar();
  chequear('los dos clientes conectan por websocket', ana.connected && beto.connected);

  ana.emit('buscaminas-crear-sala', { modo: 'versus', dificultad: 'facil' });
  const creada = await esperar(ana, 'buscaminas-sala-creada');
  chequear('crear sala devuelve id y link',
    Boolean(creada.salaId) && creada.link.includes('/buscaminas/versus/?sala='), creada.link);
  chequear('esperando no manda tablero', creada.estado.tablero === null);

  const arranqueAna = esperar(ana, 'buscaminas-partida-iniciada');
  const arranqueBeto = esperar(beto, 'buscaminas-partida-iniciada');
  beto.emit('buscaminas-unirse-sala', { salaId: creada.salaId });
  const [estadoAna, estadoBeto] = await Promise.all([arranqueAna, arranqueBeto]);

  chequear('los dos reciben la partida iniciada',
    estadoAna.estado.fase === 'jugando' && estadoBeto.estado.fase === 'jugando');
  chequear('los dos arrancan con la misma apertura',
    estadoAna.estado.tablero.celdasReveladas === estadoBeto.estado.tablero.celdasReveladas
    && estadoAna.estado.tablero.celdasReveladas > 1,
    `${estadoAna.estado.tablero.celdasReveladas}`);
  chequear('el tablero llega sin las minas',
    estadoAna.estado.minas === null
    && estadoAna.estado.tablero.celdas.every((c) => c.mina !== true));
  chequear('cada uno se reconoce a si mismo',
    estadoAna.estado.jugadores.find((j) => j.soyYo).id === ana.id
    && estadoBeto.estado.jugadores.find((j) => j.soyYo).id === beto.id);

  // --- Bandera primero, que no depende del azar ---
  const tapadaAna = (() => {
    const abiertas = new Set(estadoAna.estado.tablero.celdas.map((c) => `${c.fila}-${c.columna}`));
    for (let f = 0; f < 9; f += 1) {
      for (let c = 0; c < 9; c += 1) if (!abiertas.has(`${f}-${c}`)) return { f, c };
    }
    return null;
  })();

  ana.emit('buscaminas-bandera', { salaId: creada.salaId, fila: tapadaAna.f, columna: tapadaAna.c });
  const bandera = await esperar(ana, 'buscaminas-bandera-cambiada');
  chequear('la bandera se registra', bandera.puesta === true);
  chequear('la bandera descuenta del contador de minas',
    bandera.estado.tablero.minasRestantes === 9, `${bandera.estado.tablero.minasRestantes}`);

  const banderaRival = esperar(beto, 'buscaminas-bandera-cambiada', 800).catch(() => null);
  const avisoRival = await banderaRival;
  chequear('en versus la bandera del rival no toca tu tablero',
    avisoRival === null || avisoRival.estado.tablero.minasRestantes === 10,
    avisoRival ? `${avisoRival.estado.tablero.minasRestantes}` : 'no llego, correcto');

  ana.emit('buscaminas-bandera', { salaId: creada.salaId, fila: tapadaAna.f, columna: tapadaAna.c });
  await esperar(ana, 'buscaminas-bandera-cambiada');

  // --- Ahora si, destapamos hasta que la partida termine ---
  const finalAna = esperar(ana, 'buscaminas-partida-terminada', 8000);
  const finalBeto = esperar(beto, 'buscaminas-partida-terminada', 8000);

  let progresoVisto = false;
  for (let f = 0; f < 9; f += 1) {
    for (let c = 0; c < 9; c += 1) {
      ana.emit('buscaminas-revelar', { salaId: creada.salaId, fila: f, columna: c });
      await new Promise((r) => setTimeout(r, 12));
    }
  }

  const [terminadaAna, terminadaBeto] = await Promise.all([finalAna, finalBeto]);
  chequear('la partida termina y avisa a los dos',
    terminadaAna.estado.fase === 'terminada' && terminadaBeto.estado.fase === 'terminada');
  chequear('el final manda las 10 minas para dibujarlas',
    terminadaAna.minas.length === 10, `${terminadaAna.minas ? terminadaAna.minas.length : 'sin minas'}`);
  chequear('hay un ganador o un perdedor definido',
    Boolean(terminadaAna.ganador) || Boolean(terminadaAna.perdedor),
    `ganador=${terminadaAna.ganador} perdedor=${terminadaAna.perdedor}`);
  chequear('los dos coinciden en quien gano',
    terminadaAna.estado.ganador === terminadaBeto.estado.ganador);
  chequear('terminada, el estado ya expone las minas',
    terminadaBeto.estado.minas !== null && terminadaBeto.estado.minas.length === 10);

  // Revancha
  const revanchaAna = esperar(ana, 'buscaminas-partida-iniciada');
  ana.emit('buscaminas-reiniciar', { salaId: creada.salaId });
  const revancha = await revanchaAna;
  chequear('la revancha reparte un tablero nuevo',
    revancha.estado.fase === 'jugando' && revancha.estado.minas === null);

  ana.disconnect();
  beto.disconnect();

  // ---------------- Cooperativo ----------------
  const uno = await conectar();
  const dos = await conectar();

  uno.emit('buscaminas-crear-sala', { modo: 'coop', dificultad: 'facil' });
  const salaCoop = await esperar(uno, 'buscaminas-sala-creada');
  chequear('el link del coop apunta al modo correcto',
    salaCoop.link.includes('/buscaminas/cooperativo/?sala='), salaCoop.link);

  const arranqueUno = esperar(uno, 'buscaminas-partida-iniciada');
  dos.emit('buscaminas-unirse-sala', { salaId: salaCoop.salaId });
  const coopUno = await arranqueUno;
  chequear('el coop arranca con dos', coopUno.estado.fase === 'jugando');
  chequear('el coop marca de quien es cada celda',
    coopUno.estado.tablero.celdas.every((c) => 'jugadorId' in c));

  // Lo que destapa uno tiene que verlo el otro en el mismo tablero
  const abiertasCoop = new Set(coopUno.estado.tablero.celdas.map((c) => `${c.fila}-${c.columna}`));
  let tapadaCoop = null;
  for (let f = 0; f < 9 && !tapadaCoop; f += 1) {
    for (let c = 0; c < 9 && !tapadaCoop; c += 1) {
      if (!abiertasCoop.has(`${f}-${c}`)) tapadaCoop = { f, c };
    }
  }

  const avisoDos = esperar(dos, 'buscaminas-celdas-reveladas');
  uno.emit('buscaminas-revelar', { salaId: salaCoop.salaId, fila: tapadaCoop.f, columna: tapadaCoop.c });
  const vistoPorDos = await avisoDos;
  const vistoPorUno = await esperar(uno, 'buscaminas-celdas-reveladas').catch(() => vistoPorDos);

  chequear('en coop los dos ven el mismo tablero',
    vistoPorDos.estado.tablero.celdasReveladas === vistoPorUno.estado.tablero.celdasReveladas,
    `${vistoPorDos.estado.tablero.celdasReveladas} vs ${vistoPorUno.estado.tablero.celdasReveladas}`);
  chequear('la celda destapada queda atribuida a quien la abrio',
    vistoPorDos.jugadorId === uno.id);

  uno.disconnect();
  dos.disconnect();
} catch (error) {
  chequear('la prueba corrio sin excepciones', false, error.message);
} finally {
  servidor.kill();
}

informar(resultados);
