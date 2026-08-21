import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Prueba del modulo de festejo con un canvas y un DOM falsos
const creados = [];
const enBody = [];
const enHead = [];
let reglasDibujadas = 0;

function crearNodo(tag) {
  const clases = new Set();
  const nodo = {
    tag,
    id: '',
    className: '',
    textContent: '',
    width: 0,
    height: 0,
    offsetWidth: 1,
    atributos: {},
    clases,
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c)
    },
    setAttribute(k, v) { this.atributos[k] = v; },
    remove() {
      const i = enBody.indexOf(this);
      if (i >= 0) enBody.splice(i, 1);
    },
    getContext() {
      return {
        setTransform() {}, clearRect() {}, save() {}, restore() {},
        translate() {}, rotate() {}, fillRect() { reglasDibujadas += 1; },
        globalAlpha: 1, fillStyle: ''
      };
    }
  };
  creados.push(nodo);
  return nodo;
}

const panel = crearNodo('div');

globalThis.document = {
  createElement: crearNodo,
  getElementById: (id) => enHead.find((n) => n.id === id) || null,
  querySelector: () => panel,
  head: { appendChild: (n) => enHead.push(n) },
  body: { appendChild: (n) => enBody.push(n) }
};
globalThis.innerWidth = 1200;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 2;
globalThis.matchMedia = () => ({ matches: false });
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.performance = { now: () => reloj };

let reloj = 0;
let pendiente = null;
globalThis.requestAnimationFrame = (cb) => { pendiente = cb; return 1; };
globalThis.cancelAnimationFrame = () => { pendiente = null; };

const { festejar, cortarFestejo } = await import(urlDe('frontend', 'shared', 'celebracion.js'));


festejar();

chequear('agrega un canvas al body', enBody.length === 1 && enBody[0].tag === 'canvas', `${enBody.length}`);
chequear('inyecta los estilos una sola vez', enHead.length === 1, `${enHead.length}`);
chequear('el canvas usa la densidad de pantalla', enBody[0].width === 2400 && enBody[0].height === 1600, `${enBody[0].width}x${enBody[0].height}`);
chequear('el canvas no intercepta clicks', enBody[0].className === 'festejo-capa');
chequear('el panel recibe la animacion', panel.clases.has('festejo-pulso'));

// Corremos la animacion hasta que se limpie sola
let cuadros = 0;
while (pendiente && cuadros < 800) {
  reloj += 16;
  const cb = pendiente;
  pendiente = null;
  cb(reloj);
  cuadros += 1;
}

chequear('dibujo papelitos', reglasDibujadas > 1000, `fillRect=${reglasDibujadas}`);
chequear('la animacion termina sola', pendiente === null, `cuadros=${cuadros}`);
chequear('saca el canvas al terminar', enBody.length === 0, `${enBody.length}`);
chequear('no se pasa de la duracion maxima', reloj <= 4300, `${reloj}ms`);

// Un segundo festejo tiene que volver a funcionar
festejar();
chequear('el segundo festejo vuelve a crear el canvas', enBody.length === 1);
chequear('no duplica los estilos', enHead.length === 1, `${enHead.length}`);
cortarFestejo();
chequear('cortarFestejo limpia todo', enBody.length === 0);

// Con movimiento reducido no debe dibujar nada
globalThis.matchMedia = () => ({ matches: true });
festejar();
chequear('respeta prefers-reduced-motion', enBody.length === 0);

informar(resultados);
