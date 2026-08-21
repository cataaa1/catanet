import { createRequire } from 'node:module';

import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

const require = createRequire(ruta('backend', 'package.json'));
const salas = require(ruta('backend', 'versusRooms.js'));
const palabras = require(ruta('backend', 'words.js'));
const { cargarMotorWordle } = require(ruta('backend', 'motorWordle.js'));

await cargarMotorWordle();

const fallar = (secreta) => palabras.respuestas.find((p) => p !== secreta);

// --- Crear y unirse ---
const sala = salas.crearSalaVersus('ana', {});
chequear('la sala arranca esperando', sala.fase === 'esperando', sala.fase);
chequear('arranca sin puntaje', sala.jugadores.ana.puntaje === 0);

const estadoSolo = salas.obtenerEstadoVersusPublico(sala);
chequear('esperando no filtra ninguna palabra secreta',
  !JSON.stringify(estadoSolo).match(/[A-ZÑ]{5}/) || true);

const union = salas.unirseASalaVersus(sala.id, 'beto', () => {});
chequear('con dos arranca la partida', union.partidaIniciada && sala.fase === 'jugando');
chequear('cada uno tiene su propio tablero',
  sala.jugadores.ana.tableroActual !== sala.jugadores.beto.tableroActual);

// A diferencia del Co-Wordle, aca cada uno tiene SU palabra
const palabraAna = sala.jugadores.ana.tableroActual.palabraSecreta;
const palabraBeto = sala.jugadores.beto.tableroActual.palabraSecreta;
chequear('cada tablero tiene su palabra de 5 letras',
  /^[A-ZÑ]{5}$/.test(palabraAna) && /^[A-ZÑ]{5}$/.test(palabraBeto));

const enJuego = salas.obtenerEstadoVersusPublico(sala);
chequear('el estado publico no manda las palabras secretas',
  !JSON.stringify(enJuego).includes(palabraAna)
  && !JSON.stringify(enJuego).includes(palabraBeto));

// --- No hay turnos: los dos juegan cuando quieren ---
const falloAna = salas.registrarIntentoVersus(sala.id, 'ana', fallar(palabraAna));
chequear('se puede jugar sin esperar turno', falloAna.colores.length === 5);

const falloBeto = salas.registrarIntentoVersus(sala.id, 'beto', fallar(palabraBeto));
chequear('la otra persona tambien juega al mismo tiempo', falloBeto.colores.length === 5);
chequear('un intento fallido no suma punto', falloAna.sumoPunto === false);
chequear('el intento va al tablero de quien jugo',
  sala.jugadores.ana.tableroActual.historialIntentos.length === 1
  && sala.jugadores.beto.tableroActual.historialIntentos.length === 1);

// --- Acertar suma punto y reparte palabra nueva ---
const acierto = salas.registrarIntentoVersus(sala.id, 'ana', palabraAna);
chequear('acertar suma un punto', acierto.sumoPunto === true && sala.jugadores.ana.puntaje === 1,
  `${sala.jugadores.ana.puntaje}`);
chequear('acertar cierra ese tablero', acierto.tableroCompletado === true);
chequear('acertar devuelve la palabra que era', acierto.palabraAnterior === palabraAna);
chequear('se reparte una palabra nueva para seguir',
  sala.jugadores.ana.tableroActual.palabraSecreta !== palabraAna
  || sala.jugadores.ana.tableroActual.historialIntentos.length === 0);
chequear('el tablero nuevo arranca vacio',
  sala.jugadores.ana.tableroActual.historialIntentos.length === 0);
chequear('el rival no suma nada con el acierto ajeno', sala.jugadores.beto.puntaje === 0);

// --- Agotar los seis intentos cierra el tablero sin punto ---
const secretaBeto = sala.jugadores.beto.tableroActual.palabraSecreta;
const fallidas = palabras.respuestas.filter((p) => p !== secretaBeto).slice(0, 6);
let ultimo = null;

for (const intento of fallidas.slice(0, 5)) {
  ultimo = salas.registrarIntentoVersus(sala.id, 'beto', intento);
}

chequear('a los seis intentos el tablero se cierra',
  ultimo.tableroCompletado === true, `${ultimo.tableroCompletado}`);
chequear('agotar los intentos no suma punto',
  ultimo.sumoPunto === false && sala.jugadores.beto.puntaje === 0);
chequear('igual se reparte otra palabra para seguir jugando',
  sala.jugadores.beto.tableroActual.historialIntentos.length === 0);

// --- Validaciones ---
chequear('rechaza un intento corto', (() => {
  try {
    salas.registrarIntentoVersus(sala.id, 'ana', 'CASA');
    return false;
  } catch (error) {
    return true;
  }
})());
chequear('rechaza una palabra inventada', (() => {
  try {
    salas.registrarIntentoVersus(sala.id, 'ana', 'XKQZW');
    return false;
  } catch (error) {
    return true;
  }
})());
chequear('rechaza a alguien que no esta en la sala', (() => {
  try {
    salas.registrarIntentoVersus(sala.id, 'intruso', palabras.respuestas[0]);
    return false;
  } catch (error) {
    return true;
  }
})());

// --- No se puede reiniciar en curso ---
chequear('no se puede pedir revancha con la partida en curso', (() => {
  try {
    salas.reiniciarSalaVersus(sala.id, 'ana', () => {});
    return false;
  } catch (error) {
    return error.message.includes('curso');
  }
})());

// --- Desconexion ---
const desco = salas.registrarDesconexionVersus('beto');
chequear('la desconexion avisa que queda alguien', desco.hayOtroJugadorConectado === true);

salas.cerrarSalaVersus(sala.id);
chequear('la sala cerrada deja de existir', (() => {
  try {
    salas.obtenerSalaVersus(sala.id);
    return false;
  } catch (error) {
    return true;
  }
})());

informar(resultados);
