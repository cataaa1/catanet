// DOM falso, lo justo para que un game.js corra en Node.
//
// No es un navegador: emula solo lo que los juegos usan de verdad. Cada detalle
// que hay aca aparecio porque una prueba fallaba por una diferencia con el
// navegador, asi que conviene no simplificarlo sin motivo:
//
// - `innerHTML = ''` tiene que vaciar los hijos, o los tableros viejos se
//   acumulan al cambiar de dificultad
// - `closest(selector)` tiene que reconocer los distintos data-* que usan los
//   juegos, no solo las celdas
// - los modales arrancan con `hidden = true`, como el atributo del HTML

export function crearDom(opciones = {}) {
  const listeners = new Map();
  const elementos = new Map();

  function crearNodo(id = '', dataset = {}) {
    const clases = new Set();
    const hijos = [];
    const propiedades = new Map();
    let html = '';

    const nodo = {
      id,
      dataset,
      hijos,
      clases,
      textContent: '',
      hidden: false,
      atributos: {},
      offsetWidth: 1,
      style: {
        setProperty: (clave, valor) => propiedades.set(clave, valor),
        getPropertyValue: (clave) => propiedades.get(clave),
        get gridTemplateColumns() { return propiedades.get('grid-template-columns'); },
        set gridTemplateColumns(valor) { propiedades.set('grid-template-columns', valor); }
      },
      get innerHTML() { return html; },
      set innerHTML(valor) {
        html = valor;
        if (valor === '') hijos.length = 0;
      },
      set className(valor) {
        clases.clear();
        String(valor).split(' ').filter(Boolean).forEach((clase) => clases.add(clase));
      },
      get className() { return [...clases].join(' '); },
      classList: {
        add: (clase) => clases.add(clase),
        remove: (clase) => clases.delete(clase),
        toggle: (clase, prender) => (prender ? clases.add(clase) : clases.delete(clase)),
        contains: (clase) => clases.has(clase)
      },
      setAttribute(clave, valor) { this.atributos[clave] = valor; },
      getAttribute(clave) { return this.atributos[clave]; },
      focus() {},
      remove() {},
      appendChild(otro) {
        if (otro.tag === 'fragmento') {
          otro.hijos.forEach((hijo) => hijos.push(hijo));
          return otro;
        }
        hijos.push(otro);
        return otro;
      },
      addEventListener(tipo, fn) { listeners.set(`${id || 'anonimo'}:${tipo}`, fn); },
      querySelector(selector) {
        return (this.hijosPorSelector && this.hijosPorSelector[selector]) || null;
      },
      querySelectorAll(selector) {
        return (this.listas && this.listas[selector]) || [];
      },
      closest(selector) {
        for (const clave of Object.keys(dataset)) {
          if (selector.includes(`data-${clave.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase())}`)) {
            return nodo;
          }
        }
        return null;
      }
    };

    return nodo;
  }

  const documento = {
    getElementById(id) {
      if (!elementos.has(id)) elementos.set(id, crearNodo(id));
      return elementos.get(id);
    },
    createElement: (tag) => Object.assign(crearNodo(), { tag }),
    createDocumentFragment: () => Object.assign(crearNodo(), { tag: 'fragmento' }),
    querySelector: () => null,
    addEventListener(tipo, fn) { listeners.set(`document:${tipo}`, fn); },
    head: { appendChild() {} },
    body: { appendChild() {} },
    // El Custom del Wordle ajusta el largo de la palabra con una variable CSS
    documentElement: crearNodo('html')
  };

  globalThis.document = documento;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.MutationObserver = class {
    constructor(fn) { this.fn = fn; }
    observe() {}
  };
  globalThis.innerWidth = opciones.ancho || 1400;
  globalThis.innerHeight = opciones.alto || 850;

  // En el HTML real los modales llevan el atributo hidden puesto
  ['panel-ayuda', 'panel-resultado', 'velo-generando'].forEach((id) => {
    documento.getElementById(id).hidden = true;
  });

  return {
    documento,
    crearNodo,
    porId: (id) => documento.getElementById(id),
    /** Dispara un listener registrado, ej disparar('boton-nueva', 'click') */
    disparar(id, tipo, evento = {}) {
      const fn = listeners.get(`${id}:${tipo}`);

      if (!fn) throw new Error(`No hay listener ${tipo} en ${id}`);

      return fn(evento);
    },
    teclear(key, extra = {}) {
      const fn = listeners.get('document:keydown');

      if (!fn) throw new Error('Nadie escucha el teclado');

      return fn({ key, preventDefault() {}, ...extra });
    },
    /** Simula el click sobre una celda del tablero */
    clickCelda(fila, columna, idTablero = 'tablero') {
      const falso = crearNodo('', { fila: String(fila), columna: String(columna) });

      return this.disparar(idTablero, 'click', { target: falso });
    },
    listeners
  };
}
