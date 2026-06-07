const SERVIDOR_URL = window.location.origin;
const LONGITUD_PALABRA = 5;
const MAXIMO_INTENTOS = 6;
const DURACION_PARTIDA_MS = 90 * 1000;
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '\u00D1'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR']
];
const PRIORIDAD_TECLA = {
  ausente: 1,
  presente: 2,
  correcto: 3
};

const socket = io(SERVIDOR_URL);

const elementos = {
  panelInicio: document.getElementById('panel-inicio'),
  panelJuego: document.getElementById('panel-juego'),
  botonCrear: document.getElementById('boton-crear'),
  botonUnirse: document.getElementById('boton-unirse'),
  inputSala: document.getElementById('input-sala'),
  textoSala: document.getElementById('texto-sala'),
  marcador: document.querySelector('.marcador'),
  panelJugadores: document.getElementById('panel-jugadores'),
  textoReloj: document.getElementById('texto-reloj'),
  textoEstado: document.getElementById('texto-estado'),
  tablero: document.getElementById('tablero'),
  teclado: document.getElementById('teclado'),
  botonCopiar: document.getElementById('boton-copiar'),
  botonReiniciar: document.getElementById('boton-reiniciar'),
  botonesAyuda: document.querySelectorAll('.boton-ayuda'),
  botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
  panelAyuda: document.getElementById('panel-ayuda'),
  panelResultado: document.getElementById('panel-resultado'),
  resultadoTitulo: document.getElementById('resultado-titulo'),
  resultadoTexto: document.getElementById('resultado-texto'),
  botonesSalidaJuego: document.querySelectorAll('.btn-volver--juego, #boton-volver-menu-resultado'),
  toast: document.getElementById('toast')
};

const estadoCliente = {
  salaId: null,
  linkSala: null,
  estadoPartida: null,
  intentoActual: '',
  unionAutomaticaPendiente: false,
  toastTimeout: null,
  intervaloReloj: null,
  relojBase: null
};

inicializar();

function inicializar() {
  construirTeclado();
  leerSalaDesdeUrl();
  enlazarEventos();
  enlazarSocket();
  renderizarTodo();
}

function leerSalaDesdeUrl() {
  const parametros = new URLSearchParams(window.location.search);
  const salaUrl = normalizarSalaId(parametros.get('sala'));

  if (!salaUrl) {
    return;
  }

  estadoCliente.salaId = salaUrl;
  estadoCliente.unionAutomaticaPendiente = true;
  elementos.inputSala.value = salaUrl;
}

function enlazarEventos() {
  elementos.botonCrear.addEventListener('click', crearSala);
  elementos.botonUnirse.addEventListener('click', unirseASalaManual);
  elementos.botonCopiar.addEventListener('click', copiarLinkSala);
  elementos.botonReiniciar.addEventListener('click', pedirRevancha);
  elementos.inputSala.addEventListener('input', normalizarInputSala);
  elementos.inputSala.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      unirseASalaManual();
    }
  });

  elementos.botonesAyuda.forEach((boton) => {
    boton.addEventListener('click', abrirAyuda);
  });
  elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
  elementos.panelAyuda.addEventListener('click', cerrarAyudaDesdeFondo);

  elementos.botonesSalidaJuego.forEach((boton) => {
    boton.addEventListener('click', salirDeSala);
  });

  document.addEventListener('keydown', manejarTecladoFisico);
}

function enlazarSocket() {
  socket.on('connect', () => {
    if (estadoCliente.unionAutomaticaPendiente && estadoCliente.salaId) {
      socket.emit('versus-unirse-sala', { salaId: estadoCliente.salaId });
    }
  });

  socket.on('disconnect', () => {
    mostrarToast('Se perdio la conexion con el servidor.');
  });

  socket.on('versus-sala-creada', ({ salaId, link, estado }) => {
    estadoCliente.salaId = salaId;
    estadoCliente.linkSala = link;
    aplicarEstadoPartida(estado);
    estadoCliente.unionAutomaticaPendiente = false;
    elementos.inputSala.value = salaId;
    actualizarUrlSala(salaId);
    mostrarPanelJuego();
    mostrarToast('Sala creada. Compartile el link a tu rival.');
    renderizarTodo();
  });

  socket.on('versus-partida-iniciada', ({ estado }) => {
    aplicarEstadoPartida(estado);
    estadoCliente.unionAutomaticaPendiente = false;
    estadoCliente.intentoActual = '';
    mostrarPanelJuego();
    elementos.panelResultado.hidden = true;
    iniciarReloj();
    mostrarToast('La carrera empezo. A resolver.');
    renderizarTodo();
  });

  socket.on('versus-estado', ({ estado }) => {
    aplicarEstadoPartida(estado);
    mostrarPanelJuego();
    iniciarReloj();
    renderizarTodo();
  });

  socket.on('versus-intento-registrado', (evento) => {
    aplicarEstadoPartida(evento.estado);

    if (evento.tableroCompletado) {
      anunciarTableroCompletado(evento);
    }

    renderizarTodo();
  });

  socket.on('versus-partida-terminada', ({ estado }) => {
    aplicarEstadoPartida(estado);
    estadoCliente.intentoActual = '';
    detenerReloj();
    renderizarTodo();
  });

  socket.on('versus-jugador-desconectado', ({ estado }) => {
    aplicarEstadoPartida(estado);
    mostrarToast('Tu rival se desconecto. La sala queda abierta por ahora.');
    renderizarTodo();
  });

  socket.on('versus-sala-cerrada', ({ jugadorId }) => {
    const cerroMiCliente = jugadorId === socket.id;
    reiniciarClienteLocal();

    if (!cerroMiCliente) {
      mostrarToast('Tu rival salio de la sala. Te llevamos al menu.');
    }
  });

  socket.on('error-sala', ({ mensaje }) => {
    mostrarToast(mensaje || 'Ocurrio un error en la sala.');
  });
}

function crearSala() {
  if (!socket.connected) {
    mostrarToast('Todavia no hay conexion con el servidor.');
    return;
  }

  socket.emit('versus-crear-sala', {
    juegoId: 'wordle',
    modoId: 'wordle-versus-tiempo'
  });
}

function unirseASalaManual() {
  const salaId = normalizarSalaId(elementos.inputSala.value);

  if (salaId.length !== 4) {
    mostrarToast('El codigo de sala debe tener 4 caracteres.');
    return;
  }

  estadoCliente.salaId = salaId;
  estadoCliente.unionAutomaticaPendiente = false;
  socket.emit('versus-unirse-sala', { salaId });
  actualizarUrlSala(salaId);
}

function confirmarIntento() {
  const partida = estadoCliente.estadoPartida;

  if (!partida || partida.fase !== 'jugando') {
    mostrarToast('La partida todavia no esta en juego.');
    return;
  }

  if (estadoCliente.intentoActual.length !== LONGITUD_PALABRA) {
    mostrarToast(`La palabra debe tener ${LONGITUD_PALABRA} letras.`);
    return;
  }

  socket.emit('versus-enviar-intento', {
    salaId: estadoCliente.salaId,
    intento: estadoCliente.intentoActual
  });
  estadoCliente.intentoActual = '';
  renderizarTodo();
}

function pedirRevancha() {
  if (!estadoCliente.salaId) {
    return;
  }

  socket.emit('versus-reiniciar-sala', {
    salaId: estadoCliente.salaId
  });
}

function salirDeSala(evento) {
  if (!estadoCliente.salaId || !socket.connected) {
    return;
  }

  evento.preventDefault();
  const destino = evento.currentTarget.getAttribute('href') || '/wordle/';

  socket.emit('versus-cerrar-sala', {
    salaId: estadoCliente.salaId
  });

  setTimeout(() => {
    window.location.href = destino;
  }, 80);
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

  if (evento.key === 'Enter' && partidaTerminada()) {
    evento.preventDefault();
    pedirRevancha();
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
  if (!puedoEscribir()) {
    return;
  }

  if (estadoCliente.intentoActual.length >= LONGITUD_PALABRA) {
    return;
  }

  estadoCliente.intentoActual += letra;
  renderizarTodo();
}

function borrarLetra() {
  if (!puedoEscribir() || !estadoCliente.intentoActual.length) {
    return;
  }

  estadoCliente.intentoActual = estadoCliente.intentoActual.slice(0, -1);
  renderizarTodo();
}

function puedoEscribir() {
  const partida = estadoCliente.estadoPartida;
  return Boolean(partida && partida.fase === 'jugando' && obtenerMiJugador());
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

function renderizarTodo() {
  renderizarJugadores();
  renderizarEstado();
  renderizarTablero();
  renderizarTeclado();
  actualizarReloj();
  renderizarResultado();
}

function aplicarEstadoPartida(estado) {
  estadoCliente.estadoPartida = estado;

  if (!estado || estado.fase !== 'jugando') {
    estadoCliente.relojBase = null;
    return;
  }

  estadoCliente.relojBase = {
    tiempoRestanteMs: Number(estado.tiempoRestanteMs || 0),
    recibidoEn: performance.now()
  };
}

function renderizarJugadores() {
  const partida = estadoCliente.estadoPartida;

  if (!partida) {
    elementos.panelJugadores.innerHTML = '';
    elementos.marcador.classList.remove('marcador--solo', 'marcador--doble');
    elementos.panelJugadores.classList.remove('jugadores--solo', 'jugadores--doble');
    return;
  }

  const jugadoresOrdenados = Object.entries(partida.jugadores);
  elementos.marcador.classList.toggle('marcador--solo', jugadoresOrdenados.length === 1);
  elementos.marcador.classList.toggle('marcador--doble', jugadoresOrdenados.length > 1);
  elementos.panelJugadores.classList.toggle('jugadores--solo', jugadoresOrdenados.length === 1);
  elementos.panelJugadores.classList.toggle('jugadores--doble', jugadoresOrdenados.length > 1);
  elementos.panelJugadores.innerHTML = jugadoresOrdenados
    .map(([jugadorId, jugador]) => {
      const esMiJugador = jugadorId === socket.id;
      const intentosTablero = jugador.tableroActual.historialIntentos.length;
      const estadoConexion = jugador.conectado ? 'Conectado' : 'Desconectado';

      return `
        <article class="jugador ${esMiJugador ? 'jugador--yo' : ''}">
          <div class="jugador__fila">
            <span class="jugador__nombre">
              <span class="jugador__punto"></span>
              ${esMiJugador ? 'Vos' : jugador.nombre}
            </span>
            <strong class="jugador__puntaje">${jugador.puntaje}</strong>
          </div>
          <p class="jugador__meta">${estadoConexion} · Tablero actual: ${intentosTablero}/${MAXIMO_INTENTOS}</p>
        </article>
      `;
    })
    .join('');
}

function renderizarEstado() {
  const partida = estadoCliente.estadoPartida;

  if (!partida) {
    elementos.textoEstado.textContent = 'Crea una sala o unite con un codigo para empezar.';
    return;
  }

  if (partida.fase === 'esperando') {
    elementos.textoEstado.textContent = 'Esperando al segundo jugador para arrancar el reloj.';
    return;
  }

  if (partida.fase === 'terminada') {
    elementos.textoEstado.textContent = 'La carrera termino.';
    return;
  }

  elementos.textoEstado.textContent = 'Resolve tu tablero. Si acertas, recibis otra palabra al instante.';
}

function renderizarTablero() {
  elementos.tablero.innerHTML = '';

  const miJugador = obtenerMiJugador();
  const historial = miJugador ? miJugador.tableroActual.historialIntentos : [];
  const estaJugando = puedoEscribir();

  for (let indice = 0; indice < MAXIMO_INTENTOS; indice += 1) {
    const fila = document.createElement('div');
    fila.className = `fila${estaJugando && indice === historial.length ? ' fila--activa' : ''}`;
    const contenedorCeldas = document.createElement('div');
    contenedorCeldas.className = 'fila__celdas';

    let letras = Array(LONGITUD_PALABRA).fill('');
    let colores = Array(LONGITUD_PALABRA).fill('');

    if (historial[indice]) {
      letras = historial[indice].palabra.split('');
      colores = historial[indice].colores;
    } else if (estaJugando && indice === historial.length) {
      letras = letrasDesdeString(estadoCliente.intentoActual);
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
  const partida = estadoCliente.estadoPartida;
  const deshabilitado = !partida || partida.fase !== 'jugando' || !obtenerMiJugador();
  const estadoTeclas = calcularEstadoTeclas();

  elementos.teclado.querySelectorAll('.tecla').forEach((tecla) => {
    const valor = tecla.dataset.tecla;
    const color = estadoTeclas[valor];

    tecla.disabled = deshabilitado;
    tecla.classList.remove('tecla--correcto', 'tecla--presente', 'tecla--ausente');

    if (color) {
      tecla.classList.add(`tecla--${color}`);
    }
  });
}

function renderizarResultado() {
  const partida = estadoCliente.estadoPartida;

  if (!partida || partida.fase !== 'terminada') {
    elementos.panelResultado.hidden = true;
    return;
  }

  const yo = obtenerMiJugador();
  const rival = obtenerRival();
  const miPuntaje = yo ? yo.puntaje : 0;
  const puntajeRival = rival ? rival.puntaje : 0;

  if (partida.ganador === 'empate') {
    elementos.resultadoTitulo.textContent = 'Empate';
    elementos.resultadoTexto.textContent = `Terminaron ${miPuntaje} a ${puntajeRival}. Nadie se lleva la corona, pero hubo duelo.`;
  } else if (partida.ganador === socket.id) {
    elementos.resultadoTitulo.textContent = 'Ganaste';
    elementos.resultadoTexto.textContent = `Resolviste ${miPuntaje} palabra${miPuntaje === 1 ? '' : 's'} contra ${puntajeRival} de tu rival.`;
  } else {
    elementos.resultadoTitulo.textContent = 'Gano tu rival';
    elementos.resultadoTexto.textContent = `Resultado final: ${miPuntaje} a ${puntajeRival}. Pedi revancha y lo damos vuelta.`;
  }

  elementos.panelResultado.hidden = false;
}

function calcularEstadoTeclas() {
  const miJugador = obtenerMiJugador();
  const mapa = {};

  if (!miJugador) {
    return mapa;
  }

  miJugador.tableroActual.historialIntentos.forEach((intento) => {
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

function iniciarReloj() {
  detenerReloj();
  estadoCliente.intervaloReloj = setInterval(actualizarReloj, 250);
  actualizarReloj();
}

function detenerReloj() {
  clearInterval(estadoCliente.intervaloReloj);
  estadoCliente.intervaloReloj = null;
}

function actualizarReloj() {
  const partida = estadoCliente.estadoPartida;
  const restante = calcularTiempoRestante(partida);
  const segundosTotales = Math.ceil(restante / 1000);
  const minutos = Math.floor(segundosTotales / 60);
  const segundos = segundosTotales % 60;
  const reloj = elementos.textoReloj.parentElement;

  elementos.textoReloj.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  reloj.classList.toggle('reloj--alerta', restante > 0 && restante <= 10000);

  if (partida && partida.fase !== 'jugando') {
    detenerReloj();
  }
}

function calcularTiempoRestante(partida) {
  if (!partida || partida.fase === 'esperando') {
    return DURACION_PARTIDA_MS;
  }

  if (!estadoCliente.relojBase) {
    return Math.max(0, Number(partida.tiempoRestanteMs || 0));
  }

  const transcurridoCliente = performance.now() - estadoCliente.relojBase.recibidoEn;
  return Math.max(0, estadoCliente.relojBase.tiempoRestanteMs - transcurridoCliente);
}

function copiarLinkSala() {
  if (!estadoCliente.salaId) {
    return;
  }

  const link = estadoCliente.linkSala || construirLinkLocal();

  navigator.clipboard.writeText(link)
    .then(() => mostrarToast('Link copiado.'))
    .catch(() => mostrarToast(link));
}

function construirLinkLocal() {
  const url = new URL(window.location.href);
  url.pathname = '/wordle/versus-tiempo/';
  url.searchParams.set('sala', estadoCliente.salaId);
  return url.toString();
}

function anunciarTableroCompletado(evento) {
  const esMiIntento = evento.jugadorId === socket.id;

  if (evento.acertado) {
    mostrarToast(esMiIntento
      ? `+1 punto. La palabra era ${evento.palabraAnterior}.`
      : 'Tu rival sumo 1 punto.');
    return;
  }

  mostrarToast(esMiIntento
    ? `Pasas a otra palabra. La anterior era ${evento.palabraAnterior}.`
    : 'Tu rival agoto un tablero.');
}

function mostrarPanelJuego() {
  elementos.panelInicio.hidden = true;
  elementos.panelJuego.hidden = false;
  elementos.textoSala.textContent = estadoCliente.salaId || '----';
  document.getElementById('boton-volver-inicio').hidden = true;
}

function mostrarPanelInicio() {
  elementos.panelInicio.hidden = false;
  elementos.panelJuego.hidden = true;
  elementos.panelResultado.hidden = true;
  document.getElementById('boton-volver-inicio').hidden = false;
  window.history.replaceState({}, '', '/wordle/versus-tiempo/');
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

function obtenerMiJugador() {
  const partida = estadoCliente.estadoPartida;

  if (!partida || !socket.id) {
    return null;
  }

  return partida.jugadores[socket.id] || null;
}

function obtenerRival() {
  const partida = estadoCliente.estadoPartida;

  if (!partida || !socket.id) {
    return null;
  }

  const entradaRival = Object.entries(partida.jugadores)
    .find(([jugadorId]) => jugadorId !== socket.id);

  return entradaRival ? entradaRival[1] : null;
}

function partidaTerminada() {
  return Boolean(estadoCliente.estadoPartida && estadoCliente.estadoPartida.fase === 'terminada');
}

function reiniciarClienteLocal() {
  detenerReloj();
  estadoCliente.salaId = null;
  estadoCliente.linkSala = null;
  estadoCliente.estadoPartida = null;
  estadoCliente.intentoActual = '';
  estadoCliente.unionAutomaticaPendiente = false;
  estadoCliente.relojBase = null;
  elementos.inputSala.value = '';
  mostrarPanelInicio();
  renderizarTodo();
}

function actualizarUrlSala(salaId) {
  const url = new URL(window.location.href);
  url.pathname = '/wordle/versus-tiempo/';
  url.searchParams.set('sala', salaId);
  window.history.replaceState({}, '', url.toString());
}

function normalizarInputSala() {
  elementos.inputSala.value = normalizarSalaId(elementos.inputSala.value).slice(0, 4);
}

function normalizarSalaId(salaId) {
  return String(salaId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function esCampoEditable(elemento) {
  if (!elemento) {
    return false;
  }

  const etiqueta = elemento.tagName ? elemento.tagName.toLowerCase() : '';
  return etiqueta === 'input'
    || etiqueta === 'textarea'
    || elemento.isContentEditable;
}

function mostrarToast(mensaje) {
  elementos.toast.textContent = mensaje;
  elementos.toast.hidden = false;

  clearTimeout(estadoCliente.toastTimeout);
  estadoCliente.toastTimeout = setTimeout(() => {
    elementos.toast.hidden = true;
  }, 3000);
}
