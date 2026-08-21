import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

const motor = await import(urlDe('frontend', 'shared', 'buscaminas.js'));
const {
  crearPartidaBuscaminas, revelarCelda, revelarVecinos, alternarBandera,
  contarMinasRestantes, obtenerMinas, obtenerVistaPublica, obtenerDificultadBuscaminas
} = motor;


const VECINDARIO = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const contarMinas = (e) => e.tablero.flat().filter((c) => c.mina).length;
const contarReveladas = (e) => e.tablero.flat().filter((c) => c.revelada).length;

// Recalcula los numeros desde cero para contrastarlos con los del motor
function adyacenciasCorrectas(e) {
  for (let f = 0; f < e.filas; f += 1) {
    for (let c = 0; c < e.columnas; c += 1) {
      if (e.tablero[f][c].mina) continue;
      let total = 0;
      for (const [df, dc] of VECINDARIO) {
        const v = e.tablero[f + df] && e.tablero[f + df][c + dc];
        if (v && v.mina) total += 1;
      }
      if (e.tablero[f][c].adyacentes !== total) return false;
    }
  }
  return true;
}

// --- Dificultades ---
const MEDIDAS = { facil: [9, 9, 10], medio: [16, 16, 40], dificil: [16, 30, 99] };
chequear('las tres dificultades tienen las medidas clasicas',
  Object.entries(MEDIDAS).every(([id, medidas]) => {
    const d = obtenerDificultadBuscaminas(id);
    return medidas.join() === [d.filas, d.columnas, d.minas].join();
  }));

// --- Estado inicial ---
const nueva = crearPartidaBuscaminas('medio');
chequear('arranca sin minas colocadas', !nueva.minasColocadas && contarMinas(nueva) === 0);
chequear('arranca sin celdas reveladas', nueva.celdasReveladas === 0);
chequear('el contador arranca en el total de minas', contarMinasRestantes(nueva) === 40);
chequear('dificultad desconocida cae en facil', crearPartidaBuscaminas('inventada').minas === 10);

// --- El primer click nunca es mina y siempre abre area ---
let primerosSeguros = 0;
let primerosConCascada = 0;
let minasExactas = 0;
let adyacenciasOk = 0;
const VUELTAS = 120;

for (let i = 0; i < VUELTAS; i += 1) {
  const dif = ['facil', 'medio', 'dificil'][i % 3];
  const e = crearPartidaBuscaminas(dif);
  const f = Math.floor(Math.random() * e.filas);
  const c = Math.floor(Math.random() * e.columnas);
  const r = revelarCelda(e, f, c);

  if (!r.exploto) primerosSeguros += 1;
  if (r.celdas.length > 1) primerosConCascada += 1;
  if (contarMinas(e) === e.minas) minasExactas += 1;
  if (adyacenciasCorrectas(e)) adyacenciasOk += 1;
}

chequear('el primer click nunca es mina', primerosSeguros === VUELTAS, `${primerosSeguros}/${VUELTAS}`);
chequear('el primer click siempre abre un area', primerosConCascada === VUELTAS, `${primerosConCascada}/${VUELTAS}`);
chequear('siempre coloca la cantidad exacta de minas', minasExactas === VUELTAS, `${minasExactas}/${VUELTAS}`);
chequear('los numeros adyacentes son correctos', adyacenciasOk === VUELTAS, `${adyacenciasOk}/${VUELTAS}`);

// --- Cascada: todo lo revelado es coherente ---
const casc = crearPartidaBuscaminas('facil');
const primera = revelarCelda(casc, 4, 4);
chequear('la cascada no revela ninguna mina', primera.celdas.every((c) => !c.mina));
chequear('celdasReveladas coincide con el tablero', casc.celdasReveladas === contarReveladas(casc),
  `${casc.celdasReveladas} vs ${contarReveladas(casc)}`);
chequear('la cascada devuelve tantas celdas como revelo', primera.celdas.length === casc.celdasReveladas);
// Toda celda en cero revelada tiene sus 8 vecinas reveladas
let bordeOk = true;
for (let f = 0; f < casc.filas; f += 1) {
  for (let c = 0; c < casc.columnas; c += 1) {
    const celda = casc.tablero[f][c];
    if (!celda.revelada || celda.adyacentes !== 0) continue;
    for (const [df, dc] of VECINDARIO) {
      const v = casc.tablero[f + df] && casc.tablero[f + df][c + dc];
      if (v && !v.revelada) bordeOk = false;
    }
  }
}
chequear('la cascada abre el borde completo de cada cero', bordeOk);

// --- Banderas ---
const ban = crearPartidaBuscaminas('facil');
revelarCelda(ban, 0, 0);
const libre = ban.tablero.flat().findIndex((c) => !c.revelada);
const fb = Math.floor(libre / 9);
const cb = libre % 9;
const puesta = alternarBandera(ban, fb, cb);
chequear('poner bandera cambia el estado', puesta.cambio && puesta.puesta);
chequear('la bandera descuenta del contador', contarMinasRestantes(ban) === 9, `${contarMinasRestantes(ban)}`);
chequear('una celda con bandera no se revela', revelarCelda(ban, fb, cb).celdas.length === 0);
chequear('sacar la bandera devuelve el contador',
  alternarBandera(ban, fb, cb).puesta === false && contarMinasRestantes(ban) === 10);
chequear('no se puede marcar una celda ya revelada', alternarBandera(ban, 0, 0).cambio === false);
chequear('fuera del tablero no rompe', alternarBandera(ban, -1, 50).cambio === false
  && revelarCelda(ban, 99, 99).celdas.length === 0);

// --- Derrota ---
const perd = crearPartidaBuscaminas('facil');
revelarCelda(perd, 0, 0);
const minas = obtenerMinas(perd);
chequear('obtenerMinas devuelve todas', minas.length === 10, `${minas.length}`);
const golpe = revelarCelda(perd, minas[0].fila, minas[0].columna);
chequear('pisar una mina explota', golpe.exploto && golpe.celdas[0].mina === true);
chequear('la fase pasa a perdido', perd.fase === 'perdido');
chequear('guarda cual fue la celda explotada',
  perd.celdaExplotada.fila === minas[0].fila && perd.celdaExplotada.columna === minas[0].columna);
chequear('despues de perder no se revela nada mas',
  revelarCelda(perd, minas[1].fila, minas[1].columna).celdas.length === 0);
chequear('despues de perder no se ponen banderas', alternarBandera(perd, minas[1].fila, minas[1].columna).cambio === false);

// --- Victoria: revelamos todas las celdas sin mina ---
const gana = crearPartidaBuscaminas('facil');
revelarCelda(gana, 4, 4);
let ganoEn = null;
for (let f = 0; f < gana.filas && !ganoEn; f += 1) {
  for (let c = 0; c < gana.columnas && !ganoEn; c += 1) {
    if (gana.tablero[f][c].mina || gana.tablero[f][c].revelada) continue;
    const r = revelarCelda(gana, f, c);
    if (r.gano) ganoEn = { f, c };
  }
}
chequear('se gana al revelar todas las celdas sin mina', gana.fase === 'ganado');
chequear('el ultimo revelado avisa que gano', Boolean(ganoEn));
chequear('quedan reveladas exactamente las celdas sin mina',
  contarReveladas(gana) === (81 - 10), `${contarReveladas(gana)}`);
chequear('ninguna mina quedo revelada', gana.tablero.flat().every((c) => !(c.mina && c.revelada)));

// --- Chording ---
const chor = crearPartidaBuscaminas('medio');
revelarCelda(chor, 8, 8);
// Buscamos un numero revelado y le marcamos todas sus minas vecinas
let hizoChording = false;
let chordingSinBanderas = false;
for (let f = 0; f < chor.filas && !hizoChording; f += 1) {
  for (let c = 0; c < chor.columnas && !hizoChording; c += 1) {
    const celda = chor.tablero[f][c];
    if (!celda.revelada || celda.adyacentes === 0) continue;

    // Sin banderas puestas, el chording no debe hacer nada
    if (!chordingSinBanderas) {
      chordingSinBanderas = revelarVecinos(chor, f, c).celdas.length === 0;
    }

    let vecinasSinRevelar = 0;
    for (const [df, dc] of VECINDARIO) {
      const v = chor.tablero[f + df] && chor.tablero[f + df][c + dc];
      if (v && v.mina) alternarBandera(chor, f + df, c + dc);
      if (v && !v.revelada && !v.mina) vecinasSinRevelar += 1;
    }
    if (!vecinasSinRevelar) continue;

    const r = revelarVecinos(chor, f, c);
    hizoChording = r.celdas.length > 0 && !r.exploto;
  }
}
chequear('sin banderas suficientes el chording no hace nada', chordingSinBanderas);
chequear('con las banderas puestas el chording revela', hizoChording);
chequear('el chording no revela minas', chor.tablero.flat().every((c) => !(c.mina && c.revelada)));

// --- La vista publica no filtra las minas ---
const vis = crearPartidaBuscaminas('medio');
revelarCelda(vis, 5, 5);

// La bandera va en una celda tapada: sobre una destapada no se puede marcar
let tapadaVis = null;
for (let f = 0; f < 16 && !tapadaVis; f += 1) {
  for (let c = 0; c < 16 && !tapadaVis; c += 1) {
    if (!vis.tablero[f][c].revelada) tapadaVis = { f, c };
  }
}
alternarBandera(vis, tapadaVis.f, tapadaVis.c);

const vista = obtenerVistaPublica(vis);
const clavesMina = new Set(obtenerMinas(vis).map((m) => `${m.fila}-${m.columna}`));

// Lo que importa: ninguna entrada puede decir que hay una mina, y las celdas
// que expone (fuera de las banderas que puso quien juega) no pueden ser minas.
chequear('la vista publica no marca ninguna mina',
  vista.celdas.every((c) => c.mina !== true));
const expuestas = vista.celdas.filter((c) => !c.bandera && clavesMina.has(`${c.fila}-${c.columna}`));
chequear('la vista publica no expone celdas con mina', expuestas.length === 0, `${expuestas.length}`);
chequear('una bandera propia no cuenta como filtracion',
  vista.celdas.some((c) => c.bandera === true && c.fila === tapadaVis.f && c.columna === tapadaVis.c));
chequear('la vista publica trae las celdas reveladas',
  vista.celdas.filter((c) => !c.bandera).length === vis.celdasReveladas);
chequear('la vista publica no trae el tablero crudo', vista.tablero === undefined);

// Recien al explotar aparece una mina en la vista.
// Ojo: tiene que ser una mina SIN bandera, porque la bandera protege la celda.
const minaLibre = obtenerMinas(vis)
  .find((m) => !vis.tablero[m.fila][m.columna].bandera);
revelarCelda(vis, minaLibre.fila, minaLibre.columna);
chequear('al explotar, la mina pisada si aparece en la vista',
  obtenerVistaPublica(vis).celdas.some((c) => c.mina === true));

informar(resultados);
