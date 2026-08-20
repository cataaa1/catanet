// Carrera de Sudoku: mismo tablero para todos, gana quien lo resuelve primero.
//
// El servidor es el arbitro: guarda el tablero de cada persona, cuenta cuantas
// celdas coinciden con la solucion y decide quien termino. El cliente dibuja y
// manda jugadas, pero no sabe la solucion hasta que la carrera termina.
import {
  crearIdCelda,
  esCeldaEditable,
  obtenerConflictos,
  obtenerRelacionCelda,
  stringATablero
} from '/shared/sudoku.js';
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const SERVIDOR_URL = window.location.origin;
const CELDAS_SIN_MINA = 81;

const socket = io(SERVIDOR_URL);

const elementos = {
  panelInicio: document.getElementById('panel-inicio'),
  panelJuego: document.getElementById('panel-juego'),
  panelResultado: document.getElementById('panel-resultado'),
  grupoDificultades: document.getElementById('grupo-dificultades'),
  botonCrear: document.getElementById('boton-crear'),
  botonUnirse: document.getElementById('boton-unirse'),
  inputSala: document.getElementById('input-sala'),
  botonCopiar: document.getElementById('boton-copiar'),
  botonesRevancha: [
    document.getElementById('boton-revancha'),
    document.getElementById('boton-revancha-modal')
  ],
  textoSala: document.getElementById('texto-sala'),
  textoEstado: document.getElementById('texto-estado'),
  ranking: document.getElementById('ranking'),
  tablero: document.getElementById('tablero'),
  velo: document.getElementById('velo-generando'),
  textoVelo: document.getElementById('texto-velo'),
  numpad: document.getElementById('numpad'),
  botonBorrar: document.getElementById('boton-borrar'),
  botonBorrador: document.getElementById('boton-borrador'),
  estadoBorrador: document.getElementById('estado-borrador'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  toast: document.getElementById('toast')
};

const estado = {
  salaId: obtenerSalaDesdeUrl(),
  link: '',
  dificultad: 'medio',
  partida: null,
  tableroInicial: crearTableroVacio(),
  tableroActual: crearTableroVacio(),
  celdaSeleccionada: null,
  notas: crearNotasVacias(),
  modoBorrador: false,
  conflictos: new Set(),
  festejado: false,
  toastTimeout: null
};

inicializar();

function inicializar() {
  habilitarCierreResultado();
  enlazarEventos();
  enlazarSocket();
  renderizarTablero();

  if (estado.salaId) {
    elementos.inputSala.value = estado.salaId;
    unirse();
  }
}

function enlazarEventos() {
  elementos.botonCrear.addEventListener('click', () => {
    socket.emit('sudoku-crear-sala', { dificultad: estado.dificultad });
  });
  elementos.botonUnirse.addEventListener('click', unirse);
  elementos.inputSala.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      unirse();
    }
  });

  elementos.grupoDificultades.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-dificultad]');

    if (!boton) {
      return;
    }

    estado.dificultad = boton.dataset.dificultad;
    elementos.grupoDificultades.querySelectorAll('[data-dificultad]').forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.dificultad === estado.dificultad);
    });
  });

  elementos.botonCopiar.addEventListener('click', copiarLink);
  elementos.botonesRevancha.forEach((boton) => {
    boton.addEventListener('click', () => {
      socket.emit('sudoku-reiniciar', { salaId: estado.salaId });
    });
  });

  elementos.tablero.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-fila][data-columna]');

    if (!boton) {
      return;
    }

    estado.celdaSeleccionada = {
      fila: Number(boton.dataset.fila),
      columna: Number(boton.dataset.columna)
    };
    renderizarTablero();
  });

  elementos.numpad.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-valor]');

    if (boton) {
      jugar(boton.dataset.valor);
    }
  });
  elementos.botonBorrar.addEventListener('click', () => jugar(''));
  elementos.botonBorrador.addEventListener('click', alternarBorrador);

  document.addEventListener('keydown', (evento) => {
    if (/^[1-9]$/.test(evento.key)) {
      evento.preventDefault();
      jugar(evento.key);
      return;
    }

    if (evento.key === 'Backspace' || evento.key === 'Delete' || evento.key === '0') {
      evento.preventDefault();
      jugar('');
      return;
    }

    if (evento.key.toLowerCase() === 'n') {
      evento.preventDefault();
      alternarBorrador();
      return;
    }

    if (evento.key.startsWith('Arrow')) {
      evento.preventDefault();
      moverSeleccion(evento.key);
    }
  });
}

function enlazarSocket() {
  socket.on('sudoku-sala-creada', ({ salaId, link, estado: nuevo }) => {
    estado.salaId = salaId;
    estado.link = link;
    mostrarPanelJuego();
    aplicarEstado(nuevo);
    mostrarToast('Sala creada. Compartí el link para que se sumen.');
  });

  socket.on('sudoku-estado', ({ estado: nuevo }) => {
    mostrarPanelJuego();
    aplicarEstado(nuevo);
  });

  socket.on('sudoku-partida-iniciada', ({ estado: nuevo }) => {
    estado.festejado = false;
    estado.notas = crearNotasVacias();
    elementos.panelResultado.hidden = true;
    mostrarPanelJuego();
    aplicarEstado(nuevo);
    mostrarToast('Arranco la carrera.');
  });

  socket.on('sudoku-jugada-registrada', ({ estado: nuevo }) => {
    aplicarEstado(nuevo);
  });

  socket.on('sudoku-partida-terminada', (datos) => {
    aplicarEstado(datos.estado);
    mostrarResultado(datos);
  });

  socket.on('sudoku-jugador-desconectado', () => {
    mostrarToast('Alguien se desconecto de la sala.');
  });

  socket.on('sudoku-sala-cerrada', () => {
    mostrarToast('La sala se cerro.');
  });

  socket.on('error-sala', ({ mensaje }) => {
    mostrarToast(mensaje || 'Ocurrio un error en la sala.');
  });

  socket.on('disconnect', () => {
    mostrarToast('Se corto la conexion con el servidor.');
  });
}

function unirse() {
  const salaId = (elementos.inputSala.value || estado.salaId || '').trim().toLowerCase();

  if (!salaId) {
    mostrarToast('Escribi el codigo de la sala.');
    return;
  }

  estado.salaId = salaId;
  socket.emit('sudoku-unirse-sala', { salaId });
}

function copiarLink() {
  const link = estado.link || `${SERVIDOR_URL}${location.pathname}?sala=${estado.salaId}`;

  navigator.clipboard.writeText(link)
    .then(() => mostrarToast('Link copiado.'))
    .catch(() => mostrarToast(link));
}

function aplicarEstado(nuevo) {
  if (!nuevo) {
    return;
  }

  estado.partida = nuevo;
  elementos.textoSala.textContent = nuevo.salaId || '----';

  if (nuevo.puzzle) {
    estado.tableroInicial = stringATablero(nuevo.puzzle);
  }

  if (nuevo.tablero) {
    estado.tableroActual = nuevo.tablero.map((fila) => fila.slice());
    estado.conflictos = obtenerConflictos(estado.tableroActual);

    if (!estado.celdaSeleccionada) {
      estado.celdaSeleccionada = buscarPrimeraEditable();
    }
  }

  renderizarVelo(nuevo);
  renderizarRanking(nuevo);
  renderizarTablero();

  elementos.botonesRevancha.forEach((boton) => {
    boton.hidden = nuevo.fase !== 'terminada';
  });
}


// El borrador no es una ayuda: no te dice nada que no supieras, solo te deja
// anotar tu propio razonamiento en vez de sostenerlo de memoria.
function alternarBorrador() {
  estado.modoBorrador = !estado.modoBorrador;
  elementos.botonBorrador.classList.toggle('is-activa', estado.modoBorrador);
  elementos.botonBorrador.setAttribute('aria-pressed', estado.modoBorrador ? 'true' : 'false');
  elementos.estadoBorrador.textContent = estado.modoBorrador ? 'ON' : 'OFF';
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

function renderizarVelo(nuevo) {
  if (nuevo.fase === 'esperando') {
    elementos.velo.hidden = false;
    elementos.textoVelo.textContent = 'Esperando a que se sume alguien mas...';
    return;
  }

  if (nuevo.fase === 'generando') {
    elementos.velo.hidden = false;
    elementos.textoVelo.textContent = 'Armando el tablero de la carrera...';
    return;
  }

  elementos.velo.hidden = true;
}

function renderizarRanking(nuevo) {
  const ordenados = [...nuevo.jugadores].sort((a, b) => b.correctas - a.correctas);

  elementos.ranking.innerHTML = ordenados.map((jugador) => {
    const porcentaje = Math.round((jugador.correctas / CELDAS_SIN_MINA) * 100);
    const nombre = jugador.soyYo ? 'Vos' : `Jugador ${jugador.numero}`;
    const corona = jugador.id === nuevo.ganador ? ' <span class="corona">ganó</span>' : '';

    return `
      <article class="corredor${jugador.soyYo ? ' corredor--yo' : ''}${jugador.conectado ? '' : ' corredor--fuera'}">
        <span class="corredor__color" style="background:${jugador.color}"></span>
        <span class="corredor__nombre">${nombre}${corona}</span>
        <span class="corredor__barra"><span style="width:${porcentaje}%;background:${jugador.color}"></span></span>
        <span class="corredor__dato">${jugador.correctas}/81</span>
      </article>
    `;
  }).join('');
}

function jugar(valor) {
  if (!estado.partida || estado.partida.fase !== 'jugando' || !estado.celdaSeleccionada) {
    return;
  }

  const { fila, columna } = estado.celdaSeleccionada;

  if (!esCeldaEditable(estado.tableroInicial, fila, columna)) {
    mostrarToast('Esa celda ya venia fija en el tablero.');
    return;
  }

  // Las anotaciones son cosa de cada quien: no viajan al servidor
  if (estado.modoBorrador && valor) {
    anotar(fila, columna, valor);
    renderizarTablero();
    return;
  }

  // Pintamos al toque y el servidor confirma con el estado que vuelve
  estado.tableroActual[fila][columna] = /^[1-9]$/.test(valor) ? valor : '';
  estado.notas[fila][columna] = [];
  estado.conflictos = obtenerConflictos(estado.tableroActual);
  renderizarTablero();

  socket.emit('sudoku-jugada', { salaId: estado.salaId, fila, columna, valor });
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

function mostrarResultado(datos) {
  const gane = datos.ganador === socket.id;

  elementos.resultadoTitulo.textContent = gane ? 'Ganaste la carrera' : 'Te ganaron de mano';
  elementos.resultadoTexto.textContent = gane
    ? 'Completaste el tablero antes que nadie.'
    : 'Alguien completo el tablero primero. Pedi otra y revancha.';
  elementos.panelResultado.hidden = false;
  elementos.textoEstado.textContent = gane ? 'Ganaste la carrera.' : 'La carrera termino.';

  if (gane && !estado.festejado) {
    estado.festejado = true;
    festejar();
  }
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

      if (estado.conflictos.has(crearIdCelda(fila, columna))) {
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

function mostrarPanelJuego() {
  elementos.panelInicio.hidden = true;
  elementos.panelJuego.hidden = false;
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

function crearTableroVacio() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ''));
}

function obtenerSalaDesdeUrl() {
  return (new URLSearchParams(location.search).get('sala') || '').trim().toLowerCase();
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estado.toastTimeout);
  estado.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 3000);
}
