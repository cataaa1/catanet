import { calcularColores, calcularEstadoTeclas } from '/shared/wordle.js';
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const MAXIMO_INTENTOS = 6;
const PARAMETRO_PALABRA = 'w';
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR']
];
const elementos = {
  panelCreador: document.getElementById('panel-creador'),
  panelJuego: document.getElementById('panel-juego'),
  formularioPalabra: document.getElementById('formulario-palabra'),
  inputPalabra: document.getElementById('input-palabra'),
  panelLink: document.getElementById('panel-link'),
  inputLink: document.getElementById('input-link'),
  botonCopiar: document.getElementById('boton-copiar'),
  botonProbar: document.getElementById('boton-probar'),
  tablero: document.getElementById('tablero'),
  teclado: document.getElementById('teclado'),
  textoEstado: document.getElementById('texto-estado'),
  botonAyuda: document.getElementById('boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  panelResultado: document.getElementById('panel-resultado'),
  panelAyuda: document.getElementById('panel-ayuda'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  toast: document.getElementById('toast')
};

const estado = {
  palabraSecreta: '',
  longitudPalabra: 5,
  intentoActual: '',
  historialIntentos: [],
  fase: 'creador',
  festejado: false,
  toastTimeout: null
};

inicializar();

function inicializar() {
  habilitarCierreResultado();
  enlazarEventos();

  const palabraDelLink = obtenerPalabraDesdeUrl();

  if (palabraDelLink) {
    iniciarPartida(palabraDelLink);
    return;
  }

  mostrarCreador();
}

function enlazarEventos() {
  elementos.formularioPalabra.addEventListener('submit', generarLink);
  elementos.botonCopiar.addEventListener('click', copiarLink);
  elementos.botonAyuda.addEventListener('click', abrirAyuda);
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.panelAyuda.addEventListener('click', cerrarAyudaDesdeFondo);
  document.addEventListener('keydown', manejarTecladoFisico);
}

function mostrarCreador() {
  estado.fase = 'creador';
  elementos.panelCreador.hidden = false;
  elementos.panelJuego.hidden = true;
  elementos.panelResultado.hidden = true;
  elementos.inputPalabra.focus();
}

function iniciarPartida(palabra) {
  estado.palabraSecreta = palabra;
  estado.longitudPalabra = palabra.length;
  estado.intentoActual = '';
  estado.historialIntentos = [];
  estado.fase = 'jugando';
  estado.festejado = false;

  document.documentElement.style.setProperty('--longitud-palabra', estado.longitudPalabra);
  elementos.panelCreador.hidden = true;
  elementos.panelJuego.hidden = false;
  elementos.panelResultado.hidden = true;

  construirTeclado();
  renderizarTodo();
}

function generarLink(evento) {
  evento.preventDefault();

  const palabra = normalizarPalabra(elementos.inputPalabra.value);

  if (!palabra) {
    mostrarToast('Escribi una palabra usando solo letras.');
    return;
  }

  if (palabra.length < 2) {
    mostrarToast('La palabra debe tener al menos 2 letras.');
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = '/wordle/custom/';
  url.search = '';
  url.searchParams.set(PARAMETRO_PALABRA, codificarPalabra(palabra));

  elementos.inputLink.value = url.toString();
  elementos.botonProbar.href = url.toString();
  elementos.panelLink.hidden = false;
  elementos.inputLink.select();
}

async function copiarLink() {
  if (!elementos.inputLink.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(elementos.inputLink.value);
    mostrarToast('Link copiado.');
  } catch {
    elementos.inputLink.select();
    mostrarToast('No pude copiarlo automaticamente. El link quedo seleccionado.');
  }
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
  if (esCampoEditable(evento.target)) {
    return;
  }

  if (evento.key === 'Escape' && !elementos.panelAyuda.hidden) {
    evento.preventDefault();
    cerrarAyuda();
    return;
  }

  if (!elementos.panelAyuda.hidden || estado.fase !== 'jugando') {
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
  if (estado.intentoActual.length >= estado.longitudPalabra) {
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
  if (estado.intentoActual.length !== estado.longitudPalabra) {
    mostrarToast(`La palabra debe tener ${estado.longitudPalabra} letras.`);
    return;
  }

  const intento = estado.intentoActual;
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

function renderizarTodo() {
  renderizarEstado();
  renderizarTablero();
  renderizarTeclado();
  renderizarResultado();
}

function renderizarEstado() {
  if (estado.fase !== 'jugando') {
    elementos.textoEstado.textContent = 'Partida terminada.';
    return;
  }

  const restantes = MAXIMO_INTENTOS - estado.historialIntentos.length;
  elementos.textoEstado.textContent = `Adivina una palabra de ${estado.longitudPalabra} letras. Te quedan ${restantes} intento${restantes === 1 ? '' : 's'}.`;
}

function renderizarTablero() {
  elementos.tablero.innerHTML = '';

  for (let indice = 0; indice < MAXIMO_INTENTOS; indice += 1) {
    const fila = document.createElement('div');
    fila.className = `fila${estado.fase === 'jugando' && indice === estado.historialIntentos.length ? ' fila--activa' : ''}`;
    const contenedorCeldas = document.createElement('div');
    contenedorCeldas.className = 'fila__celdas';

    let letras = Array(estado.longitudPalabra).fill('');
    let colores = Array(estado.longitudPalabra).fill('');

    if (estado.historialIntentos[indice]) {
      letras = estado.historialIntentos[indice].palabra.split('');
      colores = estado.historialIntentos[indice].colores;
    } else if (estado.fase === 'jugando' && indice === estado.historialIntentos.length) {
      letras = letrasDesdeString(estado.intentoActual);
    }

    for (let posicion = 0; posicion < estado.longitudPalabra; posicion += 1) {
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
    elementos.resultadoTexto.textContent = `La palabra era ${estado.palabraSecreta}.`;
  } else {
    elementos.panelResultado.hidden = true;
    return;
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

function obtenerPalabraDesdeUrl() {
  const parametros = new URLSearchParams(window.location.search);
  const valor = parametros.get(PARAMETRO_PALABRA);

  if (!valor) {
    return '';
  }

  try {
    const palabra = normalizarPalabra(decodificarPalabra(valor));
    return palabra.length >= 2 ? palabra : '';
  } catch {
    mostrarToast('El link no tiene una palabra valida.');
    return '';
  }
}

function codificarPalabra(palabra) {
  const base64 = btoa(unescape(encodeURIComponent(palabra)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodificarPalabra(valor) {
  const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(base64 + padding)));
}

function normalizarPalabra(texto) {
  return String(texto || '')
    .trim()
    .replace(/[ñÑ]/g, '__enie__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/__enie__/g, 'Ñ')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-ZÑ]/g, '');
}

function letrasDesdeString(texto) {
  return Array.from({ length: estado.longitudPalabra }, (_, indice) => texto[indice] || '');
}

function normalizarTecla(tecla) {
  if (/[ñÑ]/.test(String(tecla || ''))) {
    return 'Ñ';
  }

  const texto = String(tecla || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return /^[A-ZÑ]$/.test(texto) ? texto : '';
}

function esCampoEditable(elemento) {
  if (!elemento) {
    return false;
  }

  const etiqueta = elemento.tagName;
  return etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || elemento.isContentEditable;
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 3000);
}
