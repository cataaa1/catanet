import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Prueba del cierre del panel de resultado con un DOM falso
const enHead = [];
const observadores = [];
const listenersDoc = new Map();

function crearNodo(tag) {
  const clases = new Set();
  const hijos = [];
  const listeners = new Map();
  const nodo = {
    tag,
    id: '',
    className: '',
    title: '',
    type: '',
    textContent: '',
    innerHTML: '',
    atributos: {},
    hijos,
    clases,
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c)
    },
    setAttribute(k, v) { this.atributos[k] = v; },
    appendChild(n) { hijos.push(n); return n; },
    addEventListener(tipo, fn) {
      if (!listeners.has(tipo)) listeners.set(tipo, []);
      listeners.get(tipo).push(fn);
    },
    disparar(tipo, evento) { (listeners.get(tipo) || []).forEach((fn) => fn(evento)); },
    querySelector(sel) {
      if (sel === '.resultado') return this.tarjeta || null;
      const clase = sel.replace('.', '');
      return hijos.find((h) => h.className === clase) || null;
    }
  };
  return nodo;
}

const panel = crearNodo('section');
panel.id = 'panel-resultado';
const tarjeta = crearNodo('div');
tarjeta.className = 'resultado';
panel.tarjeta = tarjeta;

// `hidden` avisa a los observadores, como haria el navegador
let valorHidden = true;
Object.defineProperty(panel, 'hidden', {
  get: () => valorHidden,
  set: (v) => { valorHidden = v; observadores.forEach((cb) => cb()); }
});

globalThis.document = {
  getElementById: (id) => (id === 'panel-resultado' ? panel : enHead.find((n) => n.id === id) || null),
  createElement: crearNodo,
  head: { appendChild: (n) => enHead.push(n) },
  addEventListener(tipo, fn) {
    if (!listenersDoc.has(tipo)) listenersDoc.set(tipo, []);
    listenersDoc.get(tipo).push(fn);
  }
};
globalThis.MutationObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() { observadores.push(this.cb); }
};

const { habilitarCierreResultado } = await import(urlDe('frontend', 'shared', 'resultado.js'));

const teclearDoc = (key) => (listenersDoc.get('keydown') || []).forEach((fn) => fn({ key }));
const estaCerrado = () => panel.clases.has('resultado-cerrado');

habilitarCierreResultado();

const boton = tarjeta.hijos[0];
chequear('agrega la cruz dentro de la tarjeta', Boolean(boton) && boton.className === 'resultado__cerrar');
chequear('la cruz tiene etiqueta accesible', boton.atributos['aria-label'] === 'Cerrar y ver la partida');
chequear('inyecta los estilos', enHead.length === 1, `${enHead.length}`);

// Llamarla de nuevo no debe duplicar nada
habilitarCierreResultado();
chequear('no duplica la cruz', tarjeta.hijos.length === 1, `${tarjeta.hijos.length}`);
chequear('no duplica los estilos', enHead.length === 1, `${enHead.length}`);

// Se termina la partida
panel.hidden = false;
chequear('con la partida terminada el panel se ve', !panel.hidden && !estaCerrado());

// Cerrar con la cruz
boton.disparar('click', {});
chequear('la cruz cierra el panel', estaCerrado());

// Un re-render vuelve a poner hidden = false y NO debe reabrirlo
panel.hidden = false;
chequear('sigue cerrado despues de un re-render', estaCerrado());
panel.hidden = false;
chequear('sigue cerrado tras varios re-renders', estaCerrado());

// Partida nueva: el juego oculta el panel y el cierre se reinicia
panel.hidden = true;
chequear('la partida nueva reinicia el cierre', !estaCerrado());

// Escape
panel.hidden = false;
teclearDoc('Escape');
chequear('Escape cierra el panel', estaCerrado());
panel.hidden = true;
panel.hidden = false;

// Click en el fondo cierra, click en la tarjeta no
panel.disparar('click', { target: tarjeta });
chequear('un click dentro de la tarjeta no cierra', !estaCerrado());
panel.disparar('click', { target: panel });
chequear('un click en el fondo cierra', estaCerrado());

// Con el panel ya cerrado, Escape no debe hacer nada raro
teclearDoc('Escape');
chequear('Escape con el panel cerrado no rompe', estaCerrado());

// Si la ayuda esta abierta, Escape es para la ayuda y no para el resultado
const ayuda = crearNodo('section');
ayuda.id = 'panel-ayuda';
ayuda.hidden = false;
const buscarPorId = document.getElementById;
document.getElementById = (id) => (id === 'panel-ayuda' ? ayuda : buscarPorId(id));
panel.hidden = true;
panel.hidden = false;
teclearDoc('Escape');
chequear('con la ayuda abierta, Escape no cierra el resultado', !estaCerrado());
ayuda.hidden = true;
teclearDoc('Escape');
chequear('cerrada la ayuda, Escape ya cierra el resultado', estaCerrado());

informar(resultados);
