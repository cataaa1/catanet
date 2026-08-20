// Cliente compartido por el Buscaminas cooperativo y el versus. Los dos modos
// usan los mismos eventos y la misma pantalla; lo unico que cambia son los
// textos y como se muestra al resto de la gente, asi que se resuelve con el
// parametro `modo` en vez de duplicar el archivo.
import { festejar } from '/shared/celebracion.js';
import { habilitarCierreResultado } from '/shared/resultado.js';

const SERVIDOR_URL = window.location.origin;
const RUTA_MINA = '/buscaminas/assets/mina.png';
const RUTA_BANDERA = '/buscaminas/assets/bandera.png';
const MS_PULSACION_LARGA = 450;
const LADO_MINIMO = 16;
const LADO_MAXIMO = 52;
const SEPARACION_CELDAS = 2;
const PADDING_TABLERO = 10;

export function iniciarBuscaminasOnline({ modo }) {
  const socket = io(SERVIDOR_URL);

  const elementos = {
    panelInicio: document.getElementById('panel-inicio'),
    panelJuego: document.getElementById('panel-juego'),
    panelResultado: document.getElementById('panel-resultado'),
    panelAyuda: document.getElementById('panel-ayuda'),
    botonCrear: document.getElementById('boton-crear'),
    botonUnirse: document.getElementById('boton-unirse'),
    inputSala: document.getElementById('input-sala'),
    grupoDificultades: document.getElementById('grupo-dificultades'),
    botonCopiar: document.getElementById('boton-copiar'),
    botonesRevancha: document.querySelectorAll('.boton-revancha'),
    botonModoBandera: document.getElementById('boton-modo-bandera'),
    estadoModoBandera: document.getElementById('estado-modo-bandera'),
    botonesAyuda: document.querySelectorAll('.boton-ayuda'),
    botonCerrarAyuda: document.getElementById('boton-cerrar-ayuda'),
    textoSala: document.getElementById('texto-sala'),
    textoMinas: document.getElementById('texto-minas'),
    textoEstado: document.getElementById('texto-estado'),
    panelJugadores: document.getElementById('panel-jugadores'),
    tablero: document.getElementById('tablero'),
    resultadoEyebrow: document.getElementById('resultado-eyebrow'),
    resultadoTitulo: document.getElementById('resultado-titulo'),
    resultadoTexto: document.getElementById('resultado-texto'),
    toast: document.getElementById('toast')
  };

  const estado = {
    modo,
    salaId: obtenerSalaDesdeUrl(),
    link: '',
    dificultad: 'facil',
    partida: null,
    vista: [],
    celdasDom: [],
    modoBandera: false,
    festejado: false,
    pulsacion: null,
    toastTimeout: null
  };

  inicializar();

  function inicializar() {
    habilitarCierreResultado();
    enlazarEventos();
    enlazarSocket();

    if (estado.salaId) {
      elementos.inputSala.value = estado.salaId;
      unirse();
    }
  }

  function enlazarEventos() {
    elementos.botonCrear.addEventListener('click', crear);
    elementos.botonUnirse.addEventListener('click', unirse);
    elementos.inputSala.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        unirse();
      }
    });

    elementos.grupoDificultades.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-dificultad]');

      if (boton) {
        estado.dificultad = boton.dataset.dificultad;
        renderizarDificultad();
      }
    });

    elementos.botonCopiar.addEventListener('click', copiarLink);
    elementos.botonesRevancha.forEach((boton) => {
      boton.addEventListener('click', () => {
        socket.emit('buscaminas-reiniciar', { salaId: estado.salaId });
      });
    });
    elementos.botonModoBandera.addEventListener('click', alternarModoBandera);

    elementos.botonesAyuda.forEach((boton) => {
      boton.addEventListener('click', () => {
        elementos.panelAyuda.hidden = false;
      });
    });
    elementos.botonCerrarAyuda.addEventListener('click', cerrarAyuda);
    elementos.panelAyuda.addEventListener('click', (evento) => {
      if (evento.target === elementos.panelAyuda) {
        cerrarAyuda();
      }
    });

    elementos.tablero.addEventListener('contextmenu', (evento) => {
      const celda = ubicarCelda(evento.target);

      if (celda) {
        evento.preventDefault();
        marcar(celda.fila, celda.columna);
      }
    });

    elementos.tablero.addEventListener('pointerdown', manejarPointerDown);
    elementos.tablero.addEventListener('pointerup', manejarPointerUp);
    elementos.tablero.addEventListener('pointercancel', cancelarPulsacion);
    elementos.tablero.addEventListener('pointerleave', cancelarPulsacion);

    addEventListener('resize', ajustarLadoCelda);

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

  function enlazarSocket() {
    socket.on('buscaminas-sala-creada', ({ salaId, link, estado: nuevoEstado }) => {
      estado.salaId = salaId;
      estado.link = link;
      mostrarPanelJuego();
      aplicarEstado(nuevoEstado);
      mostrarToast('Sala creada. Compartí el link para que se sumen.');
    });

    socket.on('buscaminas-estado', ({ estado: nuevoEstado }) => {
      mostrarPanelJuego();
      aplicarEstado(nuevoEstado);
    });

    socket.on('buscaminas-partida-iniciada', ({ estado: nuevoEstado }) => {
      estado.festejado = false;
      elementos.panelResultado.hidden = true;
      mostrarPanelJuego();
      aplicarEstado(nuevoEstado);
    });

    socket.on('buscaminas-celdas-reveladas', ({ estado: nuevoEstado }) => {
      aplicarEstado(nuevoEstado);
    });

    socket.on('buscaminas-bandera-cambiada', ({ estado: nuevoEstado }) => {
      aplicarEstado(nuevoEstado);
    });

    socket.on('buscaminas-partida-terminada', (datos) => {
      aplicarEstado(datos.estado);
      mostrarResultado(datos);
    });

    socket.on('buscaminas-jugador-desconectado', () => {
      mostrarToast('Alguien se desconecto de la sala.');
    });

    socket.on('buscaminas-sala-cerrada', () => {
      mostrarToast('La sala se cerro.');
    });

    socket.on('error-sala', ({ mensaje }) => {
      mostrarToast(mensaje || 'Ocurrio un error en la sala.');
    });

    socket.on('disconnect', () => {
      mostrarToast('Se corto la conexion con el servidor.');
    });
  }

  function crear() {
    socket.emit('buscaminas-crear-sala', { modo, dificultad: estado.dificultad });
  }

  function unirse() {
    const salaId = (elementos.inputSala.value || estado.salaId || '').trim().toLowerCase();

    if (!salaId) {
      mostrarToast('Escribi el codigo de la sala.');
      return;
    }

    estado.salaId = salaId;
    socket.emit('buscaminas-unirse-sala', { salaId });
  }

  function copiarLink() {
    const link = estado.link || `${SERVIDOR_URL}${location.pathname}?sala=${estado.salaId}`;

    navigator.clipboard.writeText(link)
      .then(() => mostrarToast('Link copiado.'))
      .catch(() => mostrarToast(link));
  }

  function aplicarEstado(nuevoEstado) {
    if (!nuevoEstado) {
      return;
    }

    estado.partida = nuevoEstado;
    elementos.textoSala.textContent = nuevoEstado.salaId || estado.salaId || '----';

    if (nuevoEstado.tablero) {
      construirTableroSiHaceFalta(nuevoEstado.tablero);
      volcarVista(nuevoEstado.tablero, nuevoEstado.minas);
      elementos.textoMinas.textContent = String(nuevoEstado.tablero.minasRestantes);
    }

    renderizarJugadores(nuevoEstado);
    renderizarEstadoTexto(nuevoEstado);
    elementos.botonesRevancha.forEach((boton) => {
      boton.hidden = nuevoEstado.fase !== 'terminada';
    });
  }

  // El servidor manda solo las celdas destapadas o marcadas: el resto esta tapado
  function volcarVista(tablero, minas) {
    estado.vista = Array.from({ length: tablero.filas }, () => (
      Array.from({ length: tablero.columnas }, () => ({ tapada: true }))
    ));

    tablero.celdas.forEach((celda) => {
      estado.vista[celda.fila][celda.columna] = { ...celda, tapada: false };
    });

    if (minas) {
      minas.forEach(({ fila, columna }) => {
        estado.vista[fila][columna] = { ...estado.vista[fila][columna], mina: true, tapada: false };
      });
    }

    for (let fila = 0; fila < tablero.filas; fila += 1) {
      for (let columna = 0; columna < tablero.columnas; columna += 1) {
        pintarCelda(fila, columna);
      }
    }
  }

  function construirTableroSiHaceFalta(tablero) {
    const yaEsta = estado.celdasDom.length === tablero.filas
      && estado.celdasDom[0].length === tablero.columnas;

    if (yaEsta) {
      return;
    }

    elementos.tablero.style.gridTemplateColumns = `repeat(${tablero.columnas}, var(--lado))`;
    elementos.tablero.innerHTML = '';
    estado.celdasDom = [];

    const fragmento = document.createDocumentFragment();

    for (let fila = 0; fila < tablero.filas; fila += 1) {
      const filaDom = [];

      for (let columna = 0; columna < tablero.columnas; columna += 1) {
        const boton = document.createElement('button');

        boton.type = 'button';
        boton.className = 'celda';
        boton.dataset.fila = String(fila);
        boton.dataset.columna = String(columna);
        filaDom.push(boton);
        fragmento.appendChild(boton);
      }

      estado.celdasDom.push(filaDom);
    }

    elementos.tablero.appendChild(fragmento);
    ajustarLadoCelda();
  }

  function pintarCelda(fila, columna) {
    const boton = estado.celdasDom[fila] && estado.celdasDom[fila][columna];

    if (!boton) {
      return;
    }

    const celda = estado.vista[fila][columna];
    const clases = ['celda'];
    let contenido = '';

    if (celda.tapada) {
      // sin nada
    } else if (celda.bandera) {
      contenido = `<img src="${RUTA_BANDERA}" alt="">`;
    } else if (celda.mina) {
      clases.push('celda--abierta', 'celda--mina');
      contenido = `<img src="${RUTA_MINA}" alt="">`;
    } else {
      clases.push('celda--abierta');

      if (celda.adyacentes > 0) {
        clases.push(`celda--n${celda.adyacentes}`);
        contenido = String(celda.adyacentes);
      }
    }

    boton.className = clases.join(' ');
    boton.innerHTML = contenido;

    // En cooperativo cada celda lleva el color de quien la destapo
    const color = estado.modo === 'coop' ? colorDeJugador(celda.jugadorId) : null;
    boton.style.setProperty('--color-jugador', color || 'transparent');
    boton.classList.toggle('celda--de-jugador', Boolean(color) && !celda.tapada);
  }

  function colorDeJugador(jugadorId) {
    if (!jugadorId || !estado.partida) {
      return null;
    }

    const jugador = estado.partida.jugadores.find((j) => j.id === jugadorId);

    return jugador ? jugador.color : null;
  }

  function renderizarJugadores(nuevoEstado) {
    const total = nuevoEstado.tablero
      ? nuevoEstado.tablero.filas * nuevoEstado.tablero.columnas - nuevoEstado.tablero.minas
      : 0;

    elementos.panelJugadores.innerHTML = nuevoEstado.jugadores.map((jugador) => {
      const porcentaje = total ? Math.round((jugador.celdasReveladas / total) * 100) : 0;
      const nombre = jugador.soyYo ? 'Vos' : `Jugador ${jugador.numero}`;
      const progreso = estado.modo === 'versus'
        ? `<span class="jugador__barra"><span style="width:${porcentaje}%"></span></span>
           <span class="jugador__dato">${porcentaje}%</span>`
        : '';

      return `
        <article class="jugador${jugador.soyYo ? ' jugador--yo' : ''}${jugador.conectado ? '' : ' jugador--fuera'}">
          <span class="jugador__color" style="background:${jugador.color}"></span>
          <span class="jugador__nombre">${nombre}</span>
          ${progreso}
        </article>
      `;
    }).join('');
  }

  function renderizarEstadoTexto(nuevoEstado) {
    if (nuevoEstado.fase === 'esperando') {
      elementos.textoEstado.textContent = 'Esperando a que se sume alguien mas.';
      return;
    }

    if (nuevoEstado.fase === 'terminada') {
      elementos.textoEstado.textContent = 'Partida terminada.';
      return;
    }

    elementos.textoEstado.textContent = 'Partida en curso.';
  }

  function mostrarResultado(datos) {
    const gane = estado.modo === 'coop'
      ? datos.resultado === 'victoria'
      : datos.ganador === socket.id;

    if (estado.modo === 'coop') {
      elementos.resultadoEyebrow.textContent = 'Partida terminada';
      elementos.resultadoTitulo.textContent = gane ? 'Despejaron el tablero' : 'Alguien piso una mina';
      elementos.resultadoTexto.textContent = gane
        ? 'Lo sacaron entre todos, sin pisar ni una.'
        : 'Una mina termina la partida para todo el equipo. Pueden pedir revancha.';
    } else {
      elementos.resultadoEyebrow.textContent = 'Partida terminada';
      elementos.resultadoTitulo.textContent = gane ? 'Ganaste' : 'Gano tu rival';
      elementos.resultadoTexto.textContent = datos.perdedor === socket.id
        ? 'Pisaste una mina, y eso es derrota inmediata.'
        : (gane ? 'Despejaste el tablero primero.' : 'Tu rival llego primero. Pedi revancha.');
    }

    elementos.panelResultado.hidden = false;

    if (gane && !estado.festejado) {
      estado.festejado = true;
      festejar();
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
        marcar(celda.fila, celda.columna);
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

    if (pulsacion.fila !== celda.fila || pulsacion.columna !== celda.columna || pulsacion.yaMarco) {
      return;
    }

    if (estado.modoBandera) {
      marcar(celda.fila, celda.columna);
      return;
    }

    revelar(celda.fila, celda.columna);
  }

  function cancelarPulsacion() {
    if (estado.pulsacion) {
      clearTimeout(estado.pulsacion.temporizador);
      estado.pulsacion = null;
    }
  }

  function revelar(fila, columna) {
    if (!puedeJugar()) {
      return;
    }

    socket.emit('buscaminas-revelar', { salaId: estado.salaId, fila, columna });
  }

  function marcar(fila, columna) {
    if (!puedeJugar()) {
      return;
    }

    socket.emit('buscaminas-bandera', { salaId: estado.salaId, fila, columna });
  }

  function puedeJugar() {
    return Boolean(estado.partida) && estado.partida.fase === 'jugando';
  }

  function alternarModoBandera() {
    estado.modoBandera = !estado.modoBandera;
    elementos.botonModoBandera.classList.toggle('is-activa', estado.modoBandera);
    elementos.botonModoBandera.setAttribute('aria-pressed', estado.modoBandera ? 'true' : 'false');
    elementos.estadoModoBandera.textContent = estado.modoBandera ? 'ON' : 'OFF';
  }

  function cerrarAyuda() {
    elementos.panelAyuda.hidden = true;
  }

  function mostrarPanelJuego() {
    elementos.panelInicio.hidden = true;
    elementos.panelJuego.hidden = false;
  }

  function renderizarDificultad() {
    elementos.grupoDificultades.querySelectorAll('[data-dificultad]').forEach((boton) => {
      boton.classList.toggle('is-active', boton.dataset.dificultad === estado.dificultad);
    });
  }

  function ajustarLadoCelda() {
    if (!estado.partida || !estado.partida.tablero) {
      return;
    }

    const { filas, columnas } = estado.partida.tablero;
    const anchoCaja = Math.min(1180, innerWidth - 28) - 44;
    const anchoUtil = anchoCaja - (PADDING_TABLERO * 2) - 2 - ((columnas - 1) * SEPARACION_CELDAS);
    const altoUtil = innerHeight - 320 - (PADDING_TABLERO * 2) - ((filas - 1) * SEPARACION_CELDAS);
    const porAlto = innerWidth > 1000 ? altoUtil / filas : Infinity;
    const lado = Math.max(
      LADO_MINIMO,
      Math.min(LADO_MAXIMO, Math.floor(Math.min(anchoUtil / columnas, porAlto)))
    );

    elementos.tablero.style.setProperty('--lado', `${lado}px`);
  }

  function ubicarCelda(elemento) {
    const boton = elemento.closest && elemento.closest('[data-fila][data-columna]');

    return boton
      ? { fila: Number(boton.dataset.fila), columna: Number(boton.dataset.columna) }
      : null;
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

  renderizarDificultad();
}
