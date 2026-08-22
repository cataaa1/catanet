// Un avioncito de pixel art que cada tanto cruza el cielo del menu arrastrando
// un cartel con el nombre. Reemplaza al pill de marca que estaba arriba del
// titulo. Como celebracion.js, se trae su propio CSS: las paginas solo lo
// importan y lo llaman.

const RUTA_SPRITE = '/hub/assets/avion-catanet.png';
const ID_ESTILOS = 'catanet-avion-estilos';

// El sprite es una tira de tres cuadros, uno debajo del otro, que se van
// alternando para que la helice parezca girar. Se agranda por un numero
// entero, si no los pixeles quedan borroneados.
const ANCHO_SPRITE = 93;
const ALTO_SPRITE = 18;
const CUADROS = 3;
const ESCALA = 3;
const ESCALA_CHICA = 2;

const DURACION = 20000;         // lo que tarda en cruzar de lado a lado
const PRIMERA_ESPERA = 7000;    // el primer vuelo, al ratito de entrar
const ESPERA_MINIMA = 30000;
const ESPERA_MAXIMA = 60000;
const PUFS = 5;                 // las bocanadas de humo que va dejando atras

/**
 * Cuelga el avion arriba del titulo y lo hace pasar cada tanto.
 * @param {Object} opciones
 * @param {Element} [opciones.contenedor] Donde va, por defecto el `.hero`.
 * @param {Element} [opciones.llamador] Que hay que tocar para llamarlo, por
 *   defecto la palabra destacada del titulo.
 * @param {number} [opciones.primeraEspera] Cuanto tarda el primer vuelo, en ms.
 * @param {number} [opciones.esperaMinima] Lo menos que espera entre vuelos.
 * @param {number} [opciones.esperaMaxima] Lo mas que espera entre vuelos.
 * @returns {Function} Para sacarlo y cortar los vuelos.
 */
export function programarAvion(opciones = {}) {
  const {
    contenedor = document.querySelector('.hero'),
    primeraEspera = PRIMERA_ESPERA,
    esperaMinima = ESPERA_MINIMA,
    esperaMaxima = ESPERA_MAXIMA
  } = opciones;

  if (!contenedor) {
    return () => {};
  }

  const llamador = 'llamador' in opciones
    ? opciones.llamador
    : contenedor.querySelector('.accent');

  inyectarEstilos();

  const cielo = document.createElement('div');
  const avion = document.createElement('div');
  const cuerpo = document.createElement('div');
  const dibujo = document.createElement('span');

  cielo.className = 'avion-cielo';
  avion.className = 'avion';
  cuerpo.className = 'avion__cuerpo';
  dibujo.className = 'avion__dibujo';
  dibujo.setAttribute('role', 'img');
  dibujo.setAttribute('aria-label', 'CataNet');

  // El humo va antes que el dibujo para que quede por detras del avion
  for (let i = 0; i < PUFS; i += 1) {
    const puf = document.createElement('span');

    puf.className = 'avion__humo';
    cuerpo.appendChild(puf);
  }

  cuerpo.appendChild(dibujo);
  avion.appendChild(cuerpo);
  cielo.appendChild(avion);
  contenedor.insertBefore(cielo, contenedor.firstChild);

  // Si la persona pidio menos movimiento el avion se queda quieto en el medio:
  // la marca sigue estando arriba del titulo, pero nada se mueve
  if (prefiereMenosMovimiento()) {
    cielo.classList.add('avion-cielo--quieto');

    return () => cielo.remove();
  }

  let volando = false;
  let relojVuelo = null;
  let reloj = setTimeout(volar, primeraEspera);

  /**
   * Lo hace pasar y deja programado el siguiente. Si ya viene cruzando no hace
   * nada: eso es lo que evita que tocando el titulo salgan diez seguidos.
   */
  function volar() {
    clearTimeout(reloj);

    // En una pestaña de fondo el vuelo se lo pierde: mejor guardarlo
    if (!volando && !document.hidden) {
      volando = true;
      avion.classList.remove('avion--volando');
      void avion.offsetWidth;            // reinicia la animacion
      avion.classList.add('avion--volando');
      relojVuelo = setTimeout(() => { volando = false; }, DURACION);
    }

    reloj = setTimeout(volar, esperaMinima + Math.random() * (esperaMaxima - esperaMinima));
  }

  function alTeclear(evento) {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      volar();
    }
  }

  if (llamador) {
    llamador.classList.add('avion-llamador');
    llamador.setAttribute('role', 'button');
    llamador.setAttribute('tabindex', '0');
    llamador.setAttribute('title', 'Hacer pasar el avion');
    llamador.addEventListener('click', volar);
    llamador.addEventListener('keydown', alTeclear);
  }

  return function bajarAvion() {
    clearTimeout(reloj);
    clearTimeout(relojVuelo);
    cielo.remove();

    if (llamador) {
      llamador.classList.remove('avion-llamador');
      llamador.removeEventListener('click', volar);
      llamador.removeEventListener('keydown', alTeclear);
    }
  };
}

function prefiereMenosMovimiento() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function inyectarEstilos() {
  if (document.getElementById(ID_ESTILOS)) {
    return;
  }

  const estilos = document.createElement('style');

  estilos.id = ID_ESTILOS;
  // El avion va dentro de una franja del ancho del contenido. El truco del
  // -100% al 100% es que los porcentajes de translateX miden el ancho del
  // propio elemento, y `.avion` ocupa toda la franja: asi entra y sale justo,
  // sea cual sea el ancho de la pantalla.
  estilos.textContent = `
    .avion-cielo {
      --avion-onda: 9px;
      --avion-estela: 96px;
      position: relative;
      width: 100%;
      height: calc(${ALTO_SPRITE * ESCALA}px + var(--avion-onda) * 2 + 4px);
      margin-bottom: 14px;
      overflow: hidden;
      pointer-events: none;
    }

    .avion {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      transform: translateX(-100%);
    }

    .avion__cuerpo {
      position: relative;
      width: ${ANCHO_SPRITE * ESCALA}px;
      height: ${ALTO_SPRITE * ESCALA}px;
    }

    /* El sprite trae los tres cuadros apilados. Con el fondo al 300% de alto y
       la posicion en porcentaje, el mismo CSS sirve para cualquier escala. */
    .avion__dibujo {
      position: absolute;
      inset: 0;
      background-image: url("${RUTA_SPRITE}");
      background-repeat: no-repeat;
      background-size: 100% ${CUADROS * 100}%;
      background-position: 0 0;
      image-rendering: pixelated;
    }

    .avion__humo {
      position: absolute;
      right: 14px;
      top: 26px;
      width: 6px;
      height: 6px;
      border-radius: 2px;
      background: rgba(167, 144, 165, 0.5);
      opacity: 0;
    }

    .avion--volando {
      animation: avion-cruza ${DURACION}ms linear;
    }

    .avion--volando .avion__cuerpo {
      animation: avion-viborea 4.4s ease-in-out infinite;
    }

    .avion--volando .avion__dibujo {
      animation: avion-helice 0.18s steps(${CUADROS}) infinite;
    }

    .avion--volando .avion__humo {
      animation: avion-humo 1.9s linear infinite;
    }

    .avion--volando .avion__humo:nth-child(2) { animation-delay: 0.38s; }
    .avion--volando .avion__humo:nth-child(3) { animation-delay: 0.76s; }
    .avion--volando .avion__humo:nth-child(4) { animation-delay: 1.14s; }
    .avion--volando .avion__humo:nth-child(5) { animation-delay: 1.52s; }

    .avion-cielo--quieto .avion {
      justify-content: center;
      transform: none;
    }

    /* Tocando la palabra destacada del titulo, el avion pasa */
    .avion-llamador {
      cursor: pointer;
      transition: filter 0.2s ease;
    }

    .avion-llamador:hover,
    .avion-llamador:focus-visible {
      filter: brightness(1.12);
    }

    @keyframes avion-cruza {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    /* Un viboreo con los pasos desparejos, que queda mas vivo que una onda
       perfecta: el avion sube, cae, se vuelve a acomodar */
    @keyframes avion-viborea {
      0% { transform: translateY(0); }
      14% { transform: translateY(calc(var(--avion-onda) * -1)); }
      32% { transform: translateY(calc(var(--avion-onda) * 0.55)); }
      52% { transform: translateY(calc(var(--avion-onda) * -0.85)); }
      74% { transform: translateY(var(--avion-onda)); }
      90% { transform: translateY(calc(var(--avion-onda) * -0.35)); }
      100% { transform: translateY(0); }
    }

    /* Con tres pasos, ir de 0% a 150% hace parar en 0%, 50% y 100%: los tres
       cuadros del sprite, sin depender de a cuanto se agrando */
    @keyframes avion-helice {
      from { background-position-y: 0%; }
      to { background-position-y: 150%; }
    }

    /* El humo se va para atras mas o menos a la velocidad a la que avanza el
       avion, asi parece que se queda flotando en el aire */
    @keyframes avion-humo {
      0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
      12% { opacity: 0.5; }
      100% {
        transform: translate(calc(var(--avion-estela) * -1), -20px) scale(2.1);
        opacity: 0;
      }
    }

    /* En un telefono y en una pantalla baja el avion va a 2x: los menus de
       familia ahi achican todo para que las cards entren sin scroll */
    @media (max-width: 540px), (max-height: 820px) {
      .avion-cielo {
        --avion-onda: 6px;
        --avion-estela: 64px;
        height: calc(${ALTO_SPRITE * ESCALA_CHICA}px + var(--avion-onda) * 2 + 4px);
        margin-bottom: 10px;
      }

      .avion__cuerpo {
        width: ${ANCHO_SPRITE * ESCALA_CHICA}px;
        height: ${ALTO_SPRITE * ESCALA_CHICA}px;
      }

      .avion__humo {
        right: 10px;
        top: 17px;
        width: 4px;
        height: 4px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .avion--volando,
      .avion--volando .avion__cuerpo,
      .avion--volando .avion__dibujo,
      .avion--volando .avion__humo {
        animation: none;
      }
    }
  `;

  document.head.appendChild(estilos);
}
