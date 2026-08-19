// Agrega una cruz al panel de resultado para poder cerrarlo y mirar la partida.
// Vale para todos los juegos porque en todos el panel es
// `#panel-resultado` con una tarjeta `.resultado` adentro.

const ID_ESTILOS = 'catanet-cierre-resultado-estilos';
const CLASE_CERRADO = 'resultado-cerrado';
const CLASE_BOTON = 'resultado__cerrar';

/**
 * Habilita el cierre del panel de resultado.
 * Se puede cerrar con la cruz, con Escape o tocando fuera de la tarjeta.
 * Cuando el juego vuelve a ocultar el panel (partida nueva), el cierre se
 * reinicia solo para que el proximo resultado se muestre normalmente.
 */
export function habilitarCierreResultado(opciones = {}) {
  const panel = opciones.panel || document.getElementById('panel-resultado');

  if (!panel) {
    return;
  }

  const tarjeta = panel.querySelector('.resultado') || panel.firstElementChild;

  if (!tarjeta || tarjeta.querySelector(`.${CLASE_BOTON}`)) {
    return;
  }

  inyectarEstilos();
  tarjeta.appendChild(crearBoton(panel));

  panel.addEventListener('click', (evento) => {
    // Solo si el click fue en el fondo, no dentro de la tarjeta
    if (evento.target === panel) {
      cerrar(panel);
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || panel.hidden || panel.classList.contains(CLASE_CERRADO)) {
      return;
    }

    // Si la ayuda esta abierta, Escape es para ella: cierra lo de mas arriba
    const ayuda = document.getElementById('panel-ayuda');

    if (ayuda && !ayuda.hidden) {
      return;
    }

    cerrar(panel);
  });

  // Los juegos re-renderizan seguido y vuelven a poner hidden = false, asi que
  // el cierre se sostiene con una clase y se limpia recien en la partida nueva.
  new MutationObserver(() => {
    if (panel.hidden) {
      panel.classList.remove(CLASE_CERRADO);
    }
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
}

function cerrar(panel) {
  panel.classList.add(CLASE_CERRADO);
}

function crearBoton(panel) {
  const boton = document.createElement('button');

  boton.type = 'button';
  boton.className = CLASE_BOTON;
  boton.setAttribute('aria-label', 'Cerrar y ver la partida');
  boton.title = 'Cerrar y ver la partida';
  boton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<line x1="6" y1="6" x2="18" y2="18"></line>'
    + '<line x1="18" y1="6" x2="6" y2="18"></line></svg>';
  boton.addEventListener('click', () => cerrar(panel));

  return boton;
}

function inyectarEstilos() {
  if (document.getElementById(ID_ESTILOS)) {
    return;
  }

  const estilos = document.createElement('style');

  estilos.id = ID_ESTILOS;
  estilos.textContent = `
    #panel-resultado.${CLASE_CERRADO} {
      display: none !important;
    }

    #panel-resultado .resultado {
      position: relative;
    }

    .${CLASE_BOTON} {
      position: absolute;
      top: 10px;
      right: 10px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.09);
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
      transition: background 0.18s ease, opacity 0.18s ease;
    }

    .${CLASE_BOTON}:hover {
      background: rgba(255, 255, 255, 0.18);
      opacity: 1;
    }

    .${CLASE_BOTON} svg {
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
    }
  `;

  document.head.appendChild(estilos);
}
