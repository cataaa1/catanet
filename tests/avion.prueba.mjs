import { crearReporte, informar } from './ayudas/reportar.mjs';
import { urlDe } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

// Prueba del avioncito del menu con un DOM y unos temporizadores falsos
const enHead = [];
let hero = null;

function crearNodo(tag) {
  const clases = new Set();
  const nodo = {
    tag,
    id: '',
    className: '',
    src: '',
    alt: '',
    width: 0,
    height: 0,
    offsetWidth: 1,
    hijos: [],
    padre: null,
    clases,
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c)
    },
    appendChild(otro) {
      this.hijos.push(otro);
      otro.padre = this;
      return otro;
    },
    insertBefore(otro, referencia) {
      this.hijos.splice(referencia ? this.hijos.indexOf(referencia) : 0, 0, otro);
      otro.padre = this;
      return otro;
    },
    remove() {
      if (!this.padre) return;
      this.padre.hijos.splice(this.padre.hijos.indexOf(this), 1);
      this.padre = null;
    }
  };

  return nodo;
}

function montarHero() {
  hero = crearNodo('header');
  hero.appendChild(crearNodo('h1'));
}

montarHero();

globalThis.document = {
  hidden: false,
  createElement: crearNodo,
  getElementById: (id) => enHead.find((n) => n.id === id) || null,
  querySelector: (selector) => (selector === '.hero' ? hero : null),
  head: { appendChild: (n) => enHead.push(n) }
};
globalThis.matchMedia = () => ({ matches: false });

// Temporizadores a mano, para poder adelantar el reloj
let relojes = [];
let proximoReloj = 1;

globalThis.setTimeout = (fn, ms) => {
  relojes.push({ id: proximoReloj, fn, cuando: ms });
  return proximoReloj++;
};
globalThis.clearTimeout = (id) => {
  relojes = relojes.filter((reloj) => reloj.id !== id);
};

/** Dispara el temporizador pendiente y devuelve cuanto habia pedido esperar */
function adelantar() {
  const reloj = relojes.shift();

  if (!reloj) return null;

  reloj.fn();

  return reloj.cuando;
}

const { programarAvion } = await import(urlDe('frontend', 'shared', 'avion.js'));

// --- Se cuelga arriba del titulo ---
const bajar = programarAvion();

chequear('lo pone arriba de todo en el hero',
  hero.hijos.length === 2 && hero.hijos[0].className === 'avion-cielo',
  hero.hijos.map((h) => h.className || h.tag).join());
chequear('inyecta sus estilos', enHead.length === 1 && enHead[0].id === 'catanet-avion-estilos');

const cielo = hero.hijos[0];
const avion = cielo.hijos[0];
const dibujo = avion.hijos[0];

chequear('el avion cuelga de la franja', avion.className === 'avion');
chequear('usa el sprite del avion', dibujo.src === '/hub/assets/avion-catanet.png', dibujo.src);
chequear('el sprite tiene texto alternativo', dibujo.alt === 'CataNet', dibujo.alt);
// El pixel art se agranda por un numero entero, si no queda borroneado
chequear('lo agranda por un entero',
  dibujo.width % 93 === 0 && dibujo.height % 18 === 0 && dibujo.width / 93 === dibujo.height / 18,
  `${dibujo.width}x${dibujo.height}`);

// --- El primer vuelo y los siguientes ---
chequear('deja un vuelo programado', relojes.length === 1, `${relojes.length}`);
chequear('el primero no tarda una eternidad', relojes[0].cuando <= 10000, `${relojes[0].cuando}ms`);

adelantar();

chequear('al volar se le pone la clase de la animacion', avion.clases.has('avion--volando'));
chequear('vuelve a programarse solo', relojes.length === 1, `${relojes.length}`);

// El intervalo tiene que caer entre uno y dos minutos, sortee lo que sortee
const azarOriginal = Math.random;
const esperas = [];

[0, 0.5, 0.999].forEach((valor) => {
  Math.random = () => valor;
  esperas.push(adelantar());
});

Math.random = azarOriginal;

chequear('espera entre uno y dos minutos',
  esperas.every((ms) => ms >= 60000 && ms <= 120000), esperas.join());
chequear('no siempre espera lo mismo', new Set(esperas).size === 3, esperas.join());

// --- En una pestaña de fondo no gasta el vuelo ---
avion.classList.remove('avion--volando');
document.hidden = true;
adelantar();

chequear('en una pestaña de fondo no vuela', !avion.clases.has('avion--volando'));
chequear('pero sigue programando', relojes.length === 1, `${relojes.length}`);

document.hidden = false;

// --- Se puede bajar ---
bajar();

chequear('bajarlo lo saca del hero', hero.hijos.length === 1, `${hero.hijos.length}`);
chequear('bajarlo corta los vuelos', relojes.length === 0, `${relojes.length}`);

// --- Con menos movimiento se queda quieto ---
montarHero();
globalThis.matchMedia = () => ({ matches: true });
relojes = [];
programarAvion();

chequear('con menos movimiento igual se ve la marca',
  hero.hijos[0] && hero.hijos[0].className === 'avion-cielo');
chequear('con menos movimiento se queda quieto',
  hero.hijos[0].clases.has('avion-cielo--quieto'));
chequear('con menos movimiento no programa nada', relojes.length === 0, `${relojes.length}`);

// --- Sin hero no explota ---
hero = null;
chequear('sin hero devuelve algo llamable', typeof programarAvion() === 'function');
chequear('no duplica los estilos', enHead.length === 1, `${enHead.length}`);

informar(resultados);
