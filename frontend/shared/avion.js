// Un avioncito de pixel art que cada tanto cruza el cielo del menu arrastrando
// un cartel con el nombre. Reemplaza al pill de marca que estaba arriba del
// titulo. Como celebracion.js, se trae su propio CSS: las paginas solo lo
// importan y lo llaman.

const RUTA_SPRITE = '/hub/assets/avion-catanet.png';
const ID_ESTILOS = 'catanet-avion-estilos';

// El sprite mide 93x18 y se agranda por un numero entero, si no los pixeles
// quedan borroneados
const ANCHO_SPRITE = 93;
const ALTO_SPRITE = 18;
const ESCALA = 3;
const ESCALA_CHICA = 2;
const AIRE = 5;                 // el lugar de sobra para que el balanceo no se corte

const DURACION = 20000;         // lo que tarda en cruzar de lado a lado
const PRIMERA_ESPERA = 7000;    // el primer vuelo, al ratito de entrar
const ESPERA_MINIMA = 60000;
const ESPERA_MAXIMA = 120000;

/**
 * Cuelga el avion arriba del titulo y lo hace pasar cada tanto.
 * @param {Object} opciones
 * @param {Element} [opciones.contenedor] Donde va, por defecto el `.hero`.
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

  inyectarEstilos();

  const cielo = document.createElement('div');
  const avion = document.createElement('div');
  const dibujo = document.createElement('img');

  cielo.className = 'avion-cielo';
  avion.className = 'avion';
  dibujo.src = RUTA_SPRITE;
  dibujo.alt = 'CataNet';
  dibujo.width = ANCHO_SPRITE * ESCALA;
  dibujo.height = ALTO_SPRITE * ESCALA;

  avion.appendChild(dibujo);
  cielo.appendChild(avion);
  contenedor.insertBefore(cielo, contenedor.firstChild);

  // Si la persona pidio menos movimiento el avion se queda quieto en el medio:
  // la marca sigue estando arriba del titulo, pero nada se mueve
  if (prefiereMenosMovimiento()) {
    cielo.classList.add('avion-cielo--quieto');

    return () => cielo.remove();
  }

  let reloj = setTimeout(volar, primeraEspera);

  function volar() {
    // En una pestaña de fondo el vuelo se lo pierde: mejor guardarlo
    if (!document.hidden) {
      avion.classList.remove('avion--volando');
      void avion.offsetWidth;            // reinicia la animacion
      avion.classList.add('avion--volando');
    }

    const espera = esperaMinima + Math.random() * (esperaMaxima - esperaMinima);

    reloj = setTimeout(volar, espera);
  }

  return function bajarAvion() {
    clearTimeout(reloj);
    cielo.remove();
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
      position: relative;
      width: 100%;
      height: ${ALTO_SPRITE * ESCALA + AIRE * 2}px;
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

    .avion img {
      display: block;
      width: ${ANCHO_SPRITE * ESCALA}px;
      height: ${ALTO_SPRITE * ESCALA}px;
      image-rendering: pixelated;
    }

    .avion--volando {
      animation: avion-cruza ${DURACION}ms linear;
    }

    .avion--volando img {
      animation: avion-flota 2.6s ease-in-out infinite alternate;
    }

    .avion-cielo--quieto .avion {
      justify-content: center;
      transform: none;
    }

    @keyframes avion-cruza {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    @keyframes avion-flota {
      from { transform: translateY(-3px); }
      to { transform: translateY(3px); }
    }

    /* En un telefono y en una pantalla baja el avion va a 2x: los menus de
       familia ahi achican todo para que las cards entren sin scroll */
    @media (max-width: 540px), (max-height: 820px) {
      .avion-cielo {
        height: ${ALTO_SPRITE * ESCALA_CHICA + AIRE * 2}px;
        margin-bottom: 10px;
      }

      .avion img {
        width: ${ANCHO_SPRITE * ESCALA_CHICA}px;
        height: ${ALTO_SPRITE * ESCALA_CHICA}px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .avion--volando,
      .avion--volando img {
        animation: none;
      }
    }
  `;

  document.head.appendChild(estilos);
}
