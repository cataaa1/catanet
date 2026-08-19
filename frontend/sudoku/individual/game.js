import {
  actualizarCelda,
  contarCeldasLlenas,
  crearIdCelda,
  crearPartidaSudoku,
  esCeldaEditable,
  estaSudokuResuelto,
  obtenerConflictos,
  obtenerDificultadSudoku,
  obtenerRelacionCelda
} from '/shared/sudoku.js';

const elementos = {
  tablero: document.getElementById('tablero'),
  textoEstado: document.getElementById('texto-estado'),
  textoDificultad: document.getElementById('texto-dificultad'),
  textoDificultadDetalle: document.getElementById('texto-dificultad-detalle'),
  textoProgreso: document.getElementById('texto-progreso'),
  textoConflictos: document.getElementById('texto-conflictos'),
  grupoDificultades: document.getElementById('grupo-dificultades'),
  botonNueva: document.getElementById('boton-nueva'),
  panelResultado: document.getElementById('panel-resultado'),
  resultadoTexto: document.getElementById('resultado-texto'),
  botonReiniciar: document.getElementById('boton-reiniciar'),
  numpad: document.getElementById('numpad'),
  toast: document.getElementById('toast')
};

const estado = {
  dificultad: 'medio',
  tableroInicial: crearTableroVacio(),
  tableroActual: crearTableroVacio(),
  tableroResuelto: crearTableroVacio(),
  celdaSeleccionada: null,
  conflictos: new Set(),
  fase: 'jugando',
  generando: false,
  toastTimeout: null
};

inicializar();

function inicializar() {
  enlazarEventos();
  iniciarNuevaPartida(estado.dificultad);
}

function enlazarEventos() {
  elementos.grupoDificultades.addEventListener('click', manejarCambioDificultad);
  elementos.botonNueva.addEventListener('click', () => {
    void iniciarNuevaPartida(estado.dificultad);
  });
  elementos.botonReiniciar.addEventListener('click', () => {
    void iniciarNuevaPartida(estado.dificultad);
  });
  elementos.tablero.addEventListener('click', manejarClickTablero);
  elementos.numpad.addEventListener('click', manejarClickNumpad);
  document.addEventListener('keydown', manejarTeclado);
}

async function iniciarNuevaPartida(dificultadId) {
  if (estado.generando) {
    return;
  }

  estado.dificultad = dificultadId;
  estado.generando = true;
  estado.fase = 'generando';
  renderizarTodo();
  await esperarRepaint();

  try {
    const partida = crearPartidaSudoku(dificultadId);

    estado.dificultad = partida.dificultad;
    estado.tableroInicial = partida.tableroInicial;
    estado.tableroActual = partida.tableroInicial.map((fila) => fila.slice());
    estado.tableroResuelto = partida.tableroResuelto;
    estado.conflictos = new Set();
    estado.celdaSeleccionada = buscarPrimeraEditable();
    estado.fase = 'jugando';
    elementos.panelResultado.hidden = true;
  } catch (error) {
    estado.fase = 'jugando';
    mostrarToast('No pude generar un tablero nuevo. Intenta otra vez.');
    console.error(error);
  } finally {
    estado.generando = false;
    renderizarTodo();
  }
}

function manejarCambioDificultad(evento) {
  const boton = evento.target.closest('[data-dificultad]');

  if (!boton) {
    return;
  }

  const siguienteDificultad = boton.dataset.dificultad;

  if (siguienteDificultad === estado.dificultad) {
    return;
  }

  void iniciarNuevaPartida(siguienteDificultad);
}

function manejarClickTablero(evento) {
  const boton = evento.target.closest('[data-fila][data-columna]');

  if (!boton) {
    return;
  }

  if (estado.generando) {
    return;
  }

  estado.celdaSeleccionada = {
    fila: Number(boton.dataset.fila),
    columna: Number(boton.dataset.columna)
  };

  renderizarTodo();
}

function manejarClickNumpad(evento) {
  const boton = evento.target.closest('[data-valor]');

  if (!boton) {
    return;
  }

  if (estado.generando) {
    return;
  }

  const { valor } = boton.dataset;

  if (valor === 'borrar') {
    borrarCeldaSeleccionada();
    return;
  }

  escribirEnCeldaSeleccionada(valor);
}

function manejarTeclado(evento) {
  if (estado.generando) {
    return;
  }

  if (estado.fase !== 'jugando') {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      void iniciarNuevaPartida(estado.dificultad);
    }
    return;
  }

  if (/^[1-9]$/.test(evento.key)) {
    evento.preventDefault();
    escribirEnCeldaSeleccionada(evento.key);
    return;
  }

  if (evento.key === 'Backspace' || evento.key === 'Delete' || evento.key === '0') {
    evento.preventDefault();
    borrarCeldaSeleccionada();
    return;
  }

  if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown' || evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
    evento.preventDefault();
    moverSeleccion(evento.key);
  }
}

function escribirEnCeldaSeleccionada(valor) {
  if (!estado.celdaSeleccionada) {
    estado.celdaSeleccionada = buscarPrimeraEditable();
  }

  if (!estado.celdaSeleccionada) {
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Esa celda ya venia fija en el tablero.');
    return;
  }

  estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, valor);
  sincronizarEstadoPartida();
}

function borrarCeldaSeleccionada() {
  if (!estado.celdaSeleccionada) {
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Las celdas fijas no se pueden borrar.');
    return;
  }

  estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, '');
  sincronizarEstadoPartida();
}

function moverSeleccion(tecla) {
  const actual = estado.celdaSeleccionada || buscarPrimeraEditable() || { fila: 0, columna: 0 };
  const delta = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  }[tecla];

  estado.celdaSeleccionada = {
    fila: (actual.fila + delta[0] + 9) % 9,
    columna: (actual.columna + delta[1] + 9) % 9
  };

  renderizarTodo();
}

function sincronizarEstadoPartida() {
  estado.conflictos = obtenerConflictos(estado.tableroActual);

  if (!estado.conflictos.size && estaSudokuResuelto(estado.tableroActual, estado.tableroResuelto)) {
    estado.fase = 'ganado';
    elementos.resultadoTexto.textContent = `Completaste el tablero en dificultad ${obtenerDificultadSudoku(estado.dificultad).etiqueta.toLowerCase()} sin usar pistas.`;
    elementos.panelResultado.hidden = false;
  } else {
    estado.fase = 'jugando';
    elementos.panelResultado.hidden = true;
  }

  renderizarTodo();
}

function renderizarTodo() {
  renderizarDificultad();
  renderizarEstado();
  renderizarTablero();
  renderizarProgreso();
}

function renderizarDificultad() {
  const dificultad = obtenerDificultadSudoku(estado.dificultad);

  elementos.textoDificultad.textContent = dificultad.etiqueta;
  elementos.textoDificultadDetalle.textContent = dificultad.descripcion;

  elementos.grupoDificultades.querySelectorAll('[data-dificultad]').forEach((boton) => {
    boton.classList.toggle('is-active', boton.dataset.dificultad === estado.dificultad);
  });
}

function renderizarEstado() {
  if (estado.generando) {
    elementos.textoEstado.textContent = `Generando tablero ${obtenerDificultadSudoku(estado.dificultad).etiqueta.toLowerCase()}...`;
    return;
  }

  if (estado.fase === 'ganado') {
    elementos.textoEstado.textContent = 'Tablero resuelto. Puedes generar otro cuando quieras.';
    return;
  }

  if (!estado.celdaSeleccionada) {
    elementos.textoEstado.textContent = 'Selecciona una celda editable para empezar.';
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;
  const editable = esCeldaEditable(estado.tableroInicial, fila, columna);
  const posicion = `Fila ${fila + 1}, columna ${columna + 1}.`;

  if (estado.conflictos.size) {
    elementos.textoEstado.textContent = `${posicion} Hay ${estado.conflictos.size} celda${estado.conflictos.size === 1 ? '' : 's'} en conflicto.`;
    return;
  }

  elementos.textoEstado.textContent = editable
    ? `${posicion} Lista para escribir un numero del 1 al 9.`
    : `${posicion} Esa pista inicial es fija.`;
}

function renderizarTablero() {
  const seleccion = estado.celdaSeleccionada;
  const relacionadas = seleccion
    ? obtenerRelacionCelda(seleccion.fila, seleccion.columna)
    : new Set();
  const valorSeleccionado = seleccion
    ? estado.tableroActual[seleccion.fila][seleccion.columna]
    : '';

  elementos.tablero.innerHTML = Array.from({ length: 9 }, (_, fila) => (
    Array.from({ length: 9 }, (_, columna) => crearCelda({
      fila,
      columna,
      valor: estado.tableroActual[fila][columna],
      editable: esCeldaEditable(estado.tableroInicial, fila, columna),
      estaSeleccionada: Boolean(seleccion && seleccion.fila === fila && seleccion.columna === columna),
      estaRelacionada: relacionadas.has(crearIdCelda(fila, columna)),
      valorSeleccionado,
      estaEnConflicto: estado.conflictos.has(crearIdCelda(fila, columna))
    })).join('')
  )).join('');
}

function crearCelda({
  fila,
  columna,
  valor,
  editable,
  estaSeleccionada,
  estaRelacionada,
  valorSeleccionado,
  estaEnConflicto
}) {
  const clases = ['celda'];

  clases.push(editable ? 'celda--editable' : 'celda--fija');

  if (estaRelacionada) {
    clases.push('celda--relacionada');
  }

  if (valor && valorSeleccionado && valor === valorSeleccionado) {
    clases.push('celda--igual');
  }

  if (estaSeleccionada) {
    clases.push('celda--seleccionada');
  }

  if (estaEnConflicto) {
    clases.push('celda--conflicto');
  }

  if (columna === 2 || columna === 5) {
    clases.push('celda--borde-derecho');
  }

  if (fila === 2 || fila === 5) {
    clases.push('celda--borde-inferior');
  }

  const contenido = valor || '';
  const descripcion = editable
    ? `Celda editable, fila ${fila + 1}, columna ${columna + 1}, valor ${contenido || 'vacio'}`
    : `Pista fija, fila ${fila + 1}, columna ${columna + 1}, valor ${contenido}`;

  return `
    <button
      type="button"
      class="${clases.join(' ')}"
      data-fila="${fila}"
      data-columna="${columna}"
      aria-label="${descripcion}"
      aria-pressed="${estaSeleccionada ? 'true' : 'false'}"
    >${contenido}</button>
  `;
}

function renderizarProgreso() {
  if (estado.generando) {
    elementos.textoProgreso.textContent = '-- / 81';
    elementos.textoConflictos.textContent = 'Buscando un tablero con una dificultad mas marcada.';
    return;
  }

  const celdasLlenas = contarCeldasLlenas(estado.tableroActual);
  const conflictos = estado.conflictos.size;

  elementos.textoProgreso.textContent = `${celdasLlenas} / 81`;

  if (!conflictos) {
    elementos.textoConflictos.textContent = celdasLlenas === 81
      ? 'No hay conflictos activos en el tablero.'
      : 'Sin conflictos detectados por ahora.';
    return;
  }

  elementos.textoConflictos.textContent = `${conflictos} celda${conflictos === 1 ? '' : 's'} marcada${conflictos === 1 ? '' : 's'} por repetir numero en fila, columna o bloque.`;
}

// Tablero neutro de 9x9 para poder renderizar antes de que exista una partida
function crearTableroVacio() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ''));
}

function buscarPrimeraEditable() {
  for (let fila = 0; fila < 9; fila += 1) {
    for (let columna = 0; columna < 9; columna += 1) {
      if (esCeldaEditable(estado.tableroInicial, fila, columna)) {
        return { fila, columna };
      }
    }
  }

  return null;
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 2600);
}

function esperarRepaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}
