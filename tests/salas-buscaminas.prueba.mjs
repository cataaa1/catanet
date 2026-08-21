import { createRequire } from 'node:module';
import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Prueba las salas del Buscaminas directamente, sin sockets

const require = createRequire(ruta('backend', 'package.json'));
const salas = require(ruta('backend', 'buscaminasRooms.js'));

await salas.cargarMotorBuscaminas();


const minasDe = (partida) => {
  const lista = [];
  for (let f = 0; f < partida.filas; f += 1) {
    for (let c = 0; c < partida.columnas; c += 1) {
      if (partida.tablero[f][c].mina) lista.push(`${f}-${c}`);
    }
  }
  return lista;
};

// ---------------- Cooperativo ----------------
const coop = salas.crearSalaBuscaminas('ana', { modo: 'coop', dificultad: 'facil' });
chequear('la sala arranca esperando', coop.fase === 'esperando');
chequear('el id de sala tiene 4 caracteres', coop.id.length === 4, coop.id);
chequear('todavia no hay tablero', coop.partidaCompartida === null);

const estadoSolo = salas.obtenerEstadoBuscaminasPublico(coop, 'ana');
chequear('esperando no expone tablero ni minas',
  estadoSolo.tablero === null && estadoSolo.minas === null);

const union = salas.unirseASalaBuscaminas(coop.id, 'beto');
chequear('con dos jugadores arranca la partida', union.partidaIniciada && coop.fase === 'jugando');
chequear('el tablero compartido existe', Boolean(coop.partidaCompartida));
chequear('se abrio un area inicial', coop.partidaCompartida.celdasReveladas > 1,
  `${coop.partidaCompartida.celdasReveladas}`);
chequear('hay 10 minas colocadas', coop.minas.length === 10, `${coop.minas.length}`);
chequear('cada jugador tiene su color',
  coop.jugadores.ana.color !== coop.jugadores.beto.color);

// Los dos comparten el MISMO tablero
chequear('coop usa un unico tablero para todos',
  salas.obtenerEstadoBuscaminasPublico(coop, 'ana').tablero.celdasReveladas
  === salas.obtenerEstadoBuscaminasPublico(coop, 'beto').tablero.celdasReveladas);

// Durante el juego, el estado no puede filtrar las minas
const enJuego = salas.obtenerEstadoBuscaminasPublico(coop, 'ana');
const clavesMinas = coop.minas.map((m) => `${m.fila}-${m.columna}`);
const filtradas = enJuego.tablero.celdas.filter((c) => clavesMinas.includes(`${c.fila}-${c.columna}`));
chequear('jugando no filtra donde estan las minas', filtradas.length === 0 && enJuego.minas === null,
  `${filtradas.length} filtradas`);

// Una celda segura destapada por beto queda marcada como suya
let seguraCoop = null;
for (let f = 0; f < 9 && !seguraCoop; f += 1) {
  for (let c = 0; c < 9 && !seguraCoop; c += 1) {
    const celda = coop.partidaCompartida.tablero[f][c];
    if (!celda.mina && !celda.revelada) seguraCoop = { f, c };
  }
}
const jugadaCoop = salas.revelarEnSala(coop.id, 'beto', seguraCoop.f, seguraCoop.c);
chequear('revelar en coop devuelve celdas', jugadaCoop.celdas.length > 0);
chequear('las celdas quedan atribuidas a quien las destapo',
  jugadaCoop.celdas.every((c) => c.jugadorId === 'beto'));
chequear('la vista de coop incluye de quien es cada celda',
  salas.obtenerEstadoBuscaminasPublico(coop, 'ana').tablero.celdas.some((c) => c.jugadorId === 'beto'));

// Banderas compartidas
const marca = salas.marcarEnSala(coop.id, 'ana', coop.minas[0].fila, coop.minas[0].columna);
chequear('se puede poner bandera en coop', marca.cambio && marca.puesta);
chequear('la bandera se ve desde el otro jugador',
  salas.obtenerEstadoBuscaminasPublico(coop, 'beto').tablero.celdas
    .some((c) => c.bandera && c.fila === coop.minas[0].fila && c.columna === coop.minas[0].columna));
salas.marcarEnSala(coop.id, 'beto', coop.minas[0].fila, coop.minas[0].columna);
chequear('cualquiera puede sacar la bandera de otro',
  !coop.partidaCompartida.tablero[coop.minas[0].fila][coop.minas[0].columna].bandera);

// Una mina termina la partida para todo el equipo
const explosion = salas.revelarEnSala(coop.id, 'beto', coop.minas[1].fila, coop.minas[1].columna);
chequear('pisar una mina explota', explosion.exploto);
chequear('en coop pierde todo el equipo',
  coop.fase === 'terminada' && coop.resultado === 'derrota' && coop.ganador === null);
chequear('el final manda las minas para dibujarlas', explosion.resultadoFinal.minas.length === 10);
chequear('terminada, el estado ya expone las minas',
  salas.obtenerEstadoBuscaminasPublico(coop, 'ana').minas.length === 10);
let rechazo = false;
try { salas.revelarEnSala(coop.id, 'ana', 0, 0); } catch { rechazo = true; }
chequear('terminada, no se puede seguir jugando', rechazo);

// Revancha
salas.reiniciarSalaBuscaminas(coop.id, 'ana');
chequear('la revancha vuelve a jugando', coop.fase === 'jugando' && coop.resultado === null);
chequear('la revancha genera un tablero nuevo', coop.partidaCompartida.celdasReveladas > 1);

// ---------------- Versus ----------------
const vs = salas.crearSalaBuscaminas('ana', { modo: 'versus', dificultad: 'facil' });
salas.unirseASalaBuscaminas(vs.id, 'beto');
chequear('versus arranca con dos jugadores', vs.fase === 'jugando');

const tableroAna = vs.partidasPorJugador.ana;
const tableroBeto = vs.partidasPorJugador.beto;
chequear('versus le da un tablero propio a cada uno', tableroAna !== tableroBeto);
chequear('los dos tableros tienen las mismas minas',
  minasDe(tableroAna).join() === minasDe(tableroBeto).join());
chequear('los dos arrancan con la misma apertura',
  tableroAna.celdasReveladas === tableroBeto.celdasReveladas && tableroAna.celdasReveladas > 1,
  `${tableroAna.celdasReveladas}`);

// Lo que destapa una no afecta a la otra
let seguraVs = null;
for (let f = 0; f < 9 && !seguraVs; f += 1) {
  for (let c = 0; c < 9 && !seguraVs; c += 1) {
    const celda = tableroAna.tablero[f][c];
    if (!celda.mina && !celda.revelada) seguraVs = { f, c };
  }
}
const antesBeto = tableroBeto.celdasReveladas;
salas.revelarEnSala(vs.id, 'ana', seguraVs.f, seguraVs.c);
chequear('la jugada de una no toca el tablero de la otra',
  tableroBeto.celdasReveladas === antesBeto && tableroAna.celdasReveladas > antesBeto);
chequear('cada una ve el progreso de la rival',
  salas.obtenerEstadoBuscaminasPublico(vs, 'beto').jugadores
    .find((j) => j.id === 'ana').celdasReveladas === tableroAna.celdasReveladas);
chequear('el tablero que recibe cada una es el suyo',
  salas.obtenerEstadoBuscaminasPublico(vs, 'beto').tablero.celdasReveladas === tableroBeto.celdasReveladas);

// Pisar una mina en versus: pierde quien la piso y gana la otra
const minaVs = vs.minas[0];
const finalVs = salas.revelarEnSala(vs.id, 'ana', minaVs.fila, minaVs.columna);
chequear('en versus pisar mina termina la partida', vs.fase === 'terminada');
chequear('gana la rival de quien piso', vs.ganador === 'beto', String(vs.ganador));
chequear('queda registrado quien perdio',
  finalVs.resultadoFinal.perdedor === 'ana' && vs.jugadores.ana.perdio === true);

// ---------------- Sala llena y desconexion ----------------
const llena = salas.crearSalaBuscaminas('uno', { modo: 'versus', dificultad: 'facil' });
salas.unirseASalaBuscaminas(llena.id, 'dos');
let rechazoTercero = false;
try { salas.unirseASalaBuscaminas(llena.id, 'tres'); } catch { rechazoTercero = true; }
chequear('versus no acepta un tercer jugador', rechazoTercero);

const coop2 = salas.crearSalaBuscaminas('a', { modo: 'coop', dificultad: 'facil' });
salas.unirseASalaBuscaminas(coop2.id, 'b');
salas.unirseASalaBuscaminas(coop2.id, 'c');
chequear('coop acepta mas de dos jugadores', coop2.ordenJugadores.length === 3);
chequear('el que entro tarde recibe el tablero en curso',
  salas.obtenerEstadoBuscaminasPublico(coop2, 'c').tablero !== null);

const desco = salas.registrarDesconexionBuscaminas('b');
chequear('la desconexion avisa que queda gente', desco.hayOtroJugadorConectado === true);
chequear('el jugador queda marcado como desconectado', coop2.jugadores.b.conectado === false);
salas.registrarDesconexionBuscaminas('a');
const ultima = salas.registrarDesconexionBuscaminas('c');
chequear('al irse el ultimo avisa que no queda nadie', ultima.hayOtroJugadorConectado === false);

// Sala inexistente
let rechazoSala = false;
try { salas.obtenerSalaBuscaminas('zzzz'); } catch { rechazoSala = true; }
chequear('una sala inexistente da error claro', rechazoSala);

informar(resultados);
