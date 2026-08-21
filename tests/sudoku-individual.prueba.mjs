import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Cargamos la libreria vendor en el global, igual que el <script> del navegador
cargarLibreriaSudoku();

const listeners = new Map();

function crearElemento(id, dataset = {}) {
  const clases = new Set();
  return {
    id,
    dataset,
    textContent: '',
    innerHTML: '',
    hidden: false,
    atributos: {},
    clases,
    classList: {
      toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)),
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c)
    },
    setAttribute(k, v) { this.atributos[k] = v; },
    getAttribute(k) { return this.atributos[k]; },
    addEventListener(tipo, fn) { listeners.set(`${id}:${tipo}`, fn); },
    querySelector(sel) { return this.hijos ? this.hijos[sel] : null; },
    querySelectorAll(sel) { return this.listas && this.listas[sel] ? this.listas[sel] : []; }
  };
}

const cache = new Map();
globalThis.document = {
  getElementById: (id) => {
    if (!cache.has(id)) cache.set(id, crearElemento(id));
    return cache.get(id);
  },
  addEventListener(tipo, fn) { listeners.set(`document:${tipo}`, fn); }
};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// El numpad y las dificultades tienen hijos reales que el juego consulta
const teclas = Array.from({ length: 9 }, (_, i) => {
  const tecla = crearElemento(`tecla-${i + 1}`, { valor: String(i + 1) });
  tecla.hijos = { '.numpad__restantes': crearElemento(`restantes-${i + 1}`) };
  return tecla;
});
const numpad = document.getElementById('numpad');
numpad.listas = { '[data-valor]': teclas };

const chips = ['facil', 'medio', 'dificil'].map((d) => crearElemento(`chip-${d}`, { dificultad: d }));
document.getElementById('grupo-dificultades').listas = { '[data-dificultad]': chips };

await import('file:///C:/Users/catal/AppData/Local/Temp/claude/c--Users-catal-Dropbox-repos-CataNet/49f0a653-5469-4835-a4d9-d8c2fc7fbb7f/scratchpad/game-test.mjs');
await new Promise((r) => setTimeout(r, 4000));

const tablero = document.getElementById('tablero');
const teclear = (key, extra = {}) => listeners.get('document:keydown')({ key, preventDefault() {}, ...extra });
const clickear = (id) => listeners.get(`${id}:click`)({ target: { closest: () => null }, preventDefault() {} });
const clickCelda = (fila, columna) => listeners.get('tablero:click')({
  target: { closest: () => ({ dataset: { fila: String(fila), columna: String(columna) } }) }
});

// Buscamos una celda editable real leyendo el HTML renderizado
const celdas = tablero.innerHTML.split('<button').slice(1);
const editables = celdas
  .map((html, indice) => ({ indice, editable: html.includes('celda--editable') }))
  .filter((c) => c.editable);
const objetivo = editables[0].indice;
const fila = Math.floor(objetivo / 9);
const columna = objetivo % 9;

const contarCeldas = () => (tablero.innerHTML.match(/data-fila=/g) || []).length;
const htmlDeCelda = (i) => tablero.innerHTML.split('<button').slice(1)[i];
const restantesDe = (d) => teclas[d - 1].hijos['.numpad__restantes'].textContent;


chequear('renderiza 81 celdas', contarCeldas() === 81, `${contarCeldas()}`);
chequear('los chips marcan la dificultad activa', chips[1].clases.has('is-active'));
chequear('el velo de generacion queda oculto', document.getElementById('velo-generando').hidden === true);

// 1. Escribir un numero
clickCelda(fila, columna);
teclear('5');
chequear('escribe un 5 en la celda seleccionada', htmlDeCelda(objetivo).includes('>5</button>'), htmlDeCelda(objetivo).trim().slice(-24));

// 2. Deshacer
teclear('z', { ctrlKey: true });
chequear('deshacer vacia la celda', htmlDeCelda(objetivo).includes('></button>'));

// 3. Modo borrador
clickear('boton-notas');
chequear('el badge de notas pasa a ON', document.getElementById('badge-notas').textContent === 'ON');
teclear('3');
teclear('7');
const conNotas = htmlDeCelda(objetivo);
chequear('las notas se dibujan en la celda', conNotas.includes('celda__notas') && conNotas.includes('>3</span>') && conNotas.includes('>7</span>'));

// 4. Escribir un valor real borra las notas
clickear('boton-notas');
teclear('4');
chequear('escribir un valor reemplaza las notas', htmlDeCelda(objetivo).includes('>4</button>'));

// 5. Borrar
clickear('boton-borrar');
chequear('borrar deja la celda vacia', htmlDeCelda(objetivo).includes('></button>'));

// 6. Pista
const pistasAntes = document.getElementById('badge-pistas').textContent;
clickear('boton-pista');
const pistasDespues = document.getElementById('badge-pistas').textContent;
chequear('la pista descuenta el contador', pistasAntes === '3' && pistasDespues === '2');
chequear('la celda revelada se marca como pista', tablero.innerHTML.includes('celda--pista'));

// 7. Deshacer la pista la devuelve
teclear('z', { ctrlKey: true });
chequear('deshacer devuelve la pista', document.getElementById('badge-pistas').textContent === '3');
chequear('deshacer saca la marca de pista', !tablero.innerHTML.includes('celda--pista'));

// 8. Ninguna tecla arranca apagada con el tablero recien generado
chequear('ninguna tecla arranca apagada', teclas.every((t) => !t.clases.has('numpad__tecla--completa')));

// 9. Un digito completo apaga la tecla.
// Ahora que hay tres vidas, no se puede escribir 1 en cualquier lado: hay que
// poner el 1 solo donde va, o la partida se pierde antes de llegar a nueve.
const tableroLeido = tablero.innerHTML.split('<button').slice(1).map((html) => {
  const valor = html.match(/>(\d?)<\/button>/);
  return valor && valor[1] ? valor[1] : '.';
}).join('');
const solucionIndividual = globalThis.sudoku.solve(tableroLeido);
// Las pruebas anteriores ya escribieron digitos al azar, asi que arrancamos de
// los errores que haya y comparamos contra eso
const erroresPrevios = document.getElementById('texto-errores').textContent;

let escritos = 0;
for (let i = 0; i < 81; i += 1) {
  if (tableroLeido[i] !== '.' || solucionIndividual[i] !== '1') continue;
  clickCelda(Math.floor(i / 9), i % 9);
  teclear('1');
  if (htmlDeCelda(i).includes('>1</button>')) escritos += 1;
}

chequear('se pueden colocar los 1 que faltaban', escritos > 0, `escritos=${escritos}`);
chequear('poner los 1 correctos no gasta vidas',
  document.getElementById('texto-errores').textContent === erroresPrevios,
  `${erroresPrevios} -> ${document.getElementById('texto-errores').textContent}`);
chequear('la tecla del 1 se apaga al llegar a nueve',
  teclas[0].clases.has('numpad__tecla--completa'), `escritos=${escritos}`);

// 10. Un numero equivocado gasta una vida y se marca
const equivocada = (() => {
  for (let i = 0; i < 81; i += 1) {
    if (tableroLeido[i] === '.' && solucionIndividual[i] !== '2') {
      return { i, f: Math.floor(i / 9), c: i % 9 };
    }
  }
  return null;
})();
const antesDelError = Number(document.getElementById('texto-errores').textContent.split(' / ')[0]);
clickCelda(equivocada.f, equivocada.c);
teclear('2');
chequear('un numero equivocado gasta una vida',
  Number(document.getElementById('texto-errores').textContent.split(' / ')[0]) === antesDelError + 1,
  `${antesDelError} -> ${document.getElementById('texto-errores').textContent}`);
chequear('la celda equivocada se marca en rojo',
  htmlDeCelda(equivocada.i).includes('celda--error'));

informar(resultados);
