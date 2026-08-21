import { crearReporte, informar } from './ayudas/reportar.mjs';
import { crearDom } from './ayudas/dom.mjs';
import { cargarJuego } from './ayudas/juego.mjs';
import { urlDe } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

// El Custom toma la palabra de la URL, asi que hay que darle una antes de cargar
const PALABRA = 'PERRO';
const codificada = Buffer.from(PALABRA, 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const dom = crearDom();

globalThis.location = { search: `?w=${codificada}`, pathname: '/wordle/custom/', href: '' };
globalThis.window = { location: globalThis.location };
globalThis.URLSearchParams = URLSearchParams;
globalThis.btoa = (texto) => Buffer.from(texto, 'binary').toString('base64');
globalThis.atob = (texto) => Buffer.from(texto, 'base64').toString('binary');
globalThis.unescape = (texto) => texto;
globalThis.escape = (texto) => texto;
// En Node moderno navigator ya existe y no se puede reasignar
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true
});

dom.porId('teclado').listas = { '.tecla': [] };
dom.porId('formulario-palabra').addEventListener = () => {};

const { festejos } = await import(urlDe('tests', 'ayudas', 'stubs.mjs'));

await cargarJuego('frontend/wordle/custom/game.js');

const tablero = dom.porId('tablero');

function letrasDeFila(indice) {
  const fila = tablero.hijos[indice];

  if (!fila || !fila.hijos[0]) return [];

  return fila.hijos[0].hijos.map((celda) => celda.textContent);
}

function coloresDeFila(indice) {
  const fila = tablero.hijos[indice];

  if (!fila || !fila.hijos[0]) return [];

  return fila.hijos[0].hijos.map((celda) => {
    const clase = [...celda.clases].find((c) => c.startsWith('celda--') && c !== 'celda--pendiente');
    return clase ? clase.replace('celda--', '') : '';
  });
}

const escribir = (palabra) => palabra.split('').forEach((letra) => dom.teclear(letra));

// --- El link abre directo la partida ---
chequear('con palabra en el link arranca jugando',
  dom.porId('panel-juego').hidden === false, `panel-juego hidden=${dom.porId('panel-juego').hidden}`);
chequear('no muestra la pantalla de crear',
  dom.porId('panel-creador').hidden === true);
chequear('el tablero se dibuja', tablero.hijos.length > 0, `${tablero.hijos.length} filas`);
chequear('las filas tienen el largo de la palabra del link',
  letrasDeFila(0).length === PALABRA.length, `${letrasDeFila(0).length}`);

// --- Los colores usan la palabra del link ---
escribir('RADAR');
dom.teclear('Enter');

chequear('el intento entra en el tablero',
  letrasDeFila(0).join('') === 'RADAR', letrasDeFila(0).join(''));
// PERRO vs RADAR: ninguna letra en su lugar, y las dos R en amarillo
chequear('los colores salen de la palabra del link',
  coloresDeFila(0).join() === ['presente', 'ausente', 'ausente', 'ausente', 'presente'].join(),
  coloresDeFila(0).join());

// --- Ganar con la palabra del link ---
escribir(PALABRA);
dom.teclear('Enter');

chequear('acertar la palabra del link gana',
  dom.porId('panel-resultado').hidden === false);
chequear('el titulo dice que ganaste',
  dom.porId('resultado-titulo').textContent === 'Ganaste',
  dom.porId('resultado-titulo').textContent);
chequear('ganar dispara el festejo', festejos.total === 1, `${festejos.total}`);

informar(resultados);
