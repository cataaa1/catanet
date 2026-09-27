// Las páginas de /background: un paisaje a pantalla completa con controles.
// Muestra la versión vertical en celulares parados, igual que los menús.
// Para ver una versión en particular: ?vertical o ?horizontal
import { crearPaisaje, CONSULTA_VERTICAL } from '/background/motor.js';
import { ESCENAS } from '/background/escenas.js';

export async function iniciarPagina(numero) {
  const escena = ESCENAS[numero];
  const lienzo = document.querySelector('#escena');
  const imagenPagina = document.querySelector('.lienzo img');
  const pausa = document.querySelector('#pausa');
  const estado = document.querySelector('#estado');
  const zona = document.querySelector('.paisaje');
  const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  const parametros = new URLSearchParams(location.search);
  const mensajeVivo = estado.textContent;
  const mensajeQuieto = 'Un momento de quietud. Animación pausada.';

  const esVertical = parametros.has('vertical') || (!parametros.has('horizontal') && matchMedia(CONSULTA_VERTICAL).matches);
  const variante = esVertical ? escena.vertical : escena.horizontal;
  imagenPagina.src = variante.imagen;
  zona.style.setProperty('--fondo', `url('${variante.imagen}')`);
  imagenPagina.decode().then(() => {
    zona.style.setProperty('--proporcion', String(imagenPagina.naturalWidth / imagenPagina.naturalHeight));
  }).catch(() => {});

  let pausado = menosMovimiento.matches;
  let control = null;

  function sincronizar() {
    pausa.textContent = pausado ? 'Reanudar' : 'Pausar';
    estado.textContent = pausado ? mensajeQuieto : mensajeVivo;
    if (!control) return;
    if (pausado) control.pausar();
    else control.reproducir();
  }

  pausa.addEventListener('click', () => {
    pausado = !pausado;
    sincronizar();
  });
  menosMovimiento.addEventListener('change', (evento) => {
    pausado = evento.matches;
    sincronizar();
  });
  zona.addEventListener('pointermove', (evento) => control?.mover(evento.clientX, evento.clientY));
  zona.addEventListener('pointerleave', () => control?.salir());
  zona.addEventListener('pointerdown', (evento) => {
    if (evento.target.closest('button, a')) return;
    control?.tocar(evento.clientX, evento.clientY);
  });
  prepararControles(estado);

  try {
    control = await crearPaisaje(lienzo, variante);
    pausa.disabled = false;
    sincronizar();
  } catch (error) {
    console.error('No se pudo preparar el paisaje:', error);
    estado.textContent = 'No se pudo animar el paisaje. Probá recargar la página.';
  }

  // Si se gira la pantalla y no se pidió una versión fija, se recarga la que corresponde
  if (!parametros.has('vertical') && !parametros.has('horizontal')) {
    matchMedia(CONSULTA_VERTICAL).addEventListener('change', (evento) => {
      if (evento.matches !== esVertical) location.reload();
    });
  }
}

// Botones de ocultar la interfaz y de pantalla completa
function prepararControles(estado) {
  const pantalla = document.querySelector('#pantalla');
  const ocultar = document.querySelector('#ocultar');
  const mostrar = document.querySelector('#mostrar');

  function mostrarInterfaz(visible) {
    document.querySelectorAll('.interfaz').forEach((elemento) => { elemento.hidden = !visible; });
    mostrar.hidden = visible;
    ocultar.setAttribute('aria-pressed', String(!visible));
    (visible ? ocultar : mostrar).focus();
  }
  ocultar.addEventListener('click', () => mostrarInterfaz(false));
  mostrar.addEventListener('click', () => mostrarInterfaz(true));
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !mostrar.hidden) mostrarInterfaz(true);
  });

  pantalla.hidden = !document.fullscreenEnabled;
  pantalla.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      estado.textContent = 'Tu navegador no pudo abrir la pantalla completa.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    pantalla.textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
  });
}
