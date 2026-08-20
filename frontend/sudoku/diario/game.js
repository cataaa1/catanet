// Sudoku diario: el mismo tablero para todo el mundo, generado en el servidor.
//
// A proposito no tiene pistas ni deshacer: si la idea es comparar tiempos sobre
// el mismo tablero, esas ayudas arruinan la comparacion. El lapiz si esta,
// porque no te dice nada que no supieras: solo te evita sostenerlo de memoria.
// Hay tres errores permitidos, y el progreso se guarda en el navegador.
import {
  actualizarCelda,
  crearIdCelda,
  esCeldaEditable,
  estaSudokuResuelto,
  obtenerConflictos,
  obtenerRelacionCelda,
  stringATablero
} from '/shared/sudoku.js';
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const MS_ENTRE_INTENTOS = 1500;
const MAXIMO_INTENTOS = 60;
const MAXIMO_ERRORES = 3;
const CLAVE_GUARDADO = 'catanet:sudoku-diario';

const elementos = {
  tablero: document.getElementById('tablero'),
  velo: document.getElementById('velo-generando'),
  textoVelo: document.getElementById('texto-velo'),
  textoFecha: document.getElementById('texto-fecha'),
  textoReloj: document.getElementById('texto-reloj'),
  textoEstado: document.getElementById('texto-estado'),
  numpad: document.getElementById('numpad'),
  botonBorrar: document.getElementById('boton-borrar'),
  botonLapiz: document.getElementById('boton-lapiz'),
  estadoLapiz: document.getElementById('estado-lapiz'),
  textoErrores: document.getElementById('texto-errores'),
  botonAyuda: document.getElementById('boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  panelAyuda: document.getElementById('panel-ayuda'),
  panelResultado: document.getElementById('panel-resultado'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  toast: document.getElementById('toast')
};

const estado = {
  fecha: '',
  tableroInicial: crearTableroVacio(),
  tableroActual: crearTableroVacio(),
  tableroResuelto: crearTableroVacio(),
  celdaSeleccionada: null,
  notas: crearNotasVacias(),
  modoLapiz: false,
  errores: 0,
  celdasErradas: new Set(),
  conflictos: new Set(),
  listo: false,
  resuelto: false,
  perdido: false,
  festejado: false,
  segundos: 0,
  intervalo: null,
  toastTimeout: null
};

inicializar();

function inicializar() {
  habilitarCierreResultado();
  enlazarEventos();
  renderizarTablero();
  cargarDesafio();
}

function enlazarEventos() {
  elementos.tablero.addEventListener('click', manejarClickTablero);
  elementos.numpad.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-valor]');

    if (boton) {
      escribir(boton.dataset.valor);
    }
  });
  elementos.botonBorrar.addEventListener('click', () => escribir(''));
  elementos.botonLapiz.addEventListener('click', alternarLapiz);

  elementos.botonAyuda.addEventListener('click', () => {
    elementos.panelAyuda.hidden = false;
  });
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.panelAyuda.addEventListener('click', (evento) => {
    if (evento.target === elementos.panelAyuda) {
      cerrarAyuda();
    }
  });

  document.addEventListener('keydown', manejarTeclado);
}

// El servidor puede tardar en generar el tablero experto, asi que contesta que
// todavia no esta y volvemos a preguntar en vez de dejar la peticion colgada.
async function cargarDesafio() {
  for (let intento = 0; intento < MAXIMO_INTENTOS; intento += 1) {
    try {
      const respuesta = await fetch('/api/sudoku/diario');
      const datos = await respuesta.json();

      if (datos.listo) {
        empezarDesafio(datos);
        return;
      }

      estado.fecha = datos.fecha || '';
      elementos.textoFecha.textContent = formatearFecha(estado.fecha);
      elementos.textoVelo.textContent = 'Preparando el tablero de hoy...';
    } catch (error) {
      elementos.textoVelo.textContent = 'No pude conectarme. Reintentando...';
      console.error(error);
    }

    await esperar(MS_ENTRE_INTENTOS);
  }

  elementos.textoVelo.textContent = 'No pude traer el tablero de hoy. Recarga la pagina.';
}

function empezarDesafio(datos) {
  estado.fecha = datos.fecha;
  estado.tableroInicial = stringATablero(datos.puzzle);
  estado.tableroActual = stringATablero(datos.puzzle);
  estado.tableroResuelto = stringATablero(datos.solucion);
  estado.celdaSeleccionada = buscarPrimeraEditable();
  estado.listo = true;

  retomarGuardado();

  elementos.textoFecha.textContent = formatearFecha(datos.fecha);
  elementos.velo.hidden = true;

  if (!estado.resuelto && !estado.perdido) {
    arrancarReloj();
  }

  renderizarTodo();
}

function manejarClickTablero(evento) {
  const boton = evento.target.closest('[data-fila][data-columna]');

  if (!boton || !estado.listo) {
    return;
  }

  estado.celdaSeleccionada = {
    fila: Number(boton.dataset.fila),
    columna: Number(boton.dataset.columna)
  };

  renderizarTablero();
}

function manejarTeclado(evento) {
  if (evento.key === 'Escape' && !elementos.panelAyuda.hidden) {
    cerrarAyuda();
    return;
  }

  if (!estado.listo || estado.resuelto || estado.perdido || !elementos.panelAyuda.hidden) {
    return;
  }

  if (/^[1-9]$/.test(evento.key)) {
    evento.preventDefault();
    escribir(evento.key);
    return;
  }

  if (evento.key === 'Backspace' || evento.key === 'Delete' || evento.key === '0') {
    evento.preventDefault();
    escribir('');
    return;
  }

  if (evento.key.toLowerCase() === 'n') {
    evento.preventDefault();
    alternarLapiz();
    return;
  }

  if (evento.key.startsWith('Arrow')) {
    evento.preventDefault();
    moverSeleccion(evento.key);
  }
}

function escribir(valor) {
  if (!estado.listo || estado.resuelto || estado.perdido || !estado.celdaSeleccionada) {
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Esa celda ya venia fija en el tablero.');
    return;
  }

  // Con el lapiz el digito va a las anotaciones y la celda queda vacia
  if (estado.modoLapiz && valor) {
    anotar(fila, columna, valor);
    estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, '');
    estado.conflictos = obtenerConflictos(estado.tableroActual);
    renderizarTodo();
    guardar();
    return;
  }

  const idCelda = crearIdCelda(fila, columna);

  estado.tableroActual = actualizarCelda(estado.tableroActual, fila, columna, valor);
  estado.notas[fila][columna] = [];
  estado.conflictos = obtenerConflictos(estado.tableroActual);
  estado.celdasErradas.delete(idCelda);

  // Como el servidor manda la solucion, sabemos al toque si el numero va o no
  const seEquivoco = Boolean(valor) && valor !== estado.tableroResuelto[fila][columna];

  if (seEquivoco) {
    estado.errores += 1;
    estado.celdasErradas.add(idCelda);
  }

  if (!seEquivoco && !estado.conflictos.size
    && estaSudokuResuelto(estado.tableroActual, estado.tableroResuelto)) {
    terminar();
  } else if (estado.errores >= MAXIMO_ERRORES) {
    perder();
  }

  renderizarTodo();
  guardar();
}

function moverSeleccion(tecla) {
  const actual = estado.celdaSeleccionada || { fila: 0, columna: 0 };
  const delta = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  }[tecla];

  if (!delta) {
    return;
  }

  estado.celdaSeleccionada = {
    fila: (actual.fila + delta[0] + 9) % 9,
    columna: (actual.columna + delta[1] + 9) % 9
  };

  renderizarTablero();
}

function perder() {
  estado.perdido = true;
  detenerReloj();

  elementos.resultadoTitulo.textContent = 'Te quedaste sin vidas';
  elementos.resultadoTexto.textContent = `Se acabaron los ${MAXIMO_ERRORES} errores. Manana hay un tablero nuevo.`;
  elementos.panelResultado.hidden = false;
  elementos.textoEstado.textContent = 'Perdiste el desafio de hoy.';
}

function terminar() {
  estado.resuelto = true;
  detenerReloj();

  elementos.resultadoTitulo.textContent = 'Lo resolviste';
  elementos.resultadoTexto.textContent = `Resolviste el tablero de hoy en ${formatearReloj(estado.segundos)} con ${estado.errores} error${estado.errores === 1 ? '' : 'es'}. Manana hay uno nuevo.`;
  elementos.panelResultado.hidden = false;
  elementos.textoEstado.textContent = 'Tablero resuelto.';

  if (!estado.festejado) {
    estado.festejado = true;
    festejar();
  }
}


// El lapiz no es una ayuda: no te dice nada que no supieras, solo te deja
// anotar tu propio razonamiento en vez de sostenerlo de memoria.
function alternarLapiz() {
  estado.modoLapiz = !estado.modoLapiz;
  elementos.botonLapiz.classList.toggle('is-activa', estado.modoLapiz);
  elementos.botonLapiz.setAttribute('aria-pressed', estado.modoLapiz ? 'true' : 'false');
  elementos.estadoLapiz.textContent = estado.modoLapiz ? 'ON' : 'OFF';
}

function anotar(fila, columna, valor) {
  const anotadas = estado.notas[fila][columna];

  estado.notas[fila][columna] = anotadas.includes(valor)
    ? anotadas.filter((nota) => nota !== valor)
    : [...anotadas, valor].sort();
}

function crearNotasVacias() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
}

function dibujarNotas(notas) {
  if (!notas.length) {
    return '';
  }

  const celdas = Array.from({ length: 9 }, (_, indice) => {
    const digito = String(indice + 1);

    return `<span class="celda__nota">${notas.includes(digito) ? digito : ''}</span>`;
  }).join('');

  return `<span class="celda__notas">${celdas}</span>`;
}

function renderizarTodo() {
  renderizarTablero();
  elementos.textoErrores.textContent = `${estado.errores} / ${MAXIMO_ERRORES}`;
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
    Array.from({ length: 9 }, (_, columna) => {
      const valor = estado.tableroActual[fila][columna];
      const clases = ['celda'];

      clases.push(esCeldaEditable(estado.tableroInicial, fila, columna) ? 'celda--editable' : 'celda--fija');

      if (relacionadas.has(crearIdCelda(fila, columna))) {
        clases.push('celda--relacionada');
      }

      if (valor && valorSeleccionado && valor === valorSeleccionado) {
        clases.push('celda--igual');
      }

      if (seleccion && seleccion.fila === fila && seleccion.columna === columna) {
        clases.push('celda--seleccionada');
      }

      if (estado.celdasErradas.has(crearIdCelda(fila, columna))) {
        clases.push('celda--error');
      } else if (estado.conflictos.has(crearIdCelda(fila, columna))) {
        clases.push('celda--conflicto');
      }

      if (columna === 2 || columna === 5) {
        clases.push('celda--borde-derecho');
      }

      if (fila === 2 || fila === 5) {
        clases.push('celda--borde-inferior');
      }

      return `<button type="button" class="${clases.join(' ')}" data-fila="${fila}" data-columna="${columna}"
        aria-label="Fila ${fila + 1}, columna ${columna + 1}, ${valor || 'vacia'}">${valor || dibujarNotas(estado.notas[fila][columna])}</button>`;
    }).join('')
  )).join('');
}

function arrancarReloj() {
  detenerReloj();
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

function cerrarAyuda() {
  elementos.panelAyuda.hidden = true;
}

function formatearReloj(segundos) {
  const minutos = Math.floor(segundos / 60);

  return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

// 'AAAA-MM-DD' se arma a mano para no depender de la zona horaria del navegador
function formatearFecha(fecha) {
  if (!fecha) {
    return 'Cargando...';
  }

  const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const [anio, mes, dia] = fecha.split('-');

  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`;
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

/**
 * Guarda la partida del dia en el navegador. Un tablero experto lleva su rato y
 * nadie lo resuelve de una sentada: si se pierde al cerrar la pestana, no sirve.
 */
function guardar() {
  try {
    localStorage.setItem(`${CLAVE_GUARDADO}:${estado.fecha}`, JSON.stringify({
      tablero: estado.tableroActual,
      notas: estado.notas,
      errores: estado.errores,
      erradas: [...estado.celdasErradas],
      segundos: estado.segundos,
      resuelto: estado.resuelto,
      perdido: estado.perdido
    }));
  } catch (error) {
    // Sin localStorage (modo privado, por ejemplo) se juega igual, sin guardar
    console.warn('No pude guardar el progreso:', error.message);
  }
}

function retomarGuardado() {
  limpiarGuardadosViejos();

  let guardado = null;

  try {
    guardado = JSON.parse(localStorage.getItem(`${CLAVE_GUARDADO}:${estado.fecha}`));
  } catch (error) {
    return;
  }

  if (!guardado || !Array.isArray(guardado.tablero)) {
    return;
  }

  estado.tableroActual = guardado.tablero.map((fila) => fila.slice());
  estado.notas = Array.isArray(guardado.notas) ? guardado.notas : crearNotasVacias();
  estado.errores = guardado.errores || 0;
  estado.celdasErradas = new Set(guardado.erradas || []);
  estado.segundos = guardado.segundos || 0;
  estado.resuelto = Boolean(guardado.resuelto);
  estado.perdido = Boolean(guardado.perdido);
  estado.conflictos = obtenerConflictos(estado.tableroActual);

  elementos.textoReloj.textContent = formatearReloj(estado.segundos);

  if (estado.resuelto) {
    terminar();
  } else if (estado.perdido) {
    perder();
  }
}

// El tablero de ayer ya no le sirve a nadie
function limpiarGuardadosViejos() {
  try {
    Object.keys(localStorage)
      .filter((clave) => clave.startsWith(CLAVE_GUARDADO) && !clave.endsWith(estado.fecha))
      .forEach((clave) => localStorage.removeItem(clave));
  } catch (error) {
    console.warn('No pude limpiar los tableros viejos:', error.message);
  }
}

function crearTableroVacio() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ''));
}

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 2600);
}
