import { createRequire } from 'node:module';

import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

const {
  calcularColores,
  normalizarPalabraWordle,
  normalizarLetrasParciales,
  esIntentoValido,
  calcularEstadoTeclas
} = await import(urlDe('frontend', 'shared', 'wordle.js'));

const require = createRequire(ruta('backend', 'package.json'));
const palabras = require(ruta('backend', 'words.js'));

const C = 'correcto';
const P = 'presente';
const A = 'ausente';

// --- Colores: los casos faciles ---
chequear('todo correcto cuando se acierta',
  calcularColores('PERRO', 'PERRO').join() === [C, C, C, C, C].join());
chequear('todo ausente cuando no comparte ninguna letra',
  calcularColores('PERRO', 'CANTA').join() === [A, A, A, A, A].join(),
  calcularColores('PERRO', 'CANTA').join());

// --- Colores: letras repetidas, que es donde se rompen las implementaciones ---
// PERRO es P-E-R-R-O: la posicion 4 es una O, no una R. Asi que RADAR no tiene
// ninguna letra en su lugar, y sus dos R se pintan amarillas porque PERRO tiene
// justo dos R libres. Es el ejemplo que la documentacion tenia mal.
chequear('PERRO vs RADAR: sin verdes y las dos R en amarillo',
  calcularColores('PERRO', 'RADAR').join() === [P, A, A, A, P].join(),
  calcularColores('PERRO', 'RADAR').join());

// La palabra tiene UNA sola O: solo una O del intento se puede pintar
chequear('una sola O en la palabra pinta una sola O del intento',
  calcularColores('PERRO', 'OSOSO').join() === [A, A, A, A, C].join(),
  calcularColores('PERRO', 'OSOSO').join());

// Todas las letras del intento son iguales y la palabra tiene una sola
chequear('cinco letras iguales contra una sola en la palabra',
  calcularColores('CASAS', 'AAAAA').join() === [A, C, A, C, A].join(),
  calcularColores('CASAS', 'AAAAA').join());

// El verde tiene prioridad sobre el amarillo aunque aparezca despues
// ABETO tiene una sola O y queda verde en la posicion 4: la otra O del intento
// se queda sin nada que reclamar, aunque la letra "exista" en la palabra.
chequear('el verde se queda con la unica O y la otra queda gris',
  calcularColores('ABETO', 'OTERO').join() === [A, P, C, A, C].join(),
  calcularColores('ABETO', 'OTERO').join());

// Dos letras repetidas en la palabra y dos en el intento, ninguna en su lugar
chequear('dos repetidas en ambos lados sin coincidir de posicion',
  calcularColores('SALSA', 'ASILO').join() === [P, P, A, P, A].join(),
  calcularColores('SALSA', 'ASILO').join());

chequear('la Ñ se colorea como cualquier letra',
  calcularColores('CAÑON', 'ÑOCLA').join() === [P, P, P, A, P].join(),
  calcularColores('CAÑON', 'ÑOCLA').join());

// --- Propiedad general: nunca se pintan mas letras de las que hay ---
function contar(texto, letra) {
  return texto.split('').filter((l) => l === letra).length;
}

let excesos = 0;
const MUESTRA = palabras.respuestas ? palabras.respuestas.slice(0, 150) : [];

for (const secreta of MUESTRA) {
  for (const intento of MUESTRA.slice(0, 40)) {
    const colores = calcularColores(secreta, intento);

    for (const letra of new Set(intento.split(''))) {
      const pintadas = intento.split('')
        .filter((l, i) => l === letra && colores[i] !== A).length;

      if (pintadas > contar(secreta, letra)) excesos += 1;
    }
  }
}

chequear('nunca pinta mas veces una letra de las que tiene la palabra',
  excesos === 0, `${excesos} excesos en ${MUESTRA.length * 40} combinaciones`);

// --- Normalizacion ---
chequear('saca las tildes', normalizarPalabraWordle('camión') === 'CAMION');
chequear('preserva la Ñ', normalizarPalabraWordle('niño') === 'NIÑO');
chequear('saca espacios y signos', normalizarPalabraWordle(' pe-rro! ') === 'PERRO');
chequear('saca los numeros', normalizarPalabraWordle('ca5sa') === 'CASA');
chequear('aguanta null y undefined',
  normalizarPalabraWordle(null) === '' && normalizarPalabraWordle(undefined) === '');
chequear('el tipeo parcial se corta en el largo',
  normalizarLetrasParciales('PERROTE', 5) === 'PERRO');
chequear('el tipeo parcial tambien filtra basura',
  normalizarLetrasParciales('<img src=x>', 5) === 'IMGSR',
  normalizarLetrasParciales('<img src=x>', 5));

// --- Validacion de intentos ---
chequear('un intento de 5 letras vale', esIntentoValido('PERRO', 5));
chequear('uno corto no vale', !esIntentoValido('PERR', 5));
chequear('uno largo no vale', !esIntentoValido('PERROS', 5));
chequear('uno con numeros no vale', !esIntentoValido('PERR0', 5));
chequear('uno con etiquetas no vale', !esIntentoValido('<b>hi', 5));
chequear('uno vacio no vale', !esIntentoValido('', 5));

// --- Teclado ---
const teclas = calcularEstadoTeclas([
  { palabra: 'PERRO', colores: [A, P, A, A, C] },
  { palabra: 'PARED', colores: [C, A, A, P, A] }
]);
chequear('la tecla se queda con el color mas fuerte', teclas.P === C, teclas.P);
chequear('presente le gana a ausente', teclas.E === P, teclas.E);
chequear('ausente cuando nunca aparecio de otra forma', teclas.D === A, teclas.D);

// --- La lista de palabras ---
chequear('hay palabras para jugar', palabras.palabras.length > 100, `${palabras.palabras.length}`);
chequear('todas las respuestas tienen 5 letras',
  palabras.respuestas.every((palabra) => palabra.length === 5));
chequear('todas las respuestas son A-Z o Ñ en mayuscula',
  palabras.respuestas.every((palabra) => /^[A-ZÑ]{5}$/.test(palabra)));
chequear('no hay respuestas repetidas',
  new Set(palabras.respuestas).size === palabras.respuestas.length,
  `${palabras.respuestas.length - new Set(palabras.respuestas).size} repetidas`);
chequear('toda respuesta esta aceptada como intento',
  palabras.respuestas.every((palabra) => palabras.esPalabraAceptada(palabra)));
chequear('una palabra inventada no se acepta', !palabras.esPalabraAceptada('XKQZW'));
chequear('la palabra aleatoria sale de la lista de respuestas',
  Array.from({ length: 30 }, () => palabras.obtenerPalabraAleatoria())
    .every((palabra) => palabras.respuestas.includes(palabra)));

informar(resultados);
