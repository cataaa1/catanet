import { crearReporte, informar } from './ayudas/reportar.mjs';
import { crearDom } from './ayudas/dom.mjs';
import { cargarJuego } from './ayudas/juego.mjs';
import { urlDe } from './ayudas/rutas.mjs';

const { chequear, resultados } = crearReporte();

const dom = crearDom();

// El teclado en pantalla se recorre con querySelectorAll('.tecla')
dom.porId('teclado').listas = { '.tecla': [] };

const { festejos } = await import(urlDe('tests', 'ayudas', 'stubs.mjs'));
const { espia } = await import(urlDe('tests', 'ayudas', 'palabras-espia.mjs'));

await cargarJuego('frontend/wordle/individual/game.js', {
  // Con el espia sabemos que palabra salio y podemos ganar a proposito
  reemplazos: { "'/shared/words.js'": `'${urlDe('tests', 'ayudas', 'palabras-espia.mjs')}'` }
});

const tablero = dom.porId('tablero');

/** Las letras de una fila del tablero: fila > .fila__celdas > celdas */
function letrasDeFila(indice) {
  const fila = tablero.hijos[indice];

  if (!fila || !fila.hijos[0]) return [];

  return fila.hijos[0].hijos.map((celda) => celda.textContent);
}

function coloresDeFila(indice) {
  const fila = tablero.hijos[indice];

  if (!fila || !fila.hijos[0]) return [];

  return fila.hijos[0].hijos.map((celda) => {
    const clase = [...celda.clases].find((c) => c.startsWith('celda--') && c !== 'celda--pendiente');
    return clase ? clase.replace('celda--', '') : '';
  });
}

const escribir = (palabra) => palabra.split('').forEach((letra) => dom.teclear(letra));

// --- Arranque ---
chequear('el tablero tiene seis filas', tablero.hijos.length === 6, `${tablero.hijos.length}`);
chequear('cada fila tiene cinco celdas', letrasDeFila(0).length === 5, `${letrasDeFila(0).length}`);
chequear('el tablero arranca vacio', letrasDeFila(0).every((letra) => letra === ''));
chequear('se sorteo una palabra secreta',
  /^[A-ZÑ]{5}$/.test(espia.ultimaPalabra), String(espia.ultimaPalabra));
chequear('el festejo no salta al arrancar', festejos.total === 0);
chequear('el panel de resultado arranca oculto', dom.porId('panel-resultado').hidden === true);

// --- Escribir letras aparece en la fila activa ---
escribir('CAS');
chequear('las letras aparecen mientras se escribe',
  letrasDeFila(0).slice(0, 3).join('') === 'CAS', letrasDeFila(0).join(''));
chequear('las celdas escritas quedan pendientes de color',
  coloresDeFila(0)[0] === '', coloresDeFila(0)[0]);

dom.teclear('Backspace');
chequear('borrar saca la ultima letra',
  letrasDeFila(0).slice(0, 3).join('') === 'CA', letrasDeFila(0).join(''));

// --- Confirmar con menos de cinco letras no avanza ---
dom.teclear('Enter');
chequear('no se puede confirmar con menos de cinco letras',
  letrasDeFila(1).every((letra) => letra === ''));
chequear('avisa que faltan letras', dom.porId('toast').hidden === false);

// --- Una palabra que no esta en la lista se rechaza ---
dom.teclear('Backspace');
dom.teclear('Backspace');
escribir('XKQZW');
dom.teclear('Enter');
chequear('una palabra inventada no avanza de fila',
  letrasDeFila(1).every((letra) => letra === ''));

// --- Un intento valido avanza y colorea ---
const { respuestasJuego } = await import(urlDe('tests', 'ayudas', 'palabras-espia.mjs'));
const fallida = respuestasJuego.find((palabra) => palabra !== espia.ultimaPalabra);

for (let i = 0; i < 5; i += 1) dom.teclear('Backspace');
escribir(fallida);
dom.teclear('Enter');

chequear('un intento valido queda en la primera fila',
  letrasDeFila(0).join('') === fallida, letrasDeFila(0).join(''));
chequear('las cinco celdas quedan coloreadas',
  coloresDeFila(0).every((color) => ['correcto', 'presente', 'ausente'].includes(color)),
  coloresDeFila(0).join());
chequear('la partida sigue', dom.porId('panel-resultado').hidden === true);

// --- Ganar ---
escribir(espia.ultimaPalabra);
dom.teclear('Enter');

chequear('acertar la palabra abre el panel de resultado',
  dom.porId('panel-resultado').hidden === false);
chequear('el titulo dice que ganaste',
  dom.porId('resultado-titulo').textContent === 'Ganaste',
  dom.porId('resultado-titulo').textContent);
chequear('la fila ganadora queda toda en verde',
  coloresDeFila(1).every((color) => color === 'correcto'), coloresDeFila(1).join());
chequear('ganar dispara el festejo', festejos.total === 1, `${festejos.total}`);

// --- Ganada la partida, no se sigue escribiendo ---
const antesDeInsistir = letrasDeFila(2).join('');
escribir('CASAS');
chequear('terminada la partida el tablero no responde',
  letrasDeFila(2).join('') === antesDeInsistir);

// --- Nueva palabra limpia todo ---
dom.disparar('boton-nueva', 'click', {});
chequear('nueva palabra cierra el resultado', dom.porId('panel-resultado').hidden === true);
chequear('nueva palabra limpia el tablero',
  letrasDeFila(0).every((letra) => letra === ''), letrasDeFila(0).join(''));
chequear('nueva palabra sortea otra secreta',
  /^[A-ZÑ]{5}$/.test(espia.ultimaPalabra));

// --- Perder tras seis intentos ---
const seisFallidas = respuestasJuego
  .filter((palabra) => palabra !== espia.ultimaPalabra)
  .slice(0, 6);

seisFallidas.forEach((palabra) => {
  escribir(palabra);
  dom.teclear('Enter');
});

chequear('a los seis intentos se pierde',
  dom.porId('panel-resultado').hidden === false);
chequear('el titulo avisa que se acabaron los intentos',
  dom.porId('resultado-titulo').textContent.includes('acabaron'),
  dom.porId('resultado-titulo').textContent);
chequear('el texto revela la palabra que era',
  dom.porId('resultado-texto').textContent.includes(espia.ultimaPalabra),
  dom.porId('resultado-texto').textContent);
chequear('perder no dispara el festejo', festejos.total === 1, `${festejos.total}`);

// --- La ayuda ---
chequear('la ayuda arranca cerrada', dom.porId('panel-ayuda').hidden === true);
dom.disparar('boton-ayuda', 'click', {});
chequear('el boton ? abre la ayuda', dom.porId('panel-ayuda').hidden === false);
dom.teclear('Escape');
chequear('Escape cierra la ayuda', dom.porId('panel-ayuda').hidden === true);

informar(resultados);
