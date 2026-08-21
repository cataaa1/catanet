// Festejo compartido para cuando alguien gana, en cualquier juego de CataNet.
// Dibuja papel picado sobre un canvas a pantalla completa y le da un pulso al
// panel de resultado. No usa librerias externas ni toca el CSS de cada juego.

const COLORES = ['#7bd0ff', '#ffd76b', '#8ff0c0', '#ff8fb1', '#dff4ff', '#c9a7ff'];
const CANTIDAD_POR_DEFECTO = 150;
const DURACION_MAXIMA = 4200;
const GRAVEDAD = 0.3;
const ROCE = 0.992;
const ID_ESTILOS = 'catanet-festejo-estilos';

let capa = null;
let particulas = [];
let animacion = null;
let inicio = 0;

/**
 * Lanza el festejo.
 * @param {Object} opciones
 * @param {Element} [opciones.elemento] Panel a animar. Por defecto el panel de
 *   resultado, que en todos los juegos es `#panel-resultado .resultado`.
 * @param {string[]} [opciones.colores] Paleta del papel picado.
 * @param {number} [opciones.cantidad] Cantidad de papelitos.
 */
export function festejar(opciones = {}) {
  const {
    colores = COLORES,
    cantidad = CANTIDAD_POR_DEFECTO,
    elemento = document.querySelector('#panel-resultado .resultado')
  } = opciones;

  // Si la persona pidio menos movimiento, el panel ya alcanza como aviso
  if (prefiereMenosMovimiento()) {
    return;
  }

  animarPanel(elemento);
  agregarParticulas(cantidad, colores);
  arrancarAnimacion();
}

/** Corta el festejo y limpia todo. Util al empezar una partida nueva. */
export function cortarFestejo() {
  removeEventListener('resize', ajustarTamanio);

  if (animacion !== null) {
    cancelAnimationFrame(animacion);
    animacion = null;
  }

  particulas = [];

  if (capa) {
    capa.remove();
    capa = null;
  }
}

function prefiereMenosMovimiento() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animarPanel(elemento) {
  if (!elemento) {
    return;
  }

  inyectarEstilos();

  // Reiniciamos la animacion por si el panel ya la tenia aplicada
  elemento.classList.remove('festejo-pulso');
  void elemento.offsetWidth;
  elemento.classList.add('festejo-pulso');
}

function inyectarEstilos() {
  if (document.getElementById(ID_ESTILOS)) {
    return;
  }

  const estilos = document.createElement('style');
  estilos.id = ID_ESTILOS;
  estilos.textContent = `
    @keyframes festejo-pulso {
      0% { transform: scale(0.86) translateY(14px); opacity: 0; }
      55% { transform: scale(1.04) translateY(0); opacity: 1; }
      75% { transform: scale(0.985); }
      100% { transform: scale(1); opacity: 1; }
    }

    .festejo-pulso {
      animation: festejo-pulso 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .festejo-capa {
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .festejo-pulso {
        animation: none;
      }
    }
  `;

  document.head.appendChild(estilos);
}

function obtenerCapa() {
  if (capa) {
    return capa;
  }

  inyectarEstilos();

  capa = document.createElement('canvas');
  capa.className = 'festejo-capa';
  capa.setAttribute('aria-hidden', 'true');
  document.body.appendChild(capa);
  ajustarTamanio();
  addEventListener('resize', ajustarTamanio);

  return capa;
}

function ajustarTamanio() {
  if (!capa) {
    return;
  }

  const densidad = Math.min(devicePixelRatio || 1, 2);

  capa.width = Math.floor(innerWidth * densidad);
  capa.height = Math.floor(innerHeight * densidad);
  capa.getContext('2d').setTransform(densidad, 0, 0, densidad, 0, 0);
}

// Dos canios, uno desde cada esquina de abajo, apuntando hacia el centro
function agregarParticulas(cantidad, colores) {
  obtenerCapa();

  const alto = innerHeight;
  const ancho = innerWidth;

  for (let indice = 0; indice < cantidad; indice += 1) {
    const desdeIzquierda = indice % 2 === 0;
    const anguloBase = desdeIzquierda ? -Math.PI / 3 : (-Math.PI * 2) / 3;
    const angulo = anguloBase + (Math.random() - 0.5) * 0.9;
    const velocidad = 16 + Math.random() * 13;

    particulas.push({
      x: desdeIzquierda ? ancho * 0.08 : ancho * 0.92,
      y: alto * 0.98,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad,
      ancho: 6 + Math.random() * 6,
      alto: 9 + Math.random() * 7,
      color: colores[Math.floor(Math.random() * colores.length)],
      rotacion: Math.random() * Math.PI * 2,
      giro: (Math.random() - 0.5) * 0.28,
      bamboleo: Math.random() * Math.PI * 2
    });
  }
}

function arrancarAnimacion() {
  inicio = performance.now();

  if (animacion !== null) {
    return;
  }

  animacion = requestAnimationFrame(dibujarCuadro);
}

function dibujarCuadro(ahora) {
  if (!capa) {
    animacion = null;
    return;
  }

  const contexto = capa.getContext('2d');
  const transcurrido = ahora - inicio;
  const desvanecido = Math.max(0, 1 - Math.max(0, transcurrido - 2200) / 1400);

  contexto.clearRect(0, 0, innerWidth, innerHeight);

  particulas = particulas.filter((particula) => {
    particula.vx *= ROCE;
    particula.vy = particula.vy * ROCE + GRAVEDAD;
    particula.bamboleo += 0.12;
    particula.x += particula.vx + Math.sin(particula.bamboleo) * 0.6;
    particula.y += particula.vy;
    particula.rotacion += particula.giro;

    if (particula.y > innerHeight + 40) {
      return false;
    }

    contexto.save();
    contexto.translate(particula.x, particula.y);
    contexto.rotate(particula.rotacion);
    contexto.globalAlpha = desvanecido;
    contexto.fillStyle = particula.color;
    // Achatamos el ancho segun el giro para simular el papel dando vueltas
    contexto.fillRect(
      -particula.ancho / 2,
      -particula.alto / 2,
      particula.ancho * Math.abs(Math.cos(particula.bamboleo)),
      particula.alto
    );
    contexto.restore();

    return true;
  });

  if (!particulas.length || transcurrido > DURACION_MAXIMA) {
    cortarFestejo();
    return;
  }

  animacion = requestAnimationFrame(dibujarCuadro);
}
