import { readFileSync } from 'node:fs';

import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta } from './ayudas/rutas.mjs';
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

await cargarJuego('frontend/sudoku/individual/game.js');
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

// 11. El reloj corre desde que aparece el tablero y se frena al terminar
const reloj = () => document.getElementById('texto-reloj').textContent;

chequear('el reloj tiene formato mm:ss', /^\d\d:\d\d$/.test(reloj()), reloj());
chequear('el reloj avanza mientras se juega', reloj() !== '00:00', reloj());

// Gastamos las vidas que queden con numeros que no van
for (let i = 0; i < 81 && !document.getElementById('texto-errores').textContent.startsWith('3'); i += 1) {
  if (tableroLeido[i] !== '.' || solucionIndividual[i] === '1' || solucionIndividual[i] === '2') continue;
  clickCelda(Math.floor(i / 9), i % 9);
  teclear('2');
}

chequear('con tres errores se termina la partida',
  document.getElementById('texto-errores').textContent === '3 / 3',
  document.getElementById('texto-errores').textContent);

const alPerder = reloj();
await new Promise((r) => setTimeout(r, 1300));

chequear('al terminar la partida el reloj se frena', reloj() === alPerder, `${alPerder} -> ${reloj()}`);

// 12. Las celdas con notas no pueden ser mas altas que el resto. Es CSS, asi
// que se chequea la hoja: las notas van encimadas y las filas del tablero
// miden todas lo mismo, que es lo que hacia falta para que no se deformara.
const hoja = readFileSync(ruta('frontend', 'sudoku', 'individual', 'style.css'), 'utf8');
const reglaNotas = hoja.slice(hoja.indexOf('.celda__notas {'), hoja.indexOf('.celda__nota {'));
const reglaTablero = hoja.slice(hoja.indexOf('.tablero {'), hoja.indexOf('.tablero {') + 400);

chequear('las notas van encimadas a la celda',
  reglaNotas.includes('position: absolute') && reglaNotas.includes('inset: 0'));
chequear('las notas no ocupan alto propio',
  !reglaNotas.includes('height: 100%'), reglaNotas.trim());
chequear('las nueve filas del tablero miden lo mismo',
  reglaTablero.includes('grid-auto-rows: minmax(0, 1fr)'));

informar(resultados);
