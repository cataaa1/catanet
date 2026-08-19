import { festejar } from '/shared/celebracion.js';

const SERVIDOR_URL = window.location.origin;
const LONGITUD_PALABRA_POR_DEFECTO = 5;
const MAXIMO_INTENTOS_POR_DEFECTO = 6;
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR']
];
const PRIORIDAD_TECLA = {
  ausente: 1,
  presente: 2,
  correcto: 3
};

const socket = io(SERVIDOR_URL);

const elementos = {
  app: document.querySelector('.app'),
  botonVolverInicio: document.getElementById('boton-volver-inicio'),
  panelInicio: document.getElementById('panel-inicio'),
  panelJuego: document.getElementById('panel-juego'),
  inputSala: document.getElementById('input-sala'),
  botonCrear: document.getElementById('boton-crear'),
  botonUnirse: document.getElementById('boton-unirse'),
  botonCopiar: document.getElementById('boton-copiar'),
  botonesAyuda: document.querySelectorAll('.boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  botonReiniciar: document.getElementById('boton-reiniciar'),
  botonVolverHubResultado: document.getElementById('boton-volver-hub-resultado'),
  textoSala: document.getElementById('texto-sala'),
  textoEstado: document.getElementById('texto-estado'),
  panelJugadores: document.getElementById('panel-jugadores'),
  tablero: document.getElementById('tablero'),
  teclado: document.getElementById('teclado'),
  panelResultado: document.getElementById('panel-resultado'),
  panelAyuda: document.getElementById('panel-ayuda'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  toast: document.getElementById('toast')
};

const estadoCliente = {
  salaId: obtenerSalaDesdeUrl(),
  linkCompartir: '',
  estadoPartida: null,
  intentoActual: '',
  tipeoOponente: '',
  resultadoFinal: null,
  toastTimeout: null,
  unionAutomaticaPendiente: false,
  festejado: false
};

inicializar();

function inicializar() {
  construirTeclado();
  enlazarEventos();

  if (estadoCliente.salaId) {
    elementos.inputSala.value = estadoCliente.salaId;
    estadoCliente.unionAutomaticaPendiente = true;
    mostrarPanelJuego();
    mostrarEstado('Conectando a la sala...');
  } else {
    mostrarPanelInicio();
  }

  if (socket.connected && estadoCliente.unionAutomaticaPendiente && estadoCliente.salaId) {
    socket.emit('unirse-sala', { salaId: estadoCliente.salaId });
    estadoCliente.unionAutomaticaPendiente = false;
  }

  renderizarTodo();
}

function enlazarEventos() {
  elementos.botonCrear.addEventListener('click', crearSala);
  elementos.botonUnirse.addEventListener('click', unirseASalaManual);
  elementos.botonCopiar.addEventListener('click', copiarLinkCompartir);
  elementos.botonesAyuda.forEach((boton) => {
    boton.addEventListener('click', abrirAyuda);
  });
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.panelAyuda.addEventListener('click', cerrarAyudaDesdeFondo);
  elementos.botonReiniciar.addEventListener('click', reiniciarSalaActual);
  elementos.botonVolverHubResultado.addEventListener('click', volverAlHubDesdeResultado);
  elementos.inputSala.addEventListener('input', (evento) => {
    evento.target.value = normalizarSalaId(evento.target.value);
  });
  document.addEventListener('keydown', manejarTecladoFisico);

  socket.on('connect', () => {
    if (estadoCliente.unionAutomaticaPendiente && estadoCliente.salaId) {
      socket.emit('unirse-sala', { salaId: estadoCliente.salaId });
      estadoCliente.unionAutomaticaPendiente = false;
    }

    renderizarTodo();
  });

  socket.on('disconnect', () => {
    mostrarToast('Se perdio la conexion con el servidor. Intentando reconectar...');
    renderizarTodo();
  });

  socket.on('sala-creada', ({ salaId, link, estado }) => {
    estadoCliente.salaId = salaId;
    estadoCliente.linkCompartir = link;
    estadoCliente.estadoPartida = estado || null;
    estadoCliente.resultadoFinal = null;
    estadoCliente.intentoActual = '';
    estadoCliente.tipeoOponente = '';

    actualizarUrlSala(salaId);
    mostrarPanelJuego();
    mostrarEstado('Sala creada. Comparti el link y espera a la otra persona.');
    renderizarTodo();
  });

  socket.on('partida-iniciada', ({ estado }) => {
    estadoCliente.estadoPartida = estado;
    estadoCliente.resultadoFinal = null;
    estadoCliente.tipeoOponente = '';
    estadoCliente.festejado = false;

    if (!estadoCliente.linkCompartir && estadoCliente.salaId) {
      estadoCliente.linkCompartir = construirLinkCompartir(estadoCliente.salaId);
    }

    mostrarPanelJuego();
    renderizarTodo();
  });

  socket.on('intento-registrado', ({ estado }) => {
    estadoCliente.estadoPartida = estado;
    estadoCliente.intentoActual = '';
    estadoCliente.tipeoOponente = '';
    renderizarTodo();
  });

  socket.on('oponente-tipeando', ({ letras }) => {
    estadoCliente.tipeoOponente = letras || '';
    renderizarTodo();
  });

  socket.on('partida-terminada', (resultado) => {
    estadoCliente.resultadoFinal = resultado;

    if (resultado.estado) {
      estadoCliente.estadoPartida = resultado.estado;
    }

    estadoCliente.intentoActual = '';
    estadoCliente.tipeoOponente = '';
    renderizarTodo();
  });

  socket.on('jugador-desconectado', () => {
    mostrarToast('La otra persona se desconecto. La sala queda pausada por 60 segundos.');

    if (estadoCliente.estadoPartida) {
      estadoCliente.estadoPartida.fase = 'pausada';
      renderizarTodo();
    }
  });

  socket.on('sala-cerrada', ({ jugadorId }) => {
    if (jugadorId === socket.id) {
      window.location.href = '/hub/';
      return;
    }

    volverAlMenuPrincipal('La otra persona volvio al hub. La sala se cerro.');
  });

  socket.on('error-sala', ({ mensaje }) => {
    mostrarToast(mensaje || 'Ocurrio un error con la sala.');
  });
}

function crearSala() {
  socket.emit('crear-sala');
}

function unirseASalaManual() {
  const salaId = normalizarSalaId(elementos.inputSala.value);

  if (!salaId) {
    mostrarToast('Escribi un codigo de sala valido.');
    return;
  }

  estadoCliente.salaId = salaId;
  estadoCliente.linkCompartir = construirLinkCompartir(salaId);
  estadoCliente.resultadoFinal = null;
  estadoCliente.intentoActual = '';
  estadoCliente.tipeoOponente = '';

  actualizarUrlSala(salaId);
  mostrarPanelJuego();
  mostrarEstado('Uniendote a la sala...');
  renderizarTodo();

  socket.emit('unirse-sala', { salaId });
}

function copiarLinkCompartir() {
  const link = estadoCliente.linkCompartir || construirLinkCompartir(estadoCliente.salaId);

  if (!link) {
    mostrarToast('Todavia no hay link para copiar.');
    return;
  }

  navigator.clipboard.writeText(link)
    .then(() => mostrarToast('Link copiado al portapapeles.'))
    .catch(() => mostrarToast('No pude copiar el link automaticamente.'));
}

function reiniciarSalaActual() {
  if (!estadoCliente.salaId) {
    return;
  }

  socket.emit('reiniciar-sala', { salaId: estadoCliente.salaId });
  estadoCliente.resultadoFinal = null;
  mostrarEstado('Preparando revancha...');
}

function volverAlHubDesdeResultado(evento) {
  evento.preventDefault();

  if (!estadoCliente.salaId || !socket.connected) {
    window.location.href = '/hub/';
    return;
  }

  socket.emit('cerrar-sala', { salaId: estadoCliente.salaId });

  setTimeout(() => {
    window.location.href = '/hub/';
  }, 500);
}

function abrirAyuda() {
  elementos.panelAyuda.hidden = false;
  elementos.botonCerrarAyuda.focus();
}

function cerrarAyuda() {
  elementos.panelAyuda.hidden = true;
}

function cerrarAyudaDesdeFondo(evento) {
  if (evento.target === elementos.panelAyuda) {
    cerrarAyuda();
  }
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

  if (!elementos.panelAyuda.hidden) {
    return;
  }

  if (elementos.panelJuego.hidden || !esMiTurno()) {
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

function manejarTeclaVirtual(tecla) {
  if (!esMiTurno()) {
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
  const longitudPalabra = obtenerLongitudPalabra();

  if (estadoCliente.intentoActual.length >= longitudPalabra) {
    return;
  }

  estadoCliente.intentoActual += letra;
  emitirTipeo();
  renderizarTodo();
}

function borrarLetra() {
  if (!estadoCliente.intentoActual.length) {
    return;
  }

  estadoCliente.intentoActual = estadoCliente.intentoActual.slice(0, -1);
  emitirTipeo();
  renderizarTodo();
}

function confirmarIntento() {
  const longitudPalabra = obtenerLongitudPalabra();

  if (estadoCliente.intentoActual.length !== longitudPalabra) {
    mostrarToast(`La palabra debe tener ${longitudPalabra} letras.`);
    return;
  }

  socket.emit('enviar-intento', {
    salaId: estadoCliente.salaId,
    intento: estadoCliente.intentoActual
  });
}

function emitirTipeo() {
  if (!estadoCliente.salaId || !esMiTurno()) {
    return;
  }

  socket.emit('tipeo', {
    salaId: estadoCliente.salaId,
    letras: estadoCliente.intentoActual
  });
}

function renderizarTodo() {
  renderizarCabeceraSala();
  renderizarEstado();
  renderizarJugadores();
  renderizarTablero();
  renderizarTeclado();
  renderizarResultado();
}

function renderizarCabeceraSala() {
  elementos.textoSala.textContent = estadoCliente.salaId || '----';
  elementos.botonCopiar.disabled = !estadoCliente.salaId;
}

function renderizarEstado() {
  if (!estadoCliente.salaId) {
    elementos.textoEstado.textContent = 'Crea una sala o unite con un codigo.';
    return;
  }

  if (!estadoCliente.estadoPartida) {
    elementos.textoEstado.textContent = 'Conectando con la sala...';
    return;
  }

  const estado = estadoCliente.estadoPartida;
  const miJugador = obtenerMiJugador();
  const nombreTurno = obtenerNombreJugador(estado.turnoActual);

  if (estado.fase === 'esperando') {
    elementos.textoEstado.textContent = 'Sala creada. Esperando a la otra persona...';
    return;
  }

  if (estado.fase === 'pausada') {
    elementos.textoEstado.textContent = 'La partida esta pausada porque alguien se desconecto.';
    return;
  }

  if (estado.fase === 'terminada') {
    if (estado.resultado === 'victoria') {
      elementos.textoEstado.textContent = 'Ganaron. La palabra fue descubierta entre ambos.';
    } else {
      elementos.textoEstado.textContent = 'Se quedaron sin intentos. Pueden pedir revancha.';
    }

    return;
  }

  if (miJugador && estado.turnoActual === socket.id) {
    elementos.textoEstado.textContent = `Es tu turno. Llevan ${estado.historialIntentos.length}/${estado.maximoIntentos} intentos usados.`;
  } else {
    elementos.textoEstado.textContent = `Es el turno de ${nombreTurno}. Espera mientras escribe su intento.`;
  }
}

function renderizarJugadores() {
  elementos.panelJugadores.innerHTML = '';

  const jugadoresOrdenados = obtenerJugadoresOrdenados();

  if (!jugadoresOrdenados.length) {
    elementos.panelJugadores.innerHTML = crearPlaceholderJugador('Jugador 1') + crearPlaceholderJugador('Jugador 2');
    return;
  }

  jugadoresOrdenados.forEach(([jugadorId, jugador]) => {
    const tarjeta = document.createElement('article');
    const activo = estadoCliente.estadoPartida && estadoCliente.estadoPartida.turnoActual === jugadorId;

    tarjeta.className = `jugador${activo ? ' jugador--activo' : ''}`;
    tarjeta.innerHTML = `
      <div class="jugador__top">
        <div class="jugador__nombre">
          <span class="jugador__punto jugador__punto--${jugador.color}"></span>
          <span>${jugadorId === socket.id ? 'Vos' : jugador.nombre}</span>
        </div>
        <span class="jugador__badge${activo ? ' jugador__badge--activo' : ''}">
          ${activo ? 'Turno actual' : jugador.conectado ? 'Esperando' : 'Desconectado'}
        </span>
      </div>
      <p class="jugador__estado">
        ${jugador.conectado ? 'Conectado' : 'Desconectado'} · Intentos jugados: ${jugador.intentosRealizados}
      </p>
    `;

    elementos.panelJugadores.appendChild(tarjeta);
  });

  while (elementos.panelJugadores.children.length < 2) {
    elementos.panelJugadores.insertAdjacentHTML('beforeend', crearPlaceholderJugador('Esperando rival'));
  }
}

function renderizarTablero() {
  elementos.tablero.innerHTML = '';

  const historialIntentos = obtenerHistorialIntentos();
  const longitudPalabra = obtenerLongitudPalabra();
  const maximoIntentos = obtenerMaximoIntentos();

  for (let indice = 0; indice < maximoIntentos; indice += 1) {
    const fila = document.createElement('div');
    fila.className = 'fila';
    const claseFilaActiva = obtenerClaseFilaActiva(indice, historialIntentos.length);

    if (claseFilaActiva) {
      fila.classList.add(claseFilaActiva);
    }

    const contenedorCeldas = document.createElement('div');
    contenedorCeldas.className = 'fila__celdas';

    let letras = Array(longitudPalabra).fill('');
    let colores = Array(longitudPalabra).fill('');

    if (historialIntentos[indice]) {
      const intento = historialIntentos[indice];
      letras = intento.palabra.split('');
      colores = intento.colores;
    } else if (indice === historialIntentos.length) {
      if (esMiTurno()) {
        letras = letrasDesdeString(estadoCliente.intentoActual, longitudPalabra);
      } else if (estaJugandoRival()) {
        letras = letrasDesdeString(estadoCliente.tipeoOponente, longitudPalabra);
      }
    }

    for (let posicion = 0; posicion < longitudPalabra; posicion += 1) {
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
  const estadoTeclas = calcularEstadoTeclas();
  const habilitado = esMiTurno();
  const partidaTerminada = estadoCliente.estadoPartida?.fase === 'terminada';

  elementos.teclado.hidden = partidaTerminada;

  if (partidaTerminada) {
    return;
  }

  elementos.teclado.querySelectorAll('.tecla').forEach((tecla) => {
    const valor = tecla.dataset.tecla;
    const estado = estadoTeclas[valor];

    tecla.disabled = !habilitado;
    tecla.classList.remove('tecla--correcto', 'tecla--presente', 'tecla--ausente');

    if (estado) {
      tecla.classList.add(`tecla--${estado}`);
    }
  });
}

function renderizarResultado() {
  const estado = estadoCliente.estadoPartida;
  const resultado = estadoCliente.resultadoFinal || (estado && estado.fase === 'terminada' ? estado : null);

  if (!resultado || !estado || estado.fase !== 'terminada') {
    elementos.panelResultado.hidden = true;
    return;
  }

  const palabra = resultado.palabraSecreta || '?????';

  if (estado.resultado === 'victoria' || resultado.resultado === 'victoria') {
    elementos.resultadoTitulo.textContent = 'Ganaron la partida';
    elementos.resultadoTexto.textContent = `Descubrieron la palabra ${palabra} antes de agotar los intentos.`;
    lanzarFestejoUnaVez();
  } else {
    elementos.resultadoTitulo.textContent = 'Se acabo la ronda';
    elementos.resultadoTexto.textContent = `La palabra era ${palabra}. Si quieren, pueden jugar una revancha.`;
  }

  elementos.panelResultado.hidden = false;
}

// El festejo se dispara una sola vez por partida ganada
function lanzarFestejoUnaVez() {
  if (estadoCliente.festejado) {
    return;
  }

  estadoCliente.festejado = true;
  festejar();
}

function calcularEstadoTeclas() {
  const mapa = {};

  obtenerHistorialIntentos().forEach((intento) => {
    intento.palabra.split('').forEach((letra, indice) => {
      const color = intento.colores[indice];
      const colorPrevio = mapa[letra];

      if (!colorPrevio || PRIORIDAD_TECLA[color] > PRIORIDAD_TECLA[colorPrevio]) {
        mapa[letra] = color;
      }
    });
  });

  return mapa;
}

function mostrarPanelInicio() {
  elementos.app.classList.add('app--inicio');
  elementos.botonVolverInicio.hidden = false;
  elementos.panelInicio.hidden = false;
  elementos.panelJuego.hidden = true;
}

function mostrarPanelJuego() {
  elementos.app.classList.remove('app--inicio');
  elementos.botonVolverInicio.hidden = true;
  elementos.panelInicio.hidden = true;
  elementos.panelJuego.hidden = false;
}

function volverAlMenuPrincipal(mensaje) {
  estadoCliente.salaId = '';
  estadoCliente.linkCompartir = '';
  estadoCliente.estadoPartida = null;
  estadoCliente.intentoActual = '';
  estadoCliente.tipeoOponente = '';
  estadoCliente.resultadoFinal = null;
  elementos.inputSala.value = '';
  elementos.panelResultado.hidden = true;
  elementos.teclado.hidden = false;
  limpiarUrlSala();
  mostrarPanelInicio();
  renderizarTodo();
  mostrarToast(mensaje);
}

function mostrarEstado(texto) {
  elementos.textoEstado.textContent = texto;
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estadoCliente.toastTimeout);
  estadoCliente.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 3200);
}

function obtenerJugadoresOrdenados() {
  if (!estadoCliente.estadoPartida || !estadoCliente.estadoPartida.jugadores) {
    return [];
  }

  return Object.entries(estadoCliente.estadoPartida.jugadores)
    .sort(([, jugadorA], [, jugadorB]) => jugadorA.asiento - jugadorB.asiento);
}

function obtenerMiJugador() {
  if (!estadoCliente.estadoPartida) {
    return null;
  }

  return estadoCliente.estadoPartida.jugadores[socket.id] || null;
}

function obtenerNombreJugador(jugadorId) {
  if (!estadoCliente.estadoPartida || !jugadorId) {
    return 'Jugador';
  }

  if (jugadorId === socket.id) {
    return 'vos';
  }

  const jugador = estadoCliente.estadoPartida.jugadores[jugadorId];
  return jugador ? jugador.nombre : 'la otra persona';
}

function obtenerHistorialIntentos() {
  return estadoCliente.estadoPartida?.historialIntentos || [];
}

function obtenerLongitudPalabra() {
  return estadoCliente.estadoPartida?.longitudPalabra || LONGITUD_PALABRA_POR_DEFECTO;
}

function obtenerMaximoIntentos() {
  return estadoCliente.estadoPartida?.maximoIntentos || MAXIMO_INTENTOS_POR_DEFECTO;
}

function obtenerTurnoActual() {
  return estadoCliente.estadoPartida?.turnoActual || null;
}

function esMiTurno() {
  return Boolean(
    estadoCliente.estadoPartida
    && estadoCliente.estadoPartida.fase === 'jugando'
    && estadoCliente.estadoPartida.turnoActual === socket.id
  );
}

function estaJugandoRival() {
  return Boolean(
    estadoCliente.estadoPartida
    && estadoCliente.estadoPartida.fase === 'jugando'
    && estadoCliente.estadoPartida.turnoActual
    && estadoCliente.estadoPartida.turnoActual !== socket.id
  );
}

function letrasDesdeString(texto, longitud) {
  return Array.from({ length: longitud }, (_, indice) => texto[indice] || '');
}

function crearPlaceholderJugador(texto) {
  return `
    <article class="jugador">
      <div class="jugador__top">
        <div class="jugador__nombre">
          <span class="jugador__punto jugador__punto--mint"></span>
          <span>${texto}</span>
        </div>
        <span class="jugador__badge">Pendiente</span>
      </div>
      <p class="jugador__estado">Aun no se conecto.</p>
    </article>
  `;
}

function obtenerClaseFilaActiva(indiceFila, cantidadIntentosUsados) {
  if (!estadoCliente.estadoPartida || estadoCliente.estadoPartida.fase !== 'jugando') {
    return '';
  }

  if (indiceFila !== cantidadIntentosUsados) {
    return '';
  }

  const jugadorTurno = estadoCliente.estadoPartida.jugadores[obtenerTurnoActual()];

  if (!jugadorTurno) {
    return '';
  }

  // La fila disponible indica el turno actual con un borde pastel distinto por jugador.
  return jugadorTurno.asiento === 1 ? 'fila--activa-turno-1' : 'fila--activa-turno-2';
}

function obtenerSalaDesdeUrl() {
  const sala = new URLSearchParams(window.location.search).get('sala');
  return normalizarSalaId(sala || '');
}

function actualizarUrlSala(salaId) {
  const url = new URL(window.location.href);
  url.searchParams.set('sala', salaId);
  window.history.replaceState({}, '', url);
}

function limpiarUrlSala() {
  const url = new URL(window.location.href);
  url.searchParams.delete('sala');
  window.history.replaceState({}, '', url);
}

function construirLinkCompartir(salaId) {
  if (!salaId) {
    return '';
  }

  const url = new URL(window.location.origin);
  url.pathname = '/co-wordle/';
  url.searchParams.set('sala', salaId);
  return url.toString();
}

function normalizarSalaId(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 4);
}

function esCampoEditable(elemento) {
  if (!elemento) {
    return false;
  }

  const etiqueta = elemento.tagName ? elemento.tagName.toLowerCase() : '';
  return etiqueta === 'input'
    || etiqueta === 'textarea'
    || elemento.isContentEditable;
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
