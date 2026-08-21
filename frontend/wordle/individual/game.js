import { calcularColores, calcularEstadoTeclas } from '/shared/wordle.js';
import { obtenerPalabraAleatoria, palabrasValidas } from '/shared/words.js';
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const LONGITUD_PALABRA = 5;
const MAXIMO_INTENTOS = 6;
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '\u00D1'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR']
];
const elementos = {
  tablero: document.getElementById('tablero'),
  teclado: document.getElementById('teclado'),
  textoEstado: document.getElementById('texto-estado'),
  botonNueva: document.getElementById('boton-nueva'),
  botonAyuda: document.getElementById('boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  botonReiniciar: document.getElementById('boton-reiniciar'),
  panelResultado: document.getElementById('panel-resultado'),
  panelAyuda: document.getElementById('panel-ayuda'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  toast: document.getElementById('toast')
};

const estado = {
  palabraSecreta: obtenerPalabraAleatoria(),
  intentoActual: '',
  historialIntentos: [],
  fase: 'jugando',
  festejado: false,
  palabrasValidas,
  toastTimeout: null
};

inicializar();

function inicializar() {
  habilitarCierreResultado();
  construirTeclado();
  enlazarEventos();
  renderizarTodo();
}

function enlazarEventos() {
  elementos.botonNueva.addEventListener('click', pedirNuevaPalabra);
  elementos.botonAyuda.addEventListener('click', abrirAyuda);
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.botonReiniciar.addEventListener('click', reiniciarPartida);
  elementos.panelAyuda.addEventListener('click', cerrarAyudaDesdeFondo);
  document.addEventListener('keydown', manejarTecladoFisico);
}

function construirTeclado() {
  elementos.teclado.innerHTML = '';

  FILAS_TECLADO.forEach((fila) => {
    const filaElemento = document.createElement('div');
    filaElemento.className = 'teclado__fila';

    fila.forEach((tecla) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `tecla${tecla.length > 1 ? ' tecla--larga' : ''}`;
      boton.dataset.tecla = tecla;
      boton.textContent = tecla === 'BORRAR' ? 'Borrar' : tecla;
      boton.addEventListener('click', () => manejarTeclaVirtual(tecla));
      filaElemento.appendChild(boton);
    });

    elementos.teclado.appendChild(filaElemento);
  });
}

function manejarTecladoFisico(evento) {
  if (evento.key === 'Escape' && !elementos.panelAyuda.hidden) {
    evento.preventDefault();
    cerrarAyuda();
    return;
  }

  if (!elementos.panelAyuda.hidden) {
    return;
  }

  if (evento.key === 'Enter' && estado.fase !== 'jugando') {
    evento.preventDefault();
    reiniciarPartida();
    return;
  }

  if (estado.fase !== 'jugando') {
    return;
  }

  if (evento.key === 'Enter') {
    evento.preventDefault();
    confirmarIntento();
    return;
  }

  if (evento.key === 'Backspace') {
    evento.preventDefault();
    borrarLetra();
    return;
  }

  const letra = normalizarTecla(evento.key);

  if (letra) {
    evento.preventDefault();
    agregarLetra(letra);
  }
}

function manejarTeclaVirtual(tecla) {
  if (estado.fase !== 'jugando') {
    return;
  }

  if (tecla === 'ENTER') {
    confirmarIntento();
    return;
  }

  if (tecla === 'BORRAR') {
    borrarLetra();
    return;
  }

  agregarLetra(tecla);
}

function agregarLetra(letra) {
  if (estado.intentoActual.length >= LONGITUD_PALABRA) {
    return;
  }

  estado.intentoActual += letra;
  renderizarTodo();
}

function borrarLetra() {
  if (!estado.intentoActual.length) {
    return;
  }

  estado.intentoActual = estado.intentoActual.slice(0, -1);
  renderizarTodo();
}

function confirmarIntento() {
  if (estado.intentoActual.length !== LONGITUD_PALABRA) {
    mostrarToast(`La palabra debe tener ${LONGITUD_PALABRA} letras.`);
    return;
  }

  const intento = estado.intentoActual;

  if (!estado.palabrasValidas.has(intento)) {
    mostrarToast('Esa palabra no esta en la lista del juego.');
    return;
  }

  const colores = calcularColores(estado.palabraSecreta, intento);
  const acertado = intento === estado.palabraSecreta;

  estado.historialIntentos.push({
    palabra: intento,
    colores,
    acertado
  });
  estado.intentoActual = '';

  if (acertado) {
    estado.fase = 'victoria';
  } else if (estado.historialIntentos.length >= MAXIMO_INTENTOS) {
    estado.fase = 'derrota';
  }

  renderizarTodo();
}

function reiniciarPartida() {
  estado.palabraSecreta = obtenerPalabraAleatoria();
  estado.intentoActual = '';
  estado.historialIntentos = [];
  estado.fase = 'jugando';
  estado.festejado = false;
  elementos.panelResultado.hidden = true;
  elementos.teclado.hidden = false;
  renderizarTodo();
}

function pedirNuevaPalabra() {
  if (estado.fase !== 'jugando') {
    reiniciarPartida();
    return;
  }

  estado.fase = 'revelada';
  estado.intentoActual = '';
  renderizarTodo();
}

function abrirAyuda() {
  elementos.panelAyuda.hidden = false;
  elementos.botonCerrarAyuda.focus();
}

function cerrarAyuda() {
  elementos.panelAyuda.hidden = true;
  elementos.botonAyuda.focus();
}

function cerrarAyudaDesdeFondo(evento) {
  if (evento.target === elementos.panelAyuda) {
    cerrarAyuda();
  }
}

function renderizarTodo() {
  renderizarEstado();
  renderizarTablero();
  renderizarTeclado();
  renderizarResultado();
}

function renderizarEstado() {
  if (estado.fase === 'jugando') {
    const restantes = MAXIMO_INTENTOS - estado.historialIntentos.length;
    elementos.textoEstado.textContent = `Adivina la palabra secreta. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'}.`;
    return;
  }

  if (estado.fase === 'victoria') {
    elementos.textoEstado.textContent = 'Ganaste. Descubriste la palabra secreta.';
    return;
  }

  if (estado.fase === 'revelada') {
    elementos.textoEstado.textContent = `La palabra era ${estado.palabraSecreta}.`;
    return;
  }

  elementos.textoEstado.textContent = 'Se terminaron los intentos.';
}

function renderizarTablero() {
  elementos.tablero.innerHTML = '';

  for (let indice = 0; indice < MAXIMO_INTENTOS; indice += 1) {
    const fila = document.createElement('div');
    fila.className = `fila${estado.fase === 'jugando' && indice === estado.historialIntentos.length ? ' fila--activa' : ''}`;
    const contenedorCeldas = document.createElement('div');
    contenedorCeldas.className = 'fila__celdas';

    let letras = Array(LONGITUD_PALABRA).fill('');
    let colores = Array(LONGITUD_PALABRA).fill('');

    if (estado.historialIntentos[indice]) {
      letras = estado.historialIntentos[indice].palabra.split('');
      colores = estado.historialIntentos[indice].colores;
    } else if (estado.fase === 'jugando' && indice === estado.historialIntentos.length) {
      letras = letrasDesdeString(estado.intentoActual);
    }

    for (let posicion = 0; posicion < LONGITUD_PALABRA; posicion += 1) {
      const celda = document.createElement('div');
      const letra = letras[posicion] || '';
      const color = colores[posicion] || '';
      const pendiente = !color && letra;

      celda.className = `celda${color ? ` celda--${color}` : ''}${pendiente ? ' celda--pendiente' : ''}`;
      celda.textContent = letra;
      contenedorCeldas.appendChild(celda);
    }

    fila.appendChild(contenedorCeldas);
    elementos.tablero.appendChild(fila);
  }
}

function renderizarTeclado() {
  const estadoTeclas = calcularEstadoTeclas(estado.historialIntentos);
  const partidaTerminada = estado.fase !== 'jugando';

  elementos.teclado.hidden = partidaTerminada;

  if (partidaTerminada) {
    return;
  }

  elementos.teclado.querySelectorAll('.tecla').forEach((tecla) => {
    const valor = tecla.dataset.tecla;
    const color = estadoTeclas[valor];

    tecla.classList.remove('tecla--correcto', 'tecla--presente', 'tecla--ausente');

    if (color) {
      tecla.classList.add(`tecla--${color}`);
    }
  });
}

function renderizarResultado() {
  if (estado.fase === 'jugando') {
    elementos.panelResultado.hidden = true;
    return;
  }

  if (estado.fase === 'victoria') {
    elementos.resultadoTitulo.textContent = 'Ganaste';
    elementos.resultadoTexto.textContent = `Descubriste ${estado.palabraSecreta} en ${estado.historialIntentos.length} intento${estado.historialIntentos.length === 1 ? '' : 's'}.`;
    lanzarFestejoUnaVez();
  } else if (estado.fase === 'derrota') {
    elementos.resultadoTitulo.textContent = 'Se acabaron los intentos';
    elementos.resultadoTexto.textContent = `La palabra era ${estado.palabraSecreta}. Podes probar con una nueva palabra.`;
  } else {
    elementos.resultadoTitulo.textContent = 'La palabra era';
    elementos.resultadoTexto.textContent = `${estado.palabraSecreta}. Presiona Nueva palabra para empezar otra partida.`;
  }

  elementos.panelResultado.hidden = false;
}

// El festejo se dispara una sola vez por partida ganada
function lanzarFestejoUnaVez() {
  if (estado.festejado) {
    return;
  }

  estado.festejado = true;
  festejar();
}

function letrasDesdeString(texto) {
  return Array.from({ length: LONGITUD_PALABRA }, (_, indice) => texto[indice] || '');
}

function normalizarTecla(tecla) {
  if (/[\u00F1\u00D1]/.test(String(tecla || ''))) {
    return '\u00D1';
  }

  const texto = String(tecla || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return /^[A-Z\u00D1]$/.test(texto) ? texto : '';
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 3000);
}
