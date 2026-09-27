// Motor de los paisajes animados.
// Toma una ilustración pixel art y una máscara de regiones (hecha a mano una
// vez por fondo) y le da vida: el cielo corre, las plantas se mecen con el
// viento, el pasto ondea, el agua brilla, y cada escena suma sus animales.
//
// La máscara es un PNG del mismo tamaño que la ilustración:
//   rojo  = región (1 cielo, 2 planta, 3 pasto, 4 agua, 0 queda quieto)
//   verde = número de planta (cada árbol o mata se mueve por su cuenta)
//   azul  = fuerza del viento en esa planta (100 = normal)

// El viento se calcula sobre este ancho de referencia, sea cual sea la imagen
const ANCHO_VIENTO = 1400;

const REGION = { cielo: 1, planta: 2, pasto: 3, agua: 4 };
const MARGEN_PLANTA = 8; // cuánto puede salirse una copa de su dibujo original

function crearLienzo(ancho, alto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext('2d');
  contexto.imageSmoothingEnabled = false;
  return { lienzo, contexto };
}

function cargarImagen(ruta) {
  const imagen = new Image();
  imagen.src = ruta;
  return imagen.decode().then(() => imagen);
}

function modulo(a, b) {
  return ((a % b) + b) % b;
}

export function suave(desde, hasta, valor) {
  const t = Math.min(1, Math.max(0, (valor - desde) / (hasta - desde)));
  return t * t * (3 - 2 * t);
}

// Generador con semilla: las mismas posiciones en cada visita
export function crearAzar(semilla = 1) {
  let estado = semilla % 2147483647 || 1;
  return () => {
    estado = (estado * 16807) % 2147483647;
    return (estado - 1) / 2147483646;
  };
}

// El viento sopla hacia la derecha: una base que respira y ráfagas que
// recorren el paisaje de izquierda a derecha.
export function viento(x, tiempo) {
  const base = 0.55 + 0.18 * Math.sin(tiempo * 0.31) + 0.1 * Math.sin(tiempo * 0.83 + 1.3);
  const frente = Math.sin(x / ANCHO_VIENTO * Math.PI - tiempo * 0.42);
  const rafaga = Math.pow(Math.max(0, frente), 6) * 0.55;
  return base + rafaga;
}

// Convierte los píxeles de la máscara en recortes listos para usar
function leerMascara(imagenMascara) {
  const ANCHO = imagenMascara.naturalWidth;
  const ALTO = imagenMascara.naturalHeight;
  const { contexto } = crearLienzo(ANCHO, ALTO);
  contexto.drawImage(imagenMascara, 0, 0);
  const datos = contexto.getImageData(0, 0, ANCHO, ALTO).data;
  const regiones = new Uint8Array(ANCHO * ALTO);
  const recortes = {};
  const plantas = new Map();

  for (let i = 0, p = 0; p < regiones.length; i += 4, p++) {
    const region = datos[i];
    regiones[p] = region;
    if (region === REGION.planta) {
      const id = datos[i + 1];
      const x = p % ANCHO;
      const y = (p - x) / ANCHO;
      let planta = plantas.get(id);
      if (!planta) {
        planta = { id, fuerza: datos[i + 2] / 100, x0: x, y0: y, x1: x, y1: y };
        plantas.set(id, planta);
      }
      planta.x0 = Math.min(planta.x0, x);
      planta.x1 = Math.max(planta.x1, x);
      planta.y0 = Math.min(planta.y0, y);
      planta.y1 = Math.max(planta.y1, y);
    }
  }

  // Un recorte por región: opaco donde la región vale, transparente afuera
  for (const [nombre, codigo] of Object.entries(REGION)) {
    if (codigo === REGION.planta) continue;
    const { lienzo, contexto: ctx } = crearLienzo(ANCHO, ALTO);
    const imagen = ctx.createImageData(ANCHO, ALTO);
    let caja = null;
    for (let p = 0; p < regiones.length; p++) {
      if (regiones[p] !== codigo) continue;
      imagen.data[p * 4 + 3] = 255;
      const x = p % ANCHO;
      const y = (p - x) / ANCHO;
      if (!caja) caja = { x0: x, y0: y, x1: x, y1: y };
      caja.x0 = Math.min(caja.x0, x);
      caja.x1 = Math.max(caja.x1, x);
      caja.y1 = y;
    }
    ctx.putImageData(imagen, 0, 0);
    recortes[nombre] = caja ? { lienzo, caja } : null;
  }

  // Cada planta tiene su propio recorte, ensanchado a los costados para que
  // la copa pueda asomarse cuando el viento la empuja
  for (const planta of plantas.values()) {
    planta.x0 = Math.max(0, planta.x0 - MARGEN_PLANTA);
    planta.x1 = Math.min(ANCHO - 1, planta.x1 + MARGEN_PLANTA);
    const ancho = planta.x1 - planta.x0 + 1;
    const alto = planta.y1 - planta.y0 + 1;
    const exacta = crearLienzo(ancho, alto);
    const imagen = exacta.contexto.createImageData(ancho, alto);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const p = (planta.y0 + y) * ANCHO + planta.x0 + x;
        if (regiones[p] === REGION.planta && datos[p * 4 + 1] === planta.id) {
          imagen.data[(y * ancho + x) * 4 + 3] = 255;
        }
      }
    }
    exacta.contexto.putImageData(imagen, 0, 0);
    const ancha = crearLienzo(ancho, alto);
    for (let dx = -MARGEN_PLANTA; dx <= MARGEN_PLANTA; dx++) {
      ancha.contexto.drawImage(exacta.lienzo, dx, 0);
    }
    planta.recorte = ancha.lienzo;
    planta.capa = crearLienzo(ancho, alto);
  }

  return {
    ancho: ANCHO,
    alto: ALTO,
    recortes,
    plantas: [...plantas.values()],
    region(x, y) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= ANCHO || y >= ALTO) return 0;
      return regiones[y * ANCHO + x];
    }
  };
}

// Dibuja un sprite hecho de texto. Cada letra es un color de la paleta y el
// punto es transparente. Se pre-renderiza una vez y después se escala.
export function prepararSprite(filas, paleta) {
  const alto = filas.length;
  const ancho = Math.max(...filas.map((fila) => fila.length));
  const { lienzo, contexto } = crearLienzo(ancho, alto);
  filas.forEach((fila, y) => {
    [...fila].forEach((letra, x) => {
      const color = paleta[letra];
      if (!color) return;
      contexto.fillStyle = color;
      contexto.fillRect(x, y, 1, 1);
    });
  });
  return { lienzo, ancho, alto };
}

export function dibujarSprite(ctx, sprite, x, y, { escala = 4, espejo = false, alfa = 1 } = {}) {
  // (x, y) es el punto de apoyo: centro de la base del sprite
  const ancho = sprite.ancho * escala;
  const alto = sprite.alto * escala;
  const izquierda = Math.round(x - ancho / 2);
  const arriba = Math.round(y - alto);
  ctx.save();
  ctx.globalAlpha = alfa;
  if (espejo) {
    ctx.translate(izquierda + ancho, arriba);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite.lienzo, 0, 0, ancho, alto);
  } else {
    ctx.drawImage(sprite.lienzo, izquierda, arriba, ancho, alto);
  }
  ctx.restore();
}

export function pixel(ctx, x, y, ancho, alto, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), ancho, alto);
}

// Arma un paisaje vivo sobre un <canvas>. Devuelve un control para pausarlo,
// reanudarlo, pasarle el puntero y desarmarlo. Lo usan tanto las páginas de
// /background como los fondos de los menús.
//   ajuste: 'cubrir' si el canvas se muestra con object-fit: cover
export async function crearPaisaje(lienzo, escena, { fps = 30, ajuste = 'contener' } = {}) {
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const [imagen, imagenMascara, textura] = await Promise.all([
    cargarImagen(escena.imagen),
    cargarImagen(escena.mascara),
    cargarImagen(escena.cielo.textura)
  ]);
  const mascara = leerMascara(imagenMascara);
  const ANCHO = mascara.ancho;
  const ALTO = mascara.alto;
  // En las ilustraciones verticales el píxel del dibujo es más grande: todo
  // movimiento se agranda en la misma proporción, y los animales viven en
  // coordenadas achicadas por ese factor (así se comportan igual en ambas)
  const escalaMovimiento = escena.movimiento ?? 1;
  const mundo = {
    ...mascara,
    ancho: ANCHO / escalaMovimiento,
    alto: ALTO / escalaMovimiento,
    region: (x, y) => mascara.region(x * escalaMovimiento, y * escalaMovimiento),
    imagen,
    textura,
    puntero: null,
    vida: []
  };
  mundo.vida = escena.crearVida ? escena.crearVida(mundo) : [];

  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  ctx.imageSmoothingEnabled = false;
  const fuente = crearLienzo(ANCHO, ALTO);
  const capa = crearLienzo(ANCHO, ALTO);

  let tiempo = 0;
  let anterior = null;
  let cuadro = null;
  let activo = false;

  function dibujarCielo() {
    const recorte = mundo.recortes.cielo;
    if (!recorte) return;
    const altoCielo = textura.height;
    const largo = textura.width;
    const c = capa.contexto;
    c.clearRect(0, 0, ANCHO, altoCielo);
    // Cada franja corre a su velocidad: lo alto va más rápido que lo cercano
    // al horizonte, como pasa con las nubes de verdad
    let y = 0;
    while (y < altoCielo) {
      const desplazamiento = Math.round(escena.cielo.velocidad(y) * tiempo);
      let alto = 1;
      while (y + alto < altoCielo && alto < 6
        && Math.round(escena.cielo.velocidad(y + alto) * tiempo) === desplazamiento) alto++;
      const inicio = modulo(desplazamiento, largo) - largo;
      for (let x = inicio; x < ANCHO; x += largo) {
        c.drawImage(textura, 0, y, largo, alto, x, y, largo, alto);
      }
      y += alto;
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(recorte.lienzo, 0, 0, ANCHO, altoCielo, 0, 0, ANCHO, altoCielo);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(capa.lienzo, 0, 0, ANCHO, altoCielo, 0, 0, ANCHO, altoCielo);
  }

  function dibujarEstrellas() {
    for (const [x, y, ancho, alto] of escena.estrellas || []) {
      const fase = x * 0.37 + y * 0.11;
      const brillo = 0.35 + 0.65 * Math.pow((1 + Math.sin(tiempo * (0.9 + (x % 7) * 0.12) + fase)) / 2, 2);
      ctx.globalAlpha = brillo;
      ctx.drawImage(imagen, x, y, ancho, alto, x, y, ancho, alto);
    }
    ctx.globalAlpha = 1;
  }

  function dibujarSol() {
    const sol = escena.sol;
    if (!sol) return;
    // El resplandor respira muy despacio
    const pulso = 0.5 + 0.5 * Math.sin(tiempo * 0.5);
    const brillo = ctx.createRadialGradient(sol.x, sol.y, sol.radio * 0.8, sol.x, sol.y, sol.radio * 3.2);
    brillo.addColorStop(0, `rgba(255, 246, 232, ${0.1 + pulso * 0.06})`);
    brillo.addColorStop(1, 'rgba(255, 246, 232, 0)');
    ctx.fillStyle = brillo;
    ctx.fillRect(sol.x - sol.radio * 3.2, sol.y - sol.radio * 3.2, sol.radio * 6.4, sol.radio * 6.4);
  }

  function dibujarPlantas() {
    const franja = Math.max(3, Math.round(3 * escalaMovimiento));
    for (const planta of mundo.plantas) {
      const { contexto: c, lienzo: capaPlanta } = planta.capa;
      const ancho = capaPlanta.width;
      const alto = capaPlanta.height;
      const fuerzaViento = viento((planta.x0 + planta.x1) / 2 / escalaMovimiento, tiempo);
      c.clearRect(0, 0, ancho, alto);
      for (let y = 0; y < alto; y += franja) {
        // Arriba se mueve mucho, abajo casi nada: la planta se dobla desde la base
        const altura = 1 - y / alto;
        const v = (planta.y0 + y) / escalaMovimiento;
        const inclinacion = planta.fuerza * 6 * (fuerzaViento - 0.55) * Math.pow(altura, 1.6);
        const temblor = planta.fuerza * 1.3 * Math.pow(altura, 0.7) * (0.45 + fuerzaViento)
          * (Math.sin(tiempo * 5.1 + v * 0.21 + planta.id * 1.7)
            + 0.6 * Math.sin(tiempo * 7.7 + v * 0.47 + planta.id));
        const dx = Math.round((inclinacion + temblor * 0.8) * escalaMovimiento);
        if (dx === 0) continue;
        c.drawImage(fuente.lienzo, planta.x0, planta.y0 + y, ancho, franja, dx, y, ancho, franja);
      }
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(planta.recorte, 0, 0);
      c.globalCompositeOperation = 'source-over';
      ctx.drawImage(capaPlanta, planta.x0, planta.y0);
    }
  }

  function dibujarPasto() {
    const recorte = mundo.recortes.pasto;
    if (!recorte) return;
    const { caja } = recorte;
    const opciones = escena.pasto || {};
    const amplitud = (opciones.amplitud ?? 3) * escalaMovimiento;
    const c = capa.contexto;
    const bloque = Math.round(36 * escalaMovimiento);
    const fila = Math.round(4 * escalaMovimiento);
    const altoPasto = caja.y1 - caja.y0 + 1;
    c.clearRect(0, caja.y0, ANCHO, altoPasto);
    for (let y = caja.y0, n = 0; y <= caja.y1; y += fila, n++) {
      // Lo lejano casi no se mueve; lo cercano, bastante
      const cerca = suave(caja.y0 - 40, ALTO, y);
      if (amplitud * cerca < 0.5) continue;
      const corrimiento = n % 2 ? bloque / 2 : 0;
      for (let x = Math.max(0, caja.x0 - corrimiento); x <= caja.x1; x += bloque) {
        const u = x / escalaMovimiento;
        const v = y / escalaMovimiento;
        const ola = Math.sin(u * 0.011 - tiempo * 1.9 + v * 0.013)
          + 0.45 * Math.sin(u * 0.043 + tiempo * 3.3 + v * 0.09);
        const dx = Math.round(amplitud * cerca * ((viento(u, tiempo) - 0.55) * 2.2 + ola * 0.5));
        // Si el bloque no se corre, lo que ya está dibujado sirve
        if (dx === 0) continue;
        c.drawImage(fuente.lienzo, x, y, bloque, fila, x + dx, y, bloque, fila);
      }
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(recorte.lienzo, 0, caja.y0, ANCHO, altoPasto, 0, caja.y0, ANCHO, altoPasto);
    // El viento peinando el pasto: franjas de luz que lo cruzan
    if (opciones.brillo) {
      c.globalCompositeOperation = 'source-atop';
      const media = 220 * escalaMovimiento;
      for (let i = 0; i < 3; i++) {
        const x = modulo((tiempo * 70 + i * 700) * escalaMovimiento, ANCHO + 4 * media) - 2 * media;
        const luz = c.createLinearGradient(x - media, 0, x + media, 0);
        luz.addColorStop(0, 'rgba(255, 255, 240, 0)');
        luz.addColorStop(0.5, `rgba(255, 255, 240, ${opciones.brillo})`);
        luz.addColorStop(1, 'rgba(255, 255, 240, 0)');
        c.fillStyle = luz;
        c.fillRect(x - media, caja.y0, media * 2, altoPasto);
      }
    }
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(capa.lienzo, 0, caja.y0, ANCHO, altoPasto, 0, caja.y0, ANCHO, altoPasto);
  }

  function dibujarAgua() {
    const recorte = mundo.recortes.agua;
    if (!recorte) return;
    const { caja } = recorte;
    const alto = caja.y1 - caja.y0 + 1;
    const franja = Math.max(2, Math.round(2 * escalaMovimiento));
    const c = capa.contexto;
    c.clearRect(0, caja.y0, ANCHO, alto);
    // Correr franjas de la propia imagen hace temblar los reflejos
    for (let y = caja.y0; y <= caja.y1; y += franja) {
      const profundidad = (y - caja.y0) / alto;
      const v = y / escalaMovimiento;
      const dx = Math.round((Math.sin(v * 0.12 - tiempo * 2) + 0.5 * Math.sin(v * 0.27 + tiempo * 1.3))
        * (1 + profundidad * 3) * (escena.agua?.amplitud ?? 1) * escalaMovimiento);
      if (dx === 0) continue;
      c.drawImage(fuente.lienzo, 0, y, ANCHO, franja, dx, y, ANCHO, franja);
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(recorte.lienzo, 0, caja.y0, ANCHO, alto, 0, caja.y0, ANCHO, alto);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(capa.lienzo, 0, caja.y0, ANCHO, alto, 0, caja.y0, ANCHO, alto);
  }

  function dibujarVida(capaVida, dt) {
    ctx.save();
    ctx.scale(escalaMovimiento, escalaMovimiento);
    for (const ser of mundo.vida) {
      if (ser.capa !== capaVida) continue;
      if (dt > 0) ser.actualizar?.(dt, tiempo, mundo);
      ser.dibujar(ctx, tiempo, mundo);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function dibujar(dt) {
    ctx.drawImage(imagen, 0, 0);
    dibujarCielo();
    dibujarEstrellas();
    dibujarSol();
    // Todo lo que tapa al cielo sale de esta foto, así los pájaros quedan
    // detrás de los árboles
    fuente.contexto.drawImage(lienzo, 0, 0);
    dibujarVida('cielo', dt);
    dibujarPlantas();
    dibujarAgua();
    dibujarVida('agua', dt);
    dibujarPasto();
    dibujarVida('suelo', dt);
    dibujarVida('aire', dt);
  }

  function animar(ahora) {
    cuadro = null;
    if (!activo || document.hidden) return;
    // Sin pasarse de los fps pedidos; al volver a la pestaña no se salta el tiempo
    if (anterior === null || ahora - anterior >= 1000 / (fps + 1)) {
      const dt = anterior === null ? 0 : Math.min((ahora - anterior) / 1000, 0.1);
      tiempo += dt;
      anterior = ahora;
      dibujar(dt);
    }
    cuadro = requestAnimationFrame(animar);
  }

  function sincronizar() {
    if (cuadro !== null) cancelAnimationFrame(cuadro);
    cuadro = null;
    anterior = null;
    if (activo && !document.hidden) cuadro = requestAnimationFrame(animar);
  }
  document.addEventListener('visibilitychange', sincronizar);

  // Pasa un punto de la pantalla a las coordenadas de los animales
  function aCoordenadas(clienteX, clienteY) {
    const rect = lienzo.getBoundingClientRect();
    const escalas = [rect.width / ANCHO, rect.height / ALTO];
    const escala = ajuste === 'cubrir' ? Math.max(...escalas) : Math.min(...escalas);
    return {
      x: (clienteX - rect.left - (rect.width - ANCHO * escala) / 2) / escala / escalaMovimiento,
      y: (clienteY - rect.top - (rect.height - ALTO * escala) / 2) / escala / escalaMovimiento
    };
  }

  dibujar(0);

  return {
    ancho: ANCHO,
    alto: ALTO,
    reproducir() {
      activo = true;
      sincronizar();
    },
    pausar() {
      activo = false;
      sincronizar();
    },
    mover(clienteX, clienteY) {
      mundo.puntero = { ...aCoordenadas(clienteX, clienteY), tiempo };
    },
    salir() {
      mundo.puntero = null;
    },
    tocar(clienteX, clienteY) {
      const punto = aCoordenadas(clienteX, clienteY);
      mundo.puntero = { ...punto, tiempo };
      for (const ser of mundo.vida) ser.tocar?.(punto, tiempo, mundo);
    },
    destruir() {
      activo = false;
      sincronizar();
      document.removeEventListener('visibilitychange', sincronizar);
    }
  };
}

// La versión que va en cada menú: horizontal en pantallas anchas y vertical
// en celulares parados, igual que los fondos quietos de antes
export const CONSULTA_VERTICAL = '(orientation: portrait) and (max-width: 900px)';

