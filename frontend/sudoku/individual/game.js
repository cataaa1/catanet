import {
  actualizarCelda,
  crearIdCelda,
  crearPartidaSudoku,
  esCeldaEditable,
  estaSudokuResuelto,
  obtenerConflictos,
  obtenerDificultadSudoku,
  obtenerRelacionCelda
} from '/shared/sudoku.js';
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const TOTAL_PISTAS = 3;
const REPETICIONES_POR_DIGITO = 9;

const elementos = {
  tablero: document.getElementById('tablero'),
  veloGenerando: document.getElementById('velo-generando'),
  textoEstado: document.getElementById('texto-estado'),
  grupoDificultades: document.getElementById('grupo-dificultades'),
  botonNueva: document.getElementById('boton-nueva'),
  botonDeshacer: document.getElementById('boton-deshacer'),
  botonBorrar: document.getElementById('boton-borrar'),
  botonNotas: document.getElementById('boton-notas'),
  botonPista: document.getElementById('boton-pista'),
  badgeNotas: document.getElementById('badge-notas'),
  badgePistas: document.getElementById('badge-pistas'),
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
  notas: crearNotasVacias(),
  celdasPista: new Set(),
  celdaSeleccionada: null,
  conflictos: new Set(),
  historial: [],
  modoNotas: false,
  pistasRestantes: TOTAL_PISTAS,
  fase: 'jugando',
  festejado: false,
  generando: false,
  toastTimeout: null
};

inicializar();

function inicializar() {
  habilitarCierreResultado();
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
  elementos.botonDeshacer.addEventListener('click', deshacerUltimaJugada);
  elementos.botonBorrar.addEventListener('click', borrarCeldaSeleccionada);
  elementos.botonNotas.addEventListener('click', alternarModoNotas);
  elementos.botonPista.addEventListener('click', usarPista);
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
    estado.notas = crearNotasVacias();
    estado.celdasPista = new Set();
    estado.historial = [];
    estado.modoNotas = false;
    estado.pistasRestantes = TOTAL_PISTAS;
    estado.conflictos = new Set();
    estado.festejado = false;
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

  if (!boton || boton.dataset.dificultad === estado.dificultad) {
    return;
  }

  void iniciarNuevaPartida(boton.dataset.dificultad);
}

function manejarClickTablero(evento) {
  const boton = evento.target.closest('[data-fila][data-columna]');

  if (!boton || estado.generando) {
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

  if (!boton || estado.generando) {
    return;
  }

  escribirEnCeldaSeleccionada(boton.dataset.valor);
}

function manejarTeclado(evento) {
  if (estado.generando) {
    return;
  }

  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'z') {
    evento.preventDefault();
    deshacerUltimaJugada();
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

  if (evento.key.toLowerCase() === 'n') {
    evento.preventDefault();
    alternarModoNotas();
    return;
  }

  if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown' || evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
    evento.preventDefault();
    moverSeleccion(evento.key);
  }
}

function escribirEnCeldaSeleccionada(valor) {
  const celda = obtenerCeldaActiva();

  if (!celda) {
    return;
  }

  const { fila, columna } = celda;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Esa celda ya venia fija en el tablero.');
    return;
  }

  if (estado.modoNotas) {
    guardarEnHistorial(fila, columna);
    estado.notas[fila][columna] = alternarNota(estado.notas[fila][columna], valor);
    estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, '');
    sincronizarEstadoPartida();
    return;
  }

  if (contarDigito(valor) >= REPETICIONES_POR_DIGITO) {
    mostrarToast(`Ya colocaste los nueve ${valor}.`);
    return;
  }

  guardarEnHistorial(fila, columna);
  estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, valor);
  estado.notas[fila][columna] = [];
  estado.celdasPista.delete(crearIdCelda(fila, columna));
  sincronizarEstadoPartida();
}

function borrarCeldaSeleccionada() {
  const celda = obtenerCeldaActiva();

  if (!celda || estado.generando) {
    return;
  }

  const { fila, columna } = celda;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Las celdas fijas no se pueden borrar.');
    return;
  }

  guardarEnHistorial(fila, columna);
  estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, '');
  estado.notas[fila][columna] = [];
  estado.celdasPista.delete(crearIdCelda(fila, columna));
  sincronizarEstadoPartida();
}

function alternarModoNotas() {
  if (estado.generando) {
    return;
  }

  estado.modoNotas = !estado.modoNotas;
  renderizarControles();
}

function usarPista() {
  if (estado.generando || estado.fase !== 'jugando') {
    return;
  }

  if (estado.pistasRestantes <= 0) {
    mostrarToast('Ya usaste las tres pistas de este tablero.');
    return;
  }

  const celda = buscarCeldaParaPista();

  if (!celda) {
    mostrarToast('No quedan celdas para revelar.');
    return;
  }

  const { fila, columna } = celda;

  guardarEnHistorial(fila, columna, true);
  estado.tableroActual = actualizarCelda(
    estado.tableroActual,
    fila,
    columna,
    estado.tableroResuelto[fila][columna]
  );
  estado.notas[fila][columna] = [];
  estado.celdasPista.add(crearIdCelda(fila, columna));
  estado.celdaSeleccionada = { fila, columna };
  estado.pistasRestantes -= 1;
  sincronizarEstadoPartida();
}

// La pista prioriza la celda seleccionada; si no sirve, busca la primera vacia o mal resuelta
function buscarCeldaParaPista() {
  const seleccionada = estado.celdaSeleccionada;

  if (seleccionada && necesitaPista(seleccionada.fila, seleccionada.columna)) {
    return seleccionada;
  }

  for (let fila = 0; fila < 9; fila += 1) {
    for (let columna = 0; columna < 9; columna += 1) {
      if (necesitaPista(fila, columna)) {
        return { fila, columna };
      }
    }
  }

  return null;
}

function necesitaPista(fila, columna) {
  return esCeldaEditable(estado.tableroInicial, fila, columna)
    && estado.tableroActual[fila][columna] !== estado.tableroResuelto[fila][columna];
}

function guardarEnHistorial(fila, columna, esPista = false) {
  estado.historial.push({
    fila,
    columna,
    valor: estado.tableroActual[fila][columna],
    notas: estado.notas[fila][columna].slice(),
    eraPista: estado.celdasPista.has(crearIdCelda(fila, columna)),
    esPista
  });
}

function deshacerUltimaJugada() {
  if (estado.generando || !estado.historial.length) {
    return;
  }

  const jugada = estado.historial.pop();

  estado.tableroActual = actualizarCelda(
    estado.tableroActual,
    jugada.fila,
    jugada.columna,
    jugada.valor
  );
  estado.notas[jugada.fila][jugada.columna] = jugada.notas.slice();

  const idCelda = crearIdCelda(jugada.fila, jugada.columna);

  if (jugada.eraPista) {
    estado.celdasPista.add(idCelda);
  } else {
    estado.celdasPista.delete(idCelda);
  }

  if (jugada.esPista) {
    estado.pistasRestantes = Math.min(TOTAL_PISTAS, estado.pistasRestantes + 1);
  }

  estado.celdaSeleccionada = { fila: jugada.fila, columna: jugada.columna };
  estado.fase = 'jugando';
  elementos.panelResultado.hidden = true;
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
    elementos.resultadoTexto.textContent = `Completaste el tablero en dificultad ${obtenerDificultadSudoku(estado.dificultad).etiqueta.toLowerCase()}.`;
    elementos.panelResultado.hidden = false;
    lanzarFestejoUnaVez();
  }

  renderizarTodo();
}

// El festejo se dispara una sola vez por tablero resuelto
function lanzarFestejoUnaVez() {
  if (estado.festejado) {
    return;
  }

  estado.festejado = true;
  festejar();
}

function renderizarTodo() {
  renderizarDificultad();
  renderizarEstado();
  renderizarTablero();
  renderizarControles();
}

function renderizarDificultad() {
  elementos.grupoDificultades.querySelectorAll('[data-dificultad]').forEach((boton) => {
    boton.classList.toggle('is-active', boton.dataset.dificultad === estado.dificultad);
  });
}

// El texto ya no se muestra en pantalla, pero lo mantenemos para lectores de pantalla
function renderizarEstado() {
  elementos.veloGenerando.hidden = !estado.generando;

  if (estado.generando) {
    elementos.textoEstado.textContent = `Generando tablero ${obtenerDificultadSudoku(estado.dificultad).etiqueta.toLowerCase()}.`;
    return;
  }

  if (estado.fase === 'ganado') {
    elementos.textoEstado.textContent = 'Tablero resuelto.';
    return;
  }

  if (!estado.celdaSeleccionada) {
    elementos.textoEstado.textContent = 'Selecciona una celda editable para empezar.';
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;
  const posicion = `Fila ${fila + 1}, columna ${columna + 1}.`;

  if (estado.conflictos.size) {
    elementos.textoEstado.textContent = `${posicion} Hay ${estado.conflictos.size} celdas en conflicto.`;
    return;
  }

  elementos.textoEstado.textContent = esCeldaEditable(estado.tableroInicial, fila, columna)
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
      notas: estado.notas[fila][columna],
      editable: esCeldaEditable(estado.tableroInicial, fila, columna),
      esPista: estado.celdasPista.has(crearIdCelda(fila, columna)),
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
  notas,
  editable,
  esPista,
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

  if (esPista) {
    clases.push('celda--pista');
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

  const contenido = valor || crearNotasHtml(notas);
  const descripcion = editable
    ? `Celda editable, fila ${fila + 1}, columna ${columna + 1}, valor ${valor || 'vacio'}`
    : `Pista fija, fila ${fila + 1}, columna ${columna + 1}, valor ${valor}`;

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

function crearNotasHtml(notas) {
  if (!notas.length) {
    return '';
  }

  const celdasNota = Array.from({ length: 9 }, (_, indice) => {
    const digito = String(indice + 1);
    return `<span class="celda__nota">${notas.includes(digito) ? digito : ''}</span>`;
  }).join('');

  return `<span class="celda__notas">${celdasNota}</span>`;
}

function renderizarControles() {
  elementos.numpad.querySelectorAll('[data-valor]').forEach((tecla) => {
    const completo = contarDigito(tecla.dataset.valor) >= REPETICIONES_POR_DIGITO;
    tecla.classList.toggle('numpad__tecla--completa', completo);
  });

  elementos.botonNotas.classList.toggle('is-activa', estado.modoNotas);
  elementos.botonNotas.classList.toggle('accion--apagada', !estado.modoNotas);
  elementos.botonNotas.setAttribute('aria-pressed', estado.modoNotas ? 'true' : 'false');
  elementos.badgeNotas.textContent = estado.modoNotas ? 'ON' : 'OFF';

  elementos.badgePistas.textContent = String(estado.pistasRestantes);
  elementos.botonPista.setAttribute('aria-disabled', estado.pistasRestantes ? 'false' : 'true');
  elementos.botonDeshacer.setAttribute('aria-disabled', estado.historial.length ? 'false' : 'true');
}

function contarDigito(digito) {
  return estado.tableroActual
    .flat()
    .filter((valor) => valor === digito)
    .length;
}

function alternarNota(notas, valor) {
  if (notas.includes(valor)) {
    return notas.filter((nota) => nota !== valor);
  }

  return [...notas, valor].sort();
}

function obtenerCeldaActiva() {
  if (!estado.celdaSeleccionada) {
    estado.celdaSeleccionada = buscarPrimeraEditable();
  }

  return estado.celdaSeleccionada;
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

// Tablero neutro de 9x9 para poder renderizar antes de que exista una partida
function crearTableroVacio() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ''));
}

function crearNotasVacias() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
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
