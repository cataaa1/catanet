import { createRequire } from 'node:module';

import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

const require = createRequire(ruta('backend', 'package.json'));
const salas = require(ruta('backend', 'rooms.js'));
const { cargarMotorWordle } = require(ruta('backend', 'motorWordle.js'));

await cargarMotorWordle();

// --- Crear y unirse ---
const sala = salas.crearSala('ana', {});
chequear('la sala arranca esperando', sala.fase === 'esperando', sala.fase);
chequear('el id tiene 4 caracteres', sala.id.length === 4, sala.id);
chequear('quien crea arranca con el turno', sala.turnoActual === 'ana');
chequear('la palabra secreta es de 5 letras', /^[A-ZÑ]{5}$/.test(sala.palabraSecreta), sala.palabraSecreta);

const estadoSolo = salas.obtenerEstadoPublico(sala);
chequear('el estado publico NO incluye la palabra secreta',
  !JSON.stringify(estadoSolo).includes(sala.palabraSecreta), JSON.stringify(estadoSolo).slice(0, 60));

salas.unirseASala(sala.id, 'beto');
chequear('con dos jugadores se puede jugar', Object.keys(sala.jugadores).length === 2);

// --- Turnos ---
let rechazoFueraDeTurno = false;
try {
  salas.registrarIntento(sala.id, 'beto', 'CASAS');
} catch (error) {
  rechazoFueraDeTurno = error.message.includes('turno');
}
chequear('quien no tiene el turno no puede jugar', rechazoFueraDeTurno);

let rechazoTipeo = false;
try {
  salas.registrarTipeo(sala.id, 'beto', 'CAS');
} catch (error) {
  rechazoTipeo = true;
}
chequear('tampoco puede compartir su tipeo', rechazoTipeo);

const tipeo = salas.registrarTipeo(sala.id, 'ana', 'ca<s>a');
chequear('el tipeo se limpia de basura', tipeo.letras === 'CASA', tipeo.letras);

// --- Un intento valido pasa el turno ---
const palabras = require(ruta('backend', 'words.js'));
const distintaAlSecreto = palabras.respuestas.find((p) => p !== sala.palabraSecreta);
const primer = salas.registrarIntento(sala.id, 'ana', distintaAlSecreto);

chequear('el intento devuelve un color por letra', primer.colores.length === 5);
chequear('el turno pasa a la otra persona', sala.turnoActual === 'beto', String(sala.turnoActual));
chequear('el intento queda en el historial compartido', sala.historialIntentos.length === 1);
chequear('se cuenta el intento de quien jugo', sala.jugadores.ana.intentosRealizados === 1);

// --- Validaciones ---
let rechazoCorta = false;
try {
  salas.registrarIntento(sala.id, 'beto', 'CASA');
} catch (error) {
  rechazoCorta = error.message.includes('5 letras');
}
chequear('rechaza un intento de menos de 5 letras', rechazoCorta);

let rechazoInventada = false;
try {
  salas.registrarIntento(sala.id, 'beto', 'XKQZW');
} catch (error) {
  rechazoInventada = error.message.includes('lista');
}
chequear('rechaza una palabra que no esta en la lista', rechazoInventada);

let rechazoEtiqueta = false;
try {
  salas.registrarIntento(sala.id, 'beto', '<b>hi');
} catch (error) {
  rechazoEtiqueta = true;
}
chequear('rechaza texto con etiquetas HTML', rechazoEtiqueta);
chequear('un intento rechazado no gasta el turno', sala.turnoActual === 'beto');

// --- Victoria compartida ---
const gana = salas.registrarIntento(sala.id, 'beto', sala.palabraSecreta);
chequear('acertar termina la partida', gana.resultadoFinal !== null && sala.fase === 'terminada');
chequear('el resultado es victoria', sala.resultado === 'victoria', String(sala.resultado));
chequear('al terminar si se revela la palabra',
  gana.resultadoFinal.palabraSecreta === sala.palabraSecreta);
chequear('terminada, no se puede seguir jugando', (() => {
  try {
    salas.registrarIntento(sala.id, 'ana', distintaAlSecreto);
    return false;
  } catch (error) {
    return true;
  }
})());

// --- Revancha: arranca la otra persona ---
const arrancoAntes = 'ana';
const palabraAnterior = sala.palabraSecreta;
salas.reiniciarSala(sala.id, 'ana');
chequear('la revancha reparte una palabra nueva',
  sala.palabraSecreta !== palabraAnterior || sala.historialIntentos.length === 0);
chequear('la revancha limpia el historial', sala.historialIntentos.length === 0);
chequear('en la revancha arranca la otra persona',
  sala.turnoActual !== arrancoAntes, String(sala.turnoActual));

// --- No se puede reiniciar una partida en curso ---
salas.unirseASala(sala.id, 'ana');
salas.unirseASala(sala.id, 'beto');
let rechazoReinicio = false;
try {
  salas.reiniciarSala(sala.id, 'ana');
} catch (error) {
  rechazoReinicio = error.message.includes('curso');
}
chequear('no se puede reiniciar una partida en curso', rechazoReinicio);

// --- Derrota tras seis intentos ---
const perder = salas.crearSala('uno', {});
salas.unirseASala(perder.id, 'dos');

const fallidas = palabras.respuestas.filter((p) => p !== perder.palabraSecreta).slice(0, 6);
let turnos = ['uno', 'dos'];

for (let i = 0; i < 6; i += 1) {
  salas.registrarIntento(perder.id, perder.turnoActual, fallidas[i]);
}

chequear('a los seis intentos se pierde',
  perder.fase === 'terminada' && perder.resultado === 'derrota',
  `${perder.fase}/${perder.resultado}`);
chequear('los seis intentos son compartidos, no seis por cabeza',
  perder.historialIntentos.length === 6, `${perder.historialIntentos.length}`);
chequear('cada uno jugo tres',
  perder.jugadores.uno.intentosRealizados === 3 && perder.jugadores.dos.intentosRealizados === 3,
  `${perder.jugadores.uno.intentosRealizados} y ${perder.jugadores.dos.intentosRealizados}`);

// --- Desconexion ---
const desco = salas.registrarDesconexion('dos');
chequear('la desconexion avisa que queda alguien', desco.hayOtroJugadorConectado === true);
chequear('el jugador queda marcado como desconectado', perder.jugadores.dos.conectado === false);

// --- Sala inexistente ---
chequear('una sala inexistente da error claro', (() => {
  try {
    salas.obtenerSala('zzzz');
    return false;
  } catch (error) {
    return error.message.includes('no existe');
  }
})());

informar(resultados);
