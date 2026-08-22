import { crearReporte, informar } from './ayudas/reportar.mjs';
import { urlDe } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

// Prueba del avioncito del menu con un DOM y unos temporizadores falsos
const enHead = [];
let hero = null;
let acento = null;

function crearNodo(tag) {
  const clases = new Set();
  const nodo = {
    tag,
    id: '',
    className: '',
    offsetWidth: 1,
    hijos: [],
    padre: null,
    atributos: {},
    escuchas: {},
    clases,
    classList: {
      add: (c) => clases.add(c),
      remove: (c) => clases.delete(c),
      contains: (c) => clases.has(c)
    },
    setAttribute(clave, valor) { this.atributos[clave] = valor; },
    addEventListener(tipo, fn) { (this.escuchas[tipo] = this.escuchas[tipo] || []).push(fn); },
    removeEventListener(tipo, fn) {
      this.escuchas[tipo] = (this.escuchas[tipo] || []).filter((otra) => otra !== fn);
    },
    /** Dispara los listeners de ese tipo, como haria el navegador */
    disparar(tipo, evento = {}) {
      (this.escuchas[tipo] || []).forEach((fn) => fn({ preventDefault() {}, ...evento }));
    },
    querySelector(selector) {
      return selector === '.accent' ? acento : null;
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
  acento = crearNodo('span');
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

// Temporizadores a mano, con un reloj virtual: se dispara siempre el que
// vencia antes, como haria el navegador
let ahora = 0;
let relojes = [];
let proximoReloj = 1;

globalThis.setTimeout = (fn, ms) => {
  relojes.push({ id: proximoReloj, fn, pedido: ms, vence: ahora + ms });
  return proximoReloj++;
};
globalThis.clearTimeout = (id) => {
  relojes = relojes.filter((reloj) => reloj.id !== id);
};

/** Dispara el proximo temporizador y devuelve cuanto habia pedido esperar */
function adelantar() {
  relojes.sort((a, b) => a.vence - b.vence);

  const reloj = relojes.shift();

  if (!reloj) return null;

  ahora = reloj.vence;
  reloj.fn();

  return reloj.pedido;
}

/** Adelanta el reloj virtual lo que se le pida, disparando lo que venza */
function correr(ms) {
  const hasta = ahora + ms;

  relojes.sort((a, b) => a.vence - b.vence);

  while (relojes.length && relojes[0].vence <= hasta) {
    adelantar();
    relojes.sort((a, b) => a.vence - b.vence);
  }

  ahora = hasta;
}

/**
 * Arma un avion nuevo con el azar fijado, lo hace volar una vez y devuelve
 * cuanto pidio esperar para el siguiente. Lo del avion nuevo cada vez es para
 * que un chequeo no herede los temporizadores del anterior.
 */
function esperaConAzar(valor) {
  montarHero();
  relojes = [];
  Math.random = () => valor;

  const bajarlo = programarAvion();

  adelantar();                                       // el primer vuelo

  // El otro temporizador que queda es el que marca cuando termina de cruzar
  const proximo = relojes.find((reloj) => reloj.pedido > DURACION);

  bajarlo();

  return proximo && proximo.pedido;
}

const DURACION = 20000;

const { programarAvion } = await import(urlDe('frontend', 'shared', 'avion.js'));

// --- Se cuelga arriba del titulo ---
programarAvion();

chequear('lo pone arriba de todo en el hero',
  hero.hijos.length === 2 && hero.hijos[0].className === 'avion-cielo',
  hero.hijos.map((h) => h.className || h.tag).join());
chequear('inyecta sus estilos', enHead.length === 1 && enHead[0].id === 'catanet-avion-estilos');

const cielo = hero.hijos[0];
const avion = cielo.hijos[0];
const cuerpo = avion.hijos[0];
const dibujo = cuerpo.hijos[cuerpo.hijos.length - 1];
const estilos = enHead[0].textContent;

chequear('el avion cuelga de la franja', avion.className === 'avion');
chequear('el dibujo se anuncia como imagen',
  dibujo.className === 'avion__dibujo' && dibujo.atributos['aria-label'] === 'CataNet',
  JSON.stringify(dibujo.atributos));
chequear('deja humo detras del avion',
  cuerpo.hijos.filter((h) => h.className === 'avion__humo').length === 5,
  `${cuerpo.hijos.length} hijos`);
chequear('el humo va por detras del dibujo',
  cuerpo.hijos.indexOf(dibujo) === cuerpo.hijos.length - 1);

// --- El sprite y sus animaciones ---
chequear('usa el sprite del avion', estilos.includes('/hub/assets/avion-catanet.png'));
// El sprite trae los tres cuadros apilados y el fondo se corre en porcentaje,
// asi anda igual a 3x que a 2x
chequear('la helice recorre los tres cuadros',
  estilos.includes('background-size: 100% 300%')
  && estilos.includes('steps(3)')
  && estilos.includes('background-position-y: 150%'));
chequear('el avion viborea en vez de ir derecho',
  estilos.includes('avion-viborea') && estilos.includes('--avion-onda'));

// --- El primer vuelo y los siguientes ---
chequear('deja un vuelo programado', relojes.length === 1, `${relojes.length}`);
chequear('el primero no tarda una eternidad', relojes[0].pedido <= 10000, `${relojes[0].pedido}ms`);

adelantar();

chequear('al volar se le pone la clase de la animacion', avion.clases.has('avion--volando'));

// El intervalo tiene que caer entre 30 y 60 segundos, sortee lo que sortee
const azarOriginal = Math.random;
const esperas = [0, 0.5, 0.999].map(esperaConAzar);

Math.random = azarOriginal;

chequear('espera entre 30 y 60 segundos',
  esperas.every((ms) => ms >= 30000 && ms <= 60000), esperas.join());
chequear('no siempre espera lo mismo', new Set(esperas).size === 3, esperas.join());

// --- Tocando el titulo aparece, pero no se puede spamear ---
montarHero();
relojes = [];

const bajar = programarAvion();
const suAvion = hero.hijos[0].hijos[0];

chequear('la palabra del titulo queda como boton',
  acento.clases.has('avion-llamador')
  && acento.atributos.role === 'button'
  && acento.atributos.tabindex === '0',
  JSON.stringify(acento.atributos));

acento.disparar('click');

chequear('tocar la palabra del titulo lo hace pasar', suAvion.clases.has('avion--volando'));

// Mientras cruza, insistir no tiene que relanzarlo
suAvion.classList.remove('avion--volando');
acento.disparar('click');
acento.disparar('click');
acento.disparar('click');

chequear('mientras cruza, insistir no lo vuelve a lanzar',
  !suAvion.clases.has('avion--volando'));

correr(DURACION);
suAvion.classList.remove('avion--volando');
acento.disparar('keydown', { key: 'Enter' });

chequear('cuando termino de cruzar vuelve a salir', suAvion.clases.has('avion--volando'));

// --- En una pestaña de fondo no gasta el vuelo ---
correr(DURACION);
suAvion.classList.remove('avion--volando');
document.hidden = true;
acento.disparar('click');

chequear('en una pestaña de fondo no vuela', !suAvion.clases.has('avion--volando'));
chequear('pero sigue programando',
  relojes.some((reloj) => reloj.pedido >= 30000), `${relojes.length}`);

document.hidden = false;

// --- Se puede bajar ---
bajar();

chequear('bajarlo lo saca del hero', hero.hijos.length === 1, `${hero.hijos.length}`);
chequear('bajarlo corta los vuelos', relojes.length === 0, `${relojes.length}`);
chequear('bajarlo deja la palabra del titulo como estaba',
  !acento.clases.has('avion-llamador') && !acento.escuchas.click.length);

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
