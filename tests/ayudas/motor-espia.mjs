// Envuelve el motor del Buscaminas y se guarda la ultima partida creada.
//
// Las pruebas del modo individual necesitan saber donde estan las minas para
// poder ganar o perder a proposito, pero el juego no expone su estado. Con este
// espia en lugar del motor, la prueba lee el tablero sin tocar el juego.
import { urlDe } from './rutas.mjs';

const motor = await import(urlDe('frontend', 'shared', 'buscaminas.js'));

export const espia = { ultima: null };

export function crearPartidaBuscaminas(dificultad) {
  espia.ultima = motor.crearPartidaBuscaminas(dificultad);

  return espia.ultima;
}

export const {
  alternarBandera,
  contarMinasRestantes,
  obtenerDificultadBuscaminas,
  obtenerMinas,
  revelarCelda,
  revelarVecinos,
  sembrarMinas,
  elegirAperturaMinima,
  obtenerVistaPublica
} = motor;
