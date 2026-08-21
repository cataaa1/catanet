import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Prueba el Sudoku diario y la carrera contra el servidor real

const require = createRequire(ruta('backend', 'package.json'));
const { io } = require('socket.io-client');

const PUERTO = Number(process.env.PUERTO_PRUEBA) || 3600;
const URL = `http://localhost:${PUERTO}`;

const servidor = spawn(process.execPath, ['server.js'], {
  cwd: ruta('backend'),
  env: { ...process.env, PORT: String(PUERTO) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let salida = '';
servidor.stdout.on('data', (d) => { salida += d; });
servidor.stderr.on('data', (d) => { salida += d; });

await new Promise((resolver, rechazar) => {
  const limite = setTimeout(() => rechazar(new Error('no arranco:\n' + salida)), 20000);
  const revisar = setInterval(() => {
    if (salida.includes('escuchando')) { clearInterval(revisar); clearTimeout(limite); resolver(); }
  }, 100);
});

const conectar = () => new Promise((r) => { const s = io(URL, { transports: ['websocket'] }); s.on('connect', () => r(s)); });
const esperar = (s, evento, ms = 8000) => new Promise((resolver, rechazar) => {
  const limite = setTimeout(() => rechazar(new Error('no llego ' + evento)), ms);
  s.once(evento, (d) => { clearTimeout(limite); resolver(d); });
});
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ---------------- Sudoku diario ----------------
  // El servidor lo genera al arrancar; esperamos a que este listo
  let diario = null;
  for (let intento = 0; intento < 60 && !diario; intento += 1) {
    const respuesta = await fetch(`${URL}/api/sudoku/diario`);
    const datos = await respuesta.json();

    if (datos.listo) {
      diario = datos;
      chequear('el endpoint contesta 200 cuando esta listo', respuesta.status === 200);
    } else {
      chequear('mientras genera contesta 202 sin colgar la peticion', respuesta.status === 202);
      resultados.pop();
      await dormir(1000);
    }
  }

  chequear('el diario termina estando disponible', Boolean(diario));
  chequear('el diario trae fecha del dia', /^\d{4}-\d{2}-\d{2}$/.test(diario.fecha), diario.fecha);
  chequear('el diario es de dificultad experto', diario.dificultad === 'experto', diario.dificultad);
  chequear('el puzzle tiene 81 celdas', diario.puzzle.length === 81);
  chequear('el diario es bien dificil (28 pistas o menos)',
    diario.puzzle.split('').filter((c) => c !== '.').length <= 28,
    `${diario.puzzle.split('').filter((c) => c !== '.').length} pistas`);
  chequear('la solucion esta completa',
    diario.solucion.length === 81 && !diario.solucion.includes('.'));

  const segundoPedido = await (await fetch(`${URL}/api/sudoku/diario`)).json();
  chequear('el segundo pedido devuelve el mismo tablero', segundoPedido.puzzle === diario.puzzle);

  // ---------------- Carrera ----------------
  const ana = await conectar();
  const beto = await conectar();
  const caro = await conectar();

  ana.emit('sudoku-crear-sala', { dificultad: 'facil' });
  const creada = await esperar(ana, 'sudoku-sala-creada');
  chequear('crear sala devuelve link a la carrera',
    creada.link.includes('/sudoku/carrera/?sala='), creada.link);
  chequear('esperando no manda puzzle', creada.estado.puzzle === null);

  const arranqueAna = esperar(ana, 'sudoku-partida-iniciada', 20000);
  const arranqueBeto = esperar(beto, 'sudoku-partida-iniciada', 20000);
  beto.emit('sudoku-unirse-sala', { salaId: creada.salaId });

  const generando = await esperar(beto, 'sudoku-estado');
  chequear('avisa que esta generando antes de repartir',
    generando.estado.fase === 'generando', generando.estado.fase);

  const [inicioAna, inicioBeto] = await Promise.all([arranqueAna, arranqueBeto]);
  chequear('los dos reciben el mismo puzzle',
    inicioAna.estado.puzzle === inicioBeto.estado.puzzle);
  chequear('la carrera queda en juego', inicioAna.estado.fase === 'jugando');
  chequear('todavia no manda la solucion', inicioAna.estado.solucion === null);
  chequear('cada uno recibe su tablero', Array.isArray(inicioAna.estado.tablero));

  // Un tercero se suma con la carrera empezada
  caro.emit('sudoku-unirse-sala', { salaId: creada.salaId });
  const entradaCaro = await esperar(caro, 'sudoku-estado');
  chequear('se puede entrar con la carrera empezada',
    entradaCaro.estado.jugadores.length === 3, `${entradaCaro.estado.jugadores.length}`);
  chequear('el que entra tarde recibe el tablero original',
    entradaCaro.estado.puzzle === inicioAna.estado.puzzle);

  // Ana resuelve el tablero entero: hay que sacar la solucion resolviendo,
  // porque el servidor no la manda hasta que termina la partida
  const solver = await import(urlDe('frontend', 'shared', 'vendor', 'sudoku-lib.js'))
    .catch(() => null);
  const fs = await import('node:fs');
  cargarLibreriaSudoku();
  const solucion = globalThis.sudoku.solve(inicioAna.estado.puzzle);
  chequear('el puzzle repartido tiene solucion', Boolean(solucion));

  // --- Tres errores y quedas afuera de la carrera ---
  const malo = (correcto) => String((Number(correcto) % 9) + 1);
  const vacias = [];
  for (let i = 0; i < 81; i += 1) {
    if (inicioAna.estado.puzzle[i] === '.') vacias.push(i);
  }

  chequear('el estado trae el maximo de errores',
    inicioBeto.estado.maximoErrores === 3, `${inicioBeto.estado.maximoErrores}`);
  chequear('nadie arranca con errores',
    inicioBeto.estado.jugadores.every((j) => j.errores === 0 && !j.eliminado));

  // Beto se equivoca tres veces
  let estadoBetoTrasError = null;
  for (let n = 0; n < 3; n += 1) {
    const i = vacias[n];
    beto.emit('sudoku-jugada', {
      salaId: creada.salaId, fila: Math.floor(i / 9), columna: i % 9, valor: malo(solucion[i])
    });
    estadoBetoTrasError = await esperar(beto, 'sudoku-jugada-registrada');
  }

  const yoBeto = estadoBetoTrasError.estado.jugadores.find((j) => j.soyYo);
  chequear('los errores se cuentan en el servidor', yoBeto.errores === 3, `${yoBeto.errores}`);
  chequear('a los tres errores queda eliminado', yoBeto.eliminado === true);
  chequear('las celdas erradas vuelven marcadas',
    estadoBetoTrasError.estado.erradas.length === 3,
    `${estadoBetoTrasError.estado.erradas.length}`);
  chequear('cada uno ve solo sus propias celdas erradas',
    (await (async () => {
      ana.emit('sudoku-jugada', { salaId: creada.salaId, fila: Math.floor(vacias[5] / 9), columna: vacias[5] % 9, valor: solucion[vacias[5]] });
      const est = await esperar(ana, 'sudoku-jugada-registrada');
      return est.estado.erradas.length === 0;
    })()));

  // Son tres en la sala, asi que con uno eliminado la carrera sigue
  chequear('con tres jugadores, eliminar a uno no corta la carrera',
    estadoBetoTrasError.estado.fase === 'jugando', estadoBetoTrasError.estado.fase);

  // Si tambien se queda sin vidas Caro, Ana gana sin tener que terminar
  const finalPorAbandono = esperar(ana, 'sudoku-partida-terminada', 8000);
  for (let n = 0; n < 3; n += 1) {
    const i = vacias[10 + n];
    caro.emit('sudoku-jugada', {
      salaId: creada.salaId, fila: Math.floor(i / 9), columna: i % 9, valor: malo(solucion[i])
    });
    await dormir(30);
  }
  const porAbandono = await finalPorAbandono;
  chequear('si el resto se queda sin vidas, gana quien sigue en carrera',
    porAbandono.ganador === ana.id, porAbandono.ganador === ana.id ? 'ana' : String(porAbandono.ganador));
  chequear('el que gana asi no figura como que termino el tablero',
    porAbandono.estado.jugadores.find((j) => j.id === ana.id).termino === false);

  // Otra carrera limpia los errores
  const revanchaLimpia = esperar(beto, 'sudoku-partida-iniciada', 20000);
  ana.emit('sudoku-reiniciar', { salaId: creada.salaId });
  const limpia = await revanchaLimpia;
  chequear('la carrera nueva devuelve las vidas',
    limpia.estado.jugadores.every((j) => j.errores === 0 && !j.eliminado));
  chequear('la carrera nueva limpia las celdas erradas', limpia.estado.erradas.length === 0);

  const finalAna = esperar(ana, 'sudoku-partida-terminada', 20000);
  const finalBeto = esperar(beto, 'sudoku-partida-terminada', 20000);

  let progresoDeAnaVistoPorBeto = 0;
  beto.on('sudoku-jugada-registrada', ({ estado }) => {
    const otra = estado.jugadores.find((j) => j.id === ana.id);
    if (otra) progresoDeAnaVistoPorBeto = otra.correctas;
  });

  const puzzleFinal = limpia.estado.puzzle;
  const solucionFinal = globalThis.sudoku.solve(puzzleFinal);

  for (let i = 0; i < 81; i += 1) {
    const fila = Math.floor(i / 9);
    const columna = i % 9;
    if (puzzleFinal[i] !== '.') continue;
    ana.emit('sudoku-jugada', { salaId: creada.salaId, fila, columna, valor: solucionFinal[i] });
    await dormir(4);
  }

  const [terminoAna, terminoBeto] = await Promise.all([finalAna, finalBeto]);
  chequear('gana quien completa primero', terminoAna.ganador === ana.id);
  chequear('la partida queda terminada para todos',
    terminoAna.estado.fase === 'terminada' && terminoBeto.estado.fase === 'terminada');
  chequear('recien al terminar se manda la solucion',
    terminoBeto.estado.solucion === solucionFinal,
    `${String(terminoBeto.estado.solucion).slice(0, 10)} vs ${String(solucionFinal).slice(0, 10)}`);
  chequear('el rival vio el avance en vivo',
    progresoDeAnaVistoPorBeto > 0, `${progresoDeAnaVistoPorBeto} celdas`);
  chequear('el ganador figura con 81 correctas',
    terminoAna.estado.jugadores.find((j) => j.id === ana.id).correctas === 81,
    `${terminoAna.estado.jugadores.find((j) => j.id === ana.id).correctas}`);

  // Ya terminada, no se puede seguir jugando
  const errorTardio = esperar(beto, 'error-sala', 1500).catch(() => null);
  beto.emit('sudoku-jugada', { salaId: creada.salaId, fila: 0, columna: 0, valor: '5' });
  chequear('terminada, rechaza jugadas nuevas', Boolean(await errorTardio));

  ana.disconnect(); beto.disconnect(); caro.disconnect();
} catch (error) {
  chequear('la prueba corrio sin excepciones', false, error.message);
} finally {
  servidor.kill();
}

informar(resultados);
