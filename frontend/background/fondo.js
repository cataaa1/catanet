// Monta el paisaje animado detrás de un menú. Se apoya en el fondo quieto que
// ya tiene el menú: mientras carga (o si algo falla, o si la persona pidió
// menos movimiento) se sigue viendo la ilustración de siempre.
import { crearPaisaje, CONSULTA_VERTICAL } from '/background/motor.js';
import { ESCENAS } from '/background/escenas.js';

// Lo que se puede tocar en un menú no cuenta como tocar el paisaje
const INTERACTIVOS = 'a, button, input, select, textarea, label, summary, dialog, [role="button"], .card';

export function montarFondoAnimado(numero, contenedor = document.querySelector('.bg-scene')) {
  const escena = ESCENAS[numero];
  if (!contenedor || !escena) return;
  const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  const vertical = matchMedia(CONSULTA_VERTICAL);
  let control = null;
  let lienzo = null;
  let turno = 0;

  async function montar() {
    const miTurno = ++turno;
    const nuevo = document.createElement('canvas');
    nuevo.className = 'bg-animado';
    nuevo.setAttribute('aria-hidden', 'true');
    Object.assign(nuevo.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: '0',
      transition: 'opacity 0.8s ease'
    });
    try {
      const esVertical = vertical.matches;
      const nuevoControl = await crearPaisaje(nuevo, esVertical ? escena.vertical : escena.horizontal, {
        ajuste: 'cubrir',
        // En el celular alcanza con menos cuadros y se cuida la batería
        fps: esVertical ? 24 : 30
      });
      // Si mientras cargaba se giró la pantalla, esta versión ya no sirve
      if (miTurno !== turno) {
        nuevoControl.destruir();
        return;
      }
      contenedor.appendChild(nuevo);
      const anterior = { control, lienzo };
      control = nuevoControl;
      lienzo = nuevo;
      if (!menosMovimiento.matches) control.reproducir();
      requestAnimationFrame(() => { nuevo.style.opacity = '1'; });
      if (anterior.control) {
        anterior.control.destruir();
        setTimeout(() => anterior.lienzo.remove(), 800);
      }
    } catch (error) {
      console.error('No se pudo animar el fondo; queda el fondo quieto.', error);
    }
  }

  vertical.addEventListener('change', montar);
  menosMovimiento.addEventListener('change', () => {
    if (menosMovimiento.matches) control?.pausar();
    else control?.reproducir();
  });

  window.addEventListener('pointermove', (evento) => {
    control?.mover(evento.clientX, evento.clientY);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => control?.salir());
  window.addEventListener('pointerdown', (evento) => {
    if (evento.target.closest?.(INTERACTIVOS)) return;
    control?.tocar(evento.clientX, evento.clientY);
  }, { passive: true });

  montar();
}
