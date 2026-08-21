import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta, urlDe } from './ayudas/rutas.mjs';
import { cargarJuego, cargarLibreriaSudoku } from './ayudas/juego.mjs';

const { chequear, resultados } = crearReporte();

// Vidas, marcado de errores y guardado del progreso en el Sudoku diario


cargarLibreriaSudoku();

// localStorage falso: en el navegador las claves guardadas son propiedades
// propias enumerables del objeto, y el juego usa Object.keys() para limpiarlas.
const almacen = {};
Object.defineProperties(almacen, {
  getItem: { value: (clave) => (clave in almacen ? almacen[clave] : null) },
  setItem: { value: (clave, valor) => { almacen[clave] = String(valor); } },
  removeItem: { value: (clave) => { delete almacen[clave]; } }
});
globalThis.localStorage = almacen;

const motor = await import(urlDe('frontend', 'shared', 'sudoku.js'));
const partida = motor.crearPartidaSudoku('facil', { semilla: 909090 });
const solucion = motor.stringATablero(partida.solucion);
const inicial = motor.stringATablero(partida.puzzle);


// Cada "carga" monta un DOM nuevo y vuelve a importar el juego
let contador = 0;

async function montarPagina() {
  contador += 1;

  const listeners = new Map();
  const cache = new Map();

  function crearNodo(id = '') {
    const clases = new Set();
    let html = '';
    return {
      id, dataset: {}, textContent: '', hidden: false, atributos: {}, clases,
      get innerHTML() { return html; },
      set innerHTML(v) { html = v; },
      classList: {
        toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)),
        add: (c) => clases.add(c), remove: (c) => clases.delete(c), contains: (c) => clases.has(c)
      },
      setAttribute(k, v) { this.atributos[k] = v; },
      addEventListener(tipo, fn) { listeners.set(`${id}:${tipo}`, fn); },
      querySelectorAll() { return []; },
      closest(sel) {
        if (sel.includes('data-valor') && this.dataset.valor !== undefined) return this;
        if (sel.includes('data-fila') && this.dataset.fila !== undefined) return this;
        return null;
      }
    };
  }

  globalThis.document = {
    getElementById: (id) => { if (!cache.has(id)) cache.set(id, crearNodo(id)); return cache.get(id); },
    addEventListener(tipo, fn) { listeners.set(`document:${tipo}`, fn); }
  };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.addEventListener = () => {};
  globalThis.MutationObserver = class { observe() {} };
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.fetch = async () => ({
    json: async () => ({
      listo: true, fecha: '2026-08-20', dificultad: 'facil',
      puzzle: partida.puzzle, solucion: partida.solucion
    })
  });

  document.getElementById('panel-ayuda').hidden = true;
  document.getElementById('panel-resultado').hidden = true;
  // En el HTML el boton ya viene con el OFF escrito
  document.getElementById('estado-lapiz').textContent = 'OFF';

  // El sufijo obliga a Node a reimportar el modulo, como si recargaras la pagina
  await cargarJuego('frontend/sudoku/diario/game.js');
  await new Promise((r) => setTimeout(r, 200));

  const tablero = document.getElementById('tablero');

  return {
    doc: document,
    tablero,
    teclear: (key) => listeners.get('document:keydown')({ key, preventDefault() {} }),
    click: (id) => listeners.get(`${id}:click`)({}),
    celda: (f, c) => tablero.innerHTML.split('<button').slice(1)[f * 9 + c],
    clickCelda: (f, c) => {
      const falsa = crearNodo();
      falsa.dataset.fila = String(f);
      falsa.dataset.columna = String(c);
      listeners.get('tablero:click')({ target: falsa });
    }
  };
}

// Celdas editables y un valor equivocado para cada una
const editables = [];
for (let f = 0; f < 9; f += 1) {
  for (let c = 0; c < 9; c += 1) {
    if (!inicial[f][c]) {
      const correcto = solucion[f][c];
      const malo = String(((Number(correcto) % 9) + 1));
      editables.push({ f, c, correcto, malo: malo === correcto ? String((Number(correcto) % 9) + 2) : malo });
    }
  }
}

// ---------------- Primera carga ----------------
let juego = await montarPagina();

chequear('el contador de errores arranca en 0 / 3',
  juego.doc.getElementById('texto-errores').textContent === '0 / 3',
  juego.doc.getElementById('texto-errores').textContent);
chequear('el boton dice Lapiz y arranca apagado',
  juego.doc.getElementById('estado-lapiz').textContent === 'OFF');

// Un numero equivocado
const uno = editables[0];
juego.clickCelda(uno.f, uno.c);
juego.teclear(uno.malo);
chequear('un numero equivocado suma un error',
  juego.doc.getElementById('texto-errores').textContent === '1 / 3',
  juego.doc.getElementById('texto-errores').textContent);
chequear('la celda equivocada se marca', juego.celda(uno.f, uno.c).includes('celda--error'));

// Corregirlo saca la marca pero no devuelve la vida
juego.teclear(uno.correcto);
chequear('corregir saca la marca roja', !juego.celda(uno.f, uno.c).includes('celda--error'));
chequear('corregir no devuelve la vida perdida',
  juego.doc.getElementById('texto-errores').textContent === '1 / 3');

// Un numero correcto no suma error
const dos = editables[1];
juego.clickCelda(dos.f, dos.c);
juego.teclear(dos.correcto);
chequear('un numero correcto no suma error',
  juego.doc.getElementById('texto-errores').textContent === '1 / 3');
chequear('el numero correcto queda escrito', juego.celda(dos.f, dos.c).includes(`>${dos.correcto}</button>`));

// ---------------- Segunda carga: el progreso vuelve ----------------
juego = await montarPagina();

chequear('al volver, el progreso sigue ahi',
  juego.celda(dos.f, dos.c).includes(`>${dos.correcto}</button>`)
  && juego.celda(uno.f, uno.c).includes(`>${uno.correcto}</button>`));
chequear('al volver, los errores siguen contados',
  juego.doc.getElementById('texto-errores').textContent === '1 / 3',
  juego.doc.getElementById('texto-errores').textContent);
chequear('al volver, el reloj retoma donde estaba',
  juego.doc.getElementById('texto-reloj').textContent === '00:00');

// ---------------- Gastar las tres vidas ----------------
const tres = editables[2];
const cuatro = editables[3];
juego.clickCelda(tres.f, tres.c);
juego.teclear(tres.malo);
chequear('segundo error', juego.doc.getElementById('texto-errores').textContent === '2 / 3');
chequear('con dos errores todavia se juega',
  juego.doc.getElementById('panel-resultado').hidden === true);

juego.clickCelda(cuatro.f, cuatro.c);
juego.teclear(cuatro.malo);
chequear('tercer error', juego.doc.getElementById('texto-errores').textContent === '3 / 3');
chequear('al tercer error se pierde',
  juego.doc.getElementById('panel-resultado').hidden === false);
chequear('el panel dice que te quedaste sin vidas',
  juego.doc.getElementById('resultado-titulo').textContent === 'Te quedaste sin vidas',
  juego.doc.getElementById('resultado-titulo').textContent);

// Perdida la partida, el tablero no responde
const cinco = editables[4];
juego.clickCelda(cinco.f, cinco.c);
juego.teclear(cinco.correcto);
chequear('perdida la partida no se puede seguir escribiendo',
  !juego.celda(cinco.f, cinco.c).includes(`>${cinco.correcto}</button>`));

// ---------------- Tercera carga: la derrota tambien se recuerda ----------------
juego = await montarPagina();
chequear('al volver, la derrota se recuerda',
  juego.doc.getElementById('panel-resultado').hidden === false
  && juego.doc.getElementById('texto-errores').textContent === '3 / 3');

// ---------------- El tablero de ayer se limpia ----------------
almacen['catanet:sudoku-diario:2020-01-01'] = '{"tablero":[]}';
juego = await montarPagina();
chequear('los tableros de otros dias se borran',
  !('catanet:sudoku-diario:2020-01-01' in almacen));
chequear('el del dia sigue guardado',
  'catanet:sudoku-diario:2026-08-20' in almacen);

informar(resultados);
