// Envuelve la lista de palabras del cliente y anota cual salio sorteada.
//
// El Wordle no expone su palabra secreta (para eso esta), asi que sin esto la
// prueba no podria ganar a proposito ni verificar los colores de una partida
// real. Con el espia en lugar de words.js, la prueba sabe que salio.
import { urlDe } from './rutas.mjs';

const original = await import(urlDe('frontend', 'shared', 'words.js'));

export const espia = { ultimaPalabra: null };

export function obtenerPalabraAleatoria() {
  espia.ultimaPalabra = original.obtenerPalabraAleatoria();

  return espia.ultimaPalabra;
}

export const {
  validWords,
  answerWords,
  palabras,
  palabrasJuego,
  respuestasJuego,
  palabrasValidas,
  respuestasValidas
} = original;
