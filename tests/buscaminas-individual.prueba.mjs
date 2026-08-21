import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Juega partidas enteras del modo individual contra un DOM falso

const listeners = new Map();

function crearNodo(tag = 'div', id = '') {
  const clases = new Set();
  const propios = new Map();
  const hijos = [];
  let html = '';
  const nodo = {
    tag, id, dataset: {}, textContent: '', hidden: false, style: {
      setProperty(k, v) { propios.set(k, v); }, get gridTemplateColumns() { return propios.get('gtc'); },
      set gridTemplateColumns(v) { propios.set('gtc', v); }
    },
    atributos: {}, clases, hijos,
    // En el navegador, vaciar innerHTML borra los hijos: lo emulamos
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; if (v === '') hijos.length = 0; },
    classList: {
      toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)),
      add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c)
    },
    set className(v) { clases.clear(); String(v).split(' ').filter(Boolean).forEach((c) => clases.add(c)); },
    get className() { return [...clases].join(' '); },
    focus() {},
    setAttribute(k, v) { this.atributos[k] = v; },
    getAttribute(k) { return this.atributos[k]; },
    addEventListener(tipo, fn) { listeners.set(`${id || tag}:${tipo}`, fn); },
    appendChild(n) { hijos.push(n); return n; },
    querySelector: () => null,
    querySelectorAll(sel) { return this.listas && this.listas[sel] ? this.listas[sel] : []; },
    closest(sel) {
      if (sel.includes('data-fila') && this.dataset.fila !== undefined) return this;
      if (sel.includes('data-dificultad') && this.dataset.dificultad !== undefined) return this;
      return null;
    }
  };
  return nodo;
}

const cache = new Map();
globalThis.document = {
  getElementById: (id) => {
    if (!cache.has(id)) cache.set(id, crearNodo('div', id));
    return cache.get(id);
  },
  createElement: (tag) => crearNodo(tag),
  createDocumentFragment: () => { const f = crearNodo('fragment'); return f; },
  addEventListener(tipo, fn) { listeners.set(`document:${tipo}`, fn); },
  head: { appendChild() {} },
  body: { appendChild() {} },
  querySelector: () => null
};
globalThis.innerWidth = 1400;
globalThis.innerHeight = 850;
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.MutationObserver = class { observe() {} };
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);

const chips = ['facil', 'medio', 'dificil'].map((d) => {
  const n = crearNodo('button', `chip-${d}`); n.dataset.dificultad = d; return n;
});
document.getElementById('grupo-dificultades').listas = { '[data-dificultad]': chips };

// El tablero acumula sus botones para poder simular clicks reales
document.getElementById('panel-ayuda').hidden = true;
document.getElementById('panel-resultado').hidden = true;

const tablero = document.getElementById('tablero');
tablero.appendChild = function (n) {
  if (n.tag === 'fragment') { n.hijos.forEach((h) => this.hijos.push(h)); return n; }
  this.hijos.push(n); return n;
};

const { festejos } = await import(urlDe('tests', 'ayudas', 'stubs.mjs'));
const { espia } = await import(urlDe('tests', 'ayudas', 'motor-espia.mjs'));
await cargarJuego('frontend/buscaminas/individual/game.js', {
  // El espia deja ver donde estan las minas, para poder ganar y perder a proposito
  reemplazos: { "'/shared/buscaminas.js'": `'${urlDe('tests', 'ayudas', 'motor-espia.mjs')}'` }
});


const clickDerecho = (f, c) => listeners.get('tablero:contextmenu')({
  target: celdaDom(f, c), preventDefault() {}
});
const celdaDom = (f, c) => tablero.hijos.find((h) => h.dataset.fila === String(f) && h.dataset.columna === String(c));
function clickIzquierdo(f, c) {
  const target = celdaDom(f, c);
  listeners.get('tablero:pointerdown')({ target, button: 0 });
  listeners.get('tablero:pointerup')({ target, button: 0 });
}

const panel = document.getElementById('panel-resultado');

// --- Arranque ---
chequear('construye 81 celdas en facil', tablero.hijos.length === 81, `${tablero.hijos.length}`);
chequear('el contador arranca en 10 minas', document.getElementById('texto-minas').textContent === '10');
chequear('el reloj arranca en 00:00', document.getElementById('texto-reloj').textContent === '00:00');
chequear('el chip facil queda activo', chips[0].clases.has('is-active'));
chequear('todas las celdas arrancan tapadas',
  tablero.hijos.every((h) => !h.clases.has('celda--abierta')));

// --- Primer click: nunca explota y abre area ---
clickIzquierdo(4, 4);
const abiertas = tablero.hijos.filter((h) => h.clases.has('celda--abierta')).length;
chequear('el primer click abre varias celdas', abiertas > 1, `${abiertas}`);
chequear('el primer click no termina la partida', panel.hidden === true);

// --- Bandera con click derecho ---
const tapada = tablero.hijos.find((h) => !h.clases.has('celda--abierta'));
clickDerecho(Number(tapada.dataset.fila), Number(tapada.dataset.columna));
chequear('el click derecho dibuja la bandera', tapada.innerHTML.includes('bandera.png'));
chequear('la bandera descuenta del contador', document.getElementById('texto-minas').textContent === '9');
clickIzquierdo(Number(tapada.dataset.fila), Number(tapada.dataset.columna));
chequear('no se descubre una celda con bandera', !tapada.clases.has('celda--abierta'));
clickDerecho(Number(tapada.dataset.fila), Number(tapada.dataset.columna));
chequear('sacar la bandera devuelve el contador', document.getElementById('texto-minas').textContent === '10');

// --- Modo bandera ---
const botonModo = document.getElementById('boton-modo-bandera');
listeners.get('boton-modo-bandera:click')({});
chequear('el modo bandera se activa', botonModo.clases.has('is-activa')
  && document.getElementById('estado-modo-bandera').textContent === 'ON');
const otraTapada = tablero.hijos.find((h) => !h.clases.has('celda--abierta') && !h.innerHTML);
clickIzquierdo(Number(otraTapada.dataset.fila), Number(otraTapada.dataset.columna));
chequear('con modo bandera el click izquierdo marca', otraTapada.innerHTML.includes('bandera.png'));
listeners.get('boton-modo-bandera:click')({});
chequear('el modo bandera se apaga', !botonModo.clases.has('is-activa'));
clickIzquierdo(Number(otraTapada.dataset.fila), Number(otraTapada.dataset.columna));
chequear('apagado el modo, la bandera sigue protegiendo', !otraTapada.clases.has('celda--abierta'));

// --- Cambiar dificultad reconstruye ---
listeners.get('grupo-dificultades:click')({ target: chips[2] });
chequear('dificil construye 480 celdas', tablero.hijos.length === 480, `${tablero.hijos.length}`);
chequear('el contador pasa a 99 minas', document.getElementById('texto-minas').textContent === '99');
chequear('el chip dificil queda activo', chips[2].clases.has('is-active') && !chips[0].clases.has('is-active'));
chequear('el tablero dificil tiene 30 columnas', tablero.style.gridTemplateColumns.includes('repeat(30'),
  tablero.style.gridTemplateColumns);

// --- Partida ganada de verdad: con el espia sabemos donde NO hay minas ---
listeners.get('grupo-dificultades:click')({ target: chips[0] });
clickIzquierdo(4, 4);
const sinMina = [];
for (let f = 0; f < 9; f += 1) {
  for (let c = 0; c < 9; c += 1) {
    if (!espia.ultima.tablero[f][c].mina) sinMina.push([f, c]);
  }
}
sinMina.forEach(([f, c]) => clickIzquierdo(f, c));

chequear('se gana despejando todas las celdas sin mina',
  document.getElementById('resultado-titulo').textContent === 'Ganaste',
  document.getElementById('resultado-titulo').textContent);
chequear('el panel de victoria se abre', panel.hidden === false);
chequear('el festejo se disparo una sola vez al ganar', festejos.total === 1, `${festejos.total}`);
chequear('quedaron abiertas las 71 celdas sin mina',
  tablero.hijos.filter((h) => h.clases.has('celda--abierta')).length === 71,
  `${tablero.hijos.filter((h) => h.clases.has('celda--abierta')).length}`);
chequear('el texto de victoria menciona el tiempo',
  document.getElementById('resultado-texto').textContent.includes('00:'));

// --- Partida perdida: pisamos una mina a proposito ---
listeners.get('boton-nueva:click')({});
chequear('el tablero nuevo cierra el panel', panel.hidden === true);
chequear('el tablero nuevo reinicia el contador', document.getElementById('texto-minas').textContent === '10');
clickIzquierdo(4, 4);
const minas = [];
for (let f = 0; f < 9; f += 1) {
  for (let c = 0; c < 9; c += 1) {
    if (espia.ultima.tablero[f][c].mina) minas.push([f, c]);
  }
}
chequear('el tablero nuevo tiene 10 minas', minas.length === 10, `${minas.length}`);
clickIzquierdo(minas[0][0], minas[0][1]);
chequear('pisar una mina termina la partida',
  document.getElementById('resultado-titulo').textContent === 'Pisaste una mina',
  document.getElementById('resultado-titulo').textContent);
chequear('al perder se dibujan todas las minas',
  tablero.hijos.filter((h) => h.innerHTML.includes('mina.png')).length === 10,
  `${tablero.hijos.filter((h) => h.innerHTML.includes('mina.png')).length}`);
chequear('la mina pisada queda resaltada',
  celdaDom(minas[0][0], minas[0][1]).clases.has('celda--explotada'));
chequear('al perder no se festeja', festejos.total === 1, `${festejos.total}`);
chequear('despues de perder el tablero no responde', (() => {
  const antes = tablero.hijos.filter((h) => h.clases.has('celda--abierta')).length;
  const libre = tablero.hijos.find((h) => !h.clases.has('celda--abierta'));
  if (libre) clickIzquierdo(Number(libre.dataset.fila), Number(libre.dataset.columna));
  return tablero.hijos.filter((h) => h.clases.has('celda--abierta')).length === antes;
})());

// --- Panel de ayuda ---
const panelAyuda = document.getElementById('panel-ayuda');
chequear('la ayuda arranca cerrada', panelAyuda.hidden === true);
listeners.get('boton-ayuda:click')({});
chequear('el boton ? abre la ayuda', panelAyuda.hidden === false);
listeners.get('document:keydown')({ key: 'Escape' });
chequear('Escape cierra la ayuda', panelAyuda.hidden === true);
listeners.get('boton-ayuda:click')({});
listeners.get('boton-cerrar-ayuda:click')({});
chequear('la cruz cierra la ayuda', panelAyuda.hidden === true);
listeners.get('boton-ayuda:click')({});
listeners.get('panel-ayuda:click')({ target: document.getElementById('panel-ayuda') });
chequear('el click en el fondo cierra la ayuda', panelAyuda.hidden === true);

// Con la ayuda abierta, la tecla B no debe cambiar el modo bandera
listeners.get('boton-ayuda:click')({});
const modoAntes = document.getElementById('estado-modo-bandera').textContent;
listeners.get('document:keydown')({ key: 'b' });
chequear('con la ayuda abierta la tecla B no hace nada',
  document.getElementById('estado-modo-bandera').textContent === modoAntes);
listeners.get('boton-cerrar-ayuda:click')({});
listeners.get('boton-nueva:click')({});
listeners.get('document:keydown')({ key: 'b' });
chequear('cerrada la ayuda y con partida en curso, la tecla B alterna el modo',
  document.getElementById('estado-modo-bandera').textContent === 'ON');
listeners.get('document:keydown')({ key: 'b' });
chequear('la tecla B tambien apaga el modo',
  document.getElementById('estado-modo-bandera').textContent === 'OFF');

// --- Al perder tienen que verse TODAS las minas, marcadas o no ---
listeners.get('boton-nueva:click')({});
clickIzquierdo(4, 4);
const todasLasMinas = [];
for (let f = 0; f < 9; f += 1) {
  for (let c = 0; c < 9; c += 1) {
    if (espia.ultima.tablero[f][c].mina) todasLasMinas.push([f, c]);
  }
}
// Marcamos bien dos minas y ponemos una bandera equivocada
clickDerecho(todasLasMinas[0][0], todasLasMinas[0][1]);
clickDerecho(todasLasMinas[1][0], todasLasMinas[1][1]);
const sinMinaTapada = [];
for (let f = 0; f < 9; f += 1) {
  for (let c = 0; c < 9; c += 1) {
    const celda = espia.ultima.tablero[f][c];
    if (!celda.mina && !celda.revelada) sinMinaTapada.push([f, c]);
  }
}
clickDerecho(sinMinaTapada[0][0], sinMinaTapada[0][1]);

// Pisamos una mina distinta de las marcadas
clickIzquierdo(todasLasMinas[9][0], todasLasMinas[9][1]);

chequear('perdiste con banderas puestas',
  document.getElementById('resultado-titulo').textContent === 'Pisaste una mina');
chequear('se ven las 10 minas, incluidas las que tenian bandera',
  tablero.hijos.filter((h) => h.innerHTML.includes('mina.png')).length === 10,
  `${tablero.hijos.filter((h) => h.innerHTML.includes('mina.png')).length}`);
chequear('la mina marcada muestra la mina y no la bandera',
  celdaDom(todasLasMinas[0][0], todasLasMinas[0][1]).innerHTML.includes('mina.png'));
chequear('la mina marcada se distingue con su propio estilo',
  celdaDom(todasLasMinas[0][0], todasLasMinas[0][1]).clases.has('celda--mina-marcada'));
chequear('solo la mina pisada queda en rojo',
  tablero.hijos.filter((h) => h.clases.has('celda--explotada')).length === 1,
  `${tablero.hijos.filter((h) => h.clases.has('celda--explotada')).length}`);
chequear('la que quedo en rojo es la que pisaste',
  celdaDom(todasLasMinas[9][0], todasLasMinas[9][1]).clases.has('celda--explotada'));
chequear('la bandera equivocada queda marcada como tal',
  celdaDom(sinMinaTapada[0][0], sinMinaTapada[0][1]).clases.has('celda--mal-marcada'));
chequear('la bandera equivocada sigue mostrando la bandera',
  celdaDom(sinMinaTapada[0][0], sinMinaTapada[0][1]).innerHTML.includes('bandera.png'));

informar(resultados);
