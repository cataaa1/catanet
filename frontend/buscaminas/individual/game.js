import {
  alternarBandera,
  contarMinasRestantes,
  crearPartidaBuscaminas,
  obtenerDificultadBuscaminas,
  obtenerMinas,
  revelarCelda,
  revelarVecinos
} from '/shared/buscaminas.js';
import { cortarFestejo, festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const RUTA_MINA = '/buscaminas/assets/mina.png';
const RUTA_BANDERA = '/buscaminas/assets/bandera.png';
const MS_PULSACION_LARGA = 450;
const LADO_MINIMO = 18;
const LADO_MAXIMO = 64;
const SEPARACION_CELDAS = 2;
const PADDING_TABLERO = 10;
const ANCHO_CONTROLES = 216;
const SEPARACION_COLUMNAS = 24;
const ALTO_RESERVADO = 218;

const elementos = {
  tablero: document.getElementById('tablero'),
  textoMinas: document.getElementById('texto-minas'),
  textoReloj: document.getElementById('texto-reloj'),
  textoEstado: document.getElementById('texto-estado'),
  grupoDificultades: document.getElementById('grupo-dificultades'),
  botonNueva: document.getElementById('boton-nueva'),
  botonAyuda: document.getElementById('boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  panelAyuda: document.getElementById('panel-ayuda'),
  botonModoBandera: document.getElementById('boton-modo-bandera'),
  estadoModoBandera: document.getElementById('estado-modo-bandera'),
  panelResultado: document.getElementById('panel-resultado'),
  resultadoEyebrow: document.getElementById('resultado-eyebrow'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  botonReiniciar: document.getElementById('boton-reiniciar'),
  toast: document.getElementById('toast')
};

const estado = {
  dificultad: 'facil',
  partida: crearPartidaBuscaminas('facil'),
  celdasDom: [],
  modoBandera: false,
  segundos: 0,
  intervalo: null,
  festejado: false,
  pulsacion: null,
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
  elementos.botonNueva.addEventListener('click', () => iniciarNuevaPartida(estado.dificultad));
  elementos.botonReiniciar.addEventListener('click', () => iniciarNuevaPartida(estado.dificultad));
  elementos.botonModoBandera.addEventListener('click', alternarModoBandera);
  elementos.botonAyuda.addEventListener('click', abrirAyuda);
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.panelAyuda.addEventListener('click', (evento) => {
    if (evento.target === elementos.panelAyuda) {
      cerrarAyuda();
    }
  });

  // Al cambiar el tamano de la ventana recalculamos la celda, sin rearmar nada
  addEventListener('resize', ajustarLadoCelda);

  // El click derecho pone bandera y no abre el menu del navegador
  elementos.tablero.addEventListener('contextmenu', (evento) => {
    const celda = ubicarCelda(evento.target);

    if (!celda) {
      return;
    }

    evento.preventDefault();
    marcarCelda(celda.fila, celda.columna);
  });

  // Con puntero manejamos las dos cosas: el toque largo marca, el corto revela
  elementos.tablero.addEventListener('pointerdown', manejarPointerDown);
  elementos.tablero.addEventListener('pointerup', manejarPointerUp);
  elementos.tablero.addEventListener('pointercancel', cancelarPulsacion);
  elementos.tablero.addEventListener('pointerleave', cancelarPulsacion);

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !elementos.panelAyuda.hidden) {
      cerrarAyuda();
      return;
    }

    if (elementos.panelAyuda.hidden && evento.key.toLowerCase() === 'b') {
      alternarModoBandera();
    }
  });
}

function iniciarNuevaPartida(dificultadId) {
  // Si todavia esta cayendo el papel picado de la anterior, se corta
  cortarFestejo();

  estado.dificultad = dificultadId;
  estado.partida = crearPartidaBuscaminas(dificultadId);
  estado.modoBandera = false;
  estado.festejado = false;
  estado.segundos = 0;

  detenerReloj();
  construirTablero();
  elementos.panelResultado.hidden = true;
  renderizarTodo();
}

function manejarCambioDificultad(evento) {
  const boton = evento.target.closest('[data-dificultad]');

  if (boton && boton.dataset.dificultad !== estado.dificultad) {
    iniciarNuevaPartida(boton.dataset.dificultad);
  }
}

function manejarPointerDown(evento) {
  const celda = ubicarCelda(evento.target);

  if (!celda || evento.button === 2) {
    return;
  }

  cancelarPulsacion();
  estado.pulsacion = {
    fila: celda.fila,
    columna: celda.columna,
    yaMarco: false,
    temporizador: setTimeout(() => {
      estado.pulsacion.yaMarco = true;
      marcarCelda(celda.fila, celda.columna);
    }, MS_PULSACION_LARGA)
  };
}

function manejarPointerUp(evento) {
  const celda = ubicarCelda(evento.target);
  const pulsacion = estado.pulsacion;

  cancelarPulsacion();

  if (!celda || !pulsacion || evento.button === 2) {
    return;
  }

  // Si el dedo se movio a otra celda, no hacemos nada
  if (pulsacion.fila !== celda.fila || pulsacion.columna !== celda.columna || pulsacion.yaMarco) {
    return;
  }

  if (estado.modoBandera) {
    marcarCelda(celda.fila, celda.columna);
    return;
  }

  descubrirCelda(celda.fila, celda.columna);
}

function cancelarPulsacion() {
  if (estado.pulsacion) {
    clearTimeout(estado.pulsacion.temporizador);
    estado.pulsacion = null;
  }
}

function descubrirCelda(fila, columna) {
  if (estado.partida.fase !== 'jugando') {
    return;
  }

  arrancarRelojSiHaceFalta();

  const celda = estado.partida.tablero[fila][columna];
  // En una celda ya abierta el click intenta el chording
  const resultado = celda.revelada
    ? revelarVecinos(estado.partida, fila, columna)
    : revelarCelda(estado.partida, fila, columna);

  // El chording no hace nada si todavia faltan banderas: conviene avisarlo
  if (celda.revelada && !resultado.celdas.length && celda.adyacentes > 0) {
    mostrarToast(`Marca las ${celda.adyacentes} minas alrededor para descubrir el resto.`);
    return;
  }

  resultado.celdas.forEach((c) => pintarCelda(c.fila, c.columna));

  if (resultado.exploto) {
    terminarPartida(false);
    return;
  }

  if (resultado.gano) {
    terminarPartida(true);
    return;
  }

  renderizarMarcadores();
}

function marcarCelda(fila, columna) {
  if (estado.partida.fase !== 'jugando') {
    return;
  }

  arrancarRelojSiHaceFalta();

  if (alternarBandera(estado.partida, fila, columna).cambio) {
    pintarCelda(fila, columna);
    renderizarMarcadores();
  }
}

function abrirAyuda() {
  elementos.panelAyuda.hidden = false;
  elementos.botonCerrarAyuda.focus();
}

function cerrarAyuda() {
  elementos.panelAyuda.hidden = true;
  elementos.botonAyuda.focus();
}

function alternarModoBandera() {
  if (estado.partida.fase !== 'jugando') {
    return;
  }

  estado.modoBandera = !estado.modoBandera;
  renderizarModoBandera();
}

function terminarPartida(gano) {
  detenerReloj();
  revelarTableroCompleto(gano);
  renderizarMarcadores();

  const dificultad = obtenerDificultadBuscaminas(estado.dificultad);

  if (gano) {
    elementos.resultadoEyebrow.textContent = 'Tablero despejado';
    elementos.resultadoTitulo.textContent = 'Ganaste';
    elementos.resultadoTexto.textContent = `Despejaste el tablero ${dificultad.etiqueta.toLowerCase()} en ${formatearReloj(estado.segundos)}.`;

    if (!estado.festejado) {
      estado.festejado = true;
      festejar();
    }
  } else {
    elementos.resultadoEyebrow.textContent = 'Partida terminada';
    elementos.resultadoTitulo.textContent = 'Pisaste una mina';
    elementos.resultadoTexto.textContent = `Aguantaste ${formatearReloj(estado.segundos)} en dificultad ${dificultad.etiqueta.toLowerCase()}.`;
  }

  elementos.panelResultado.hidden = false;
  elementos.textoEstado.textContent = gano ? 'Ganaste la partida.' : 'Perdiste la partida.';
}

// Al perder se destapan TODAS las minas, incluidas las que ya tenian bandera,
// para que quede a la vista donde estaba cada una. Al ganar no hace falta.
function revelarTableroCompleto(gano) {
  if (!gano) {
    obtenerMinas(estado.partida).forEach(({ fila, columna }) => {
      estado.partida.tablero[fila][columna].revelada = true;
    });
  }

  // Repintamos entero: cambia el estilo de las minas marcadas y de las banderas
  // equivocadas, que recien ahora se saben equivocadas.
  recorrerTablero((_celda, fila, columna) => pintarCelda(fila, columna));
}

function construirTablero() {
  const { filas, columnas } = estado.partida;
  const lado = calcularLadoCelda(filas, columnas);

  elementos.tablero.style.setProperty('--lado', `${lado}px`);
  elementos.tablero.style.gridTemplateColumns = `repeat(${columnas}, var(--lado))`;
  elementos.tablero.innerHTML = '';
  estado.celdasDom = [];

  const fragmento = document.createDocumentFragment();

  for (let fila = 0; fila < filas; fila += 1) {
    const filaDom = [];

    for (let columna = 0; columna < columnas; columna += 1) {
      const boton = document.createElement('button');

      boton.type = 'button';
      boton.className = 'celda';
      boton.dataset.fila = String(fila);
      boton.dataset.columna = String(columna);
      boton.setAttribute('aria-label', `Fila ${fila + 1}, columna ${columna + 1}`);
      filaDom.push(boton);
      fragmento.appendChild(boton);
    }

    estado.celdasDom.push(filaDom);
  }

  elementos.tablero.appendChild(fragmento);
}

// El lado sale del espacio que sobra, descontando el padding del tablero y las
// separaciones entre celdas, para que el tablero entre completo y lo mas grande
// posible. En mobile el alto no limita porque el tablero puede scrollear.
function calcularLadoCelda(filas, columnas) {
  const esEscritorio = innerWidth > 1000;
  const anchoPanel = Math.min(1180, innerWidth - 28) - 44;
  const anchoCaja = esEscritorio
    ? anchoPanel - ANCHO_CONTROLES - SEPARACION_COLUMNAS
    : anchoPanel;

  const anchoUtil = anchoCaja - (PADDING_TABLERO * 2) - 2 - ((columnas - 1) * SEPARACION_CELDAS);
  const altoUtil = innerHeight - ALTO_RESERVADO - (PADDING_TABLERO * 2) - 2 - ((filas - 1) * SEPARACION_CELDAS);

  const porAncho = anchoUtil / columnas;
  const porAlto = esEscritorio ? altoUtil / filas : Infinity;

  return Math.max(LADO_MINIMO, Math.min(LADO_MAXIMO, Math.floor(Math.min(porAncho, porAlto))));
}

function ajustarLadoCelda() {
  const { filas, columnas } = estado.partida;
  elementos.tablero.style.setProperty('--lado', `${calcularLadoCelda(filas, columnas)}px`);
}

function pintarCelda(fila, columna) {
  const boton = estado.celdasDom[fila] && estado.celdasDom[fila][columna];

  if (!boton) {
    return;
  }

  const celda = estado.partida.tablero[fila][columna];
  const clases = ['celda'];
  let contenido = '';
  let descripcion = `Fila ${fila + 1}, columna ${columna + 1}`;

  if (estado.partida.fase !== 'jugando' && celda.bandera && !celda.mina) {
    clases.push('celda--abierta', 'celda--mal-marcada');
    contenido = `<img src="${RUTA_BANDERA}" alt="">`;
    descripcion += ', bandera equivocada';
  } else if (celda.revelada && celda.mina) {
    clases.push('celda--abierta');
    contenido = `<img src="${RUTA_MINA}" alt="">`;

    if (esCeldaExplotada(fila, columna)) {
      clases.push('celda--explotada');
      descripcion += ', la mina que pisaste';
    } else if (celda.bandera) {
      clases.push('celda--mina-marcada');
      descripcion += ', mina que habias marcado bien';
    } else {
      descripcion += ', mina';
    }
  } else if (celda.revelada) {
    clases.push('celda--abierta');

    if (celda.adyacentes > 0) {
      clases.push(`celda--n${celda.adyacentes}`);
      contenido = String(celda.adyacentes);
      descripcion += `, ${celda.adyacentes} minas alrededor`;
    } else {
      descripcion += ', vacia';
    }
  } else if (celda.bandera) {
    contenido = `<img src="${RUTA_BANDERA}" alt="">`;
    descripcion += ', con bandera';
  } else {
    descripcion += ', sin descubrir';
  }

  boton.className = clases.join(' ');
  boton.innerHTML = contenido;
  boton.setAttribute('aria-label', descripcion);
}

function esCeldaExplotada(fila, columna) {
  const explotada = estado.partida.celdaExplotada;

  return Boolean(explotada) && explotada.fila === fila && explotada.columna === columna;
}

function renderizarTodo() {
  renderizarDificultad();
  renderizarModoBandera();
  renderizarMarcadores();
  recorrerTablero((_celda, fila, columna) => pintarCelda(fila, columna));
}

function renderizarDificultad() {
  elementos.grupoDificultades.querySelectorAll('[data-dificultad]').forEach((boton) => {
    boton.classList.toggle('is-active', boton.dataset.dificultad === estado.dificultad);
  });
}

function renderizarModoBandera() {
  elementos.botonModoBandera.classList.toggle('is-activa', estado.modoBandera);
  elementos.botonModoBandera.setAttribute('aria-pressed', estado.modoBandera ? 'true' : 'false');
  elementos.estadoModoBandera.textContent = estado.modoBandera ? 'ON' : 'OFF';
}

function renderizarMarcadores() {
  elementos.textoMinas.textContent = String(contarMinasRestantes(estado.partida));
  elementos.textoReloj.textContent = formatearReloj(estado.segundos);
}

function arrancarRelojSiHaceFalta() {
  if (estado.intervalo !== null) {
    return;
  }

  estado.intervalo = setInterval(() => {
    estado.segundos += 1;
    elementos.textoReloj.textContent = formatearReloj(estado.segundos);
  }, 1000);
}

function detenerReloj() {
  if (estado.intervalo !== null) {
    clearInterval(estado.intervalo);
    estado.intervalo = null;
  }
}

function formatearReloj(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

function ubicarCelda(elemento) {
  const boton = elemento.closest && elemento.closest('[data-fila][data-columna]');

  if (!boton) {
    return null;
  }

  return { fila: Number(boton.dataset.fila), columna: Number(boton.dataset.columna) };
}

function recorrerTablero(accion) {
  for (let fila = 0; fila < estado.partida.filas; fila += 1) {
    for (let columna = 0; columna < estado.partida.columnas; columna += 1) {
      accion(estado.partida.tablero[fila][columna], fila, columna);
    }
  }
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 2600);
}
