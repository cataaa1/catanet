// Logica del Wordle compartida entre los cuatro modos y el servidor.
//
// Vivia copiada en rooms.js, versusRooms.js y los dos game.js del Wordle. Es el
// algoritmo mas delicado del proyecto —el de las letras repetidas— y tenerlo
// cuatro veces significaba que un arreglo en uno podia no llegar al resto, y que
// el mismo intento mostrara colores distintos segun el modo.

export const COLOR_CORRECTO = 'correcto';
export const COLOR_PRESENTE = 'presente';
export const COLOR_AUSENTE = 'ausente';

/**
 * Colorea un intento contra la palabra secreta.
 *
 * Las letras repetidas son el caso dificil: si la palabra tiene una sola O y el
 * intento tiene dos, solo una se pinta. Por eso son dos pasadas, y la primera
 * descuenta las letras que ya uso.
 *
 * @param {string} palabraSecreta
 * @param {string} intento misma longitud que la palabra
 * @returns {string[]} un color por letra
 */
export function calcularColores(palabraSecreta, intento) {
  const largo = palabraSecreta.length;
  const colores = Array(largo).fill(COLOR_AUSENTE);
  const letrasDisponibles = palabraSecreta.split('');
  const letrasIntento = intento.split('');

  // Primera pasada: las que estan en la posicion exacta
  for (let indice = 0; indice < largo; indice += 1) {
    if (letrasIntento[indice] === letrasDisponibles[indice]) {
      colores[indice] = COLOR_CORRECTO;
      letrasDisponibles[indice] = null;
      letrasIntento[indice] = null;
    }
  }

  // Segunda pasada: las que estan pero en otro lugar, sin contar dos veces
  for (let indice = 0; indice < largo; indice += 1) {
    if (!letrasIntento[indice]) {
      continue;
    }

    const posicionDisponible = letrasDisponibles.indexOf(letrasIntento[indice]);

    if (posicionDisponible !== -1) {
      colores[indice] = COLOR_PRESENTE;
      letrasDisponibles[posicionDisponible] = null;
    }
  }

  return colores;
}

/**
 * Deja una palabra en el formato del juego: mayusculas, sin tildes y sin nada
 * que no sea una letra. La Ñ se preserva.
 */
export function normalizarPalabraWordle(texto) {
  return String(texto || '')
    .trim()
    .replace(/[ñÑ]/g, '__enie__')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/__enie__/g, 'Ñ')
    .toUpperCase()
    .replace(/[^A-ZÑ]/g, '');
}

/** Recorta lo que se va tipeando, para compartirlo en vivo sin sorpresas. */
export function normalizarLetrasParciales(texto, largo) {
  return normalizarPalabraWordle(texto).slice(0, largo);
}

/** Un intento vale si tiene el largo justo y solo letras del abecedario. */
export function esIntentoValido(intento, largo) {
  return typeof intento === 'string'
    && intento.length === largo
    && /^[A-ZÑ]+$/.test(intento);
}

/**
 * Resume el estado de cada tecla del teclado a partir de los intentos hechos.
 * Gana el color mas fuerte: correcto por encima de presente, y presente por
 * encima de ausente.
 */
export function calcularEstadoTeclas(intentos) {
  const PESOS = { [COLOR_CORRECTO]: 3, [COLOR_PRESENTE]: 2, [COLOR_AUSENTE]: 1 };
  const teclas = {};

  intentos.forEach(({ palabra, colores }) => {
    palabra.split('').forEach((letra, indice) => {
      const color = colores[indice];

      if (!teclas[letra] || PESOS[color] > PESOS[teclas[letra]]) {
        teclas[letra] = color;
      }
    });
  });

  return teclas;
}
