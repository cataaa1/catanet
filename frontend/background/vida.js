// Los seres vivos de los paisajes: pájaros, conejos, ciervos, patos, peces,
// mariposas, luciérnagas, hojas que vuelan... Cada fábrica devuelve un objeto
// con `capa` (en qué momento del dibujo aparece), `actualizar` y `dibujar`.
// Algunos además reaccionan al puntero con `tocar`.
//
// Capas, de atrás hacia adelante:
//   'cielo' → detrás de los árboles (pájaros lejanos, niebla)
//   'agua'  → sobre el agua (patos, peces, garza)
//   'suelo' → sobre el pasto (conejos, ciervos, zorro)
//   'aire'  → adelante de todo (mariposas, hojas, luciérnagas)

import { ANCHO, crearAzar, viento, prepararSprite, dibujarSprite, pixel } from '/background/motor.js';

const REGION_PASTO = 3;
const REGION_AGUA = 4;

// ─── Sprites ───────────────────────────────────────────────────────────────
// Letras: c cuerpo, h luz, s sombra, d contorno, l claro, o ojo, n nariz,
// r rosado (orejas), a astas, b pico, w blanco

const CONEJO = {
  sentado: [
    '........dd...',
    '.......dcr...',
    '.......dcr...',
    '......dcc....',
    '.....dhccc...',
    '....dhcccoc..',
    '...dhccccccn.',
    '..dccccccll..',
    '.lccccccccl..',
    'llcccccscc...',
    '.lsssssss....'
  ],
  orejas: [
    '.............',
    '.....ddd.....',
    '......dcrr...',
    '......dcc....',
    '.....dhccc...',
    '....dhcccoc..',
    '...dhccccccn.',
    '..dccccccll..',
    '.lccccccccl..',
    'llcccccscc...',
    '.lsssssss....'
  ],
  comiendo: [
    '.............',
    '.............',
    '.....dd......',
    '....dcr......',
    '...dhcr......',
    '..dhcccdd....',
    '.dhccccccc...',
    'lccccccccoc..',
    'llccccccsccn.',
    '.lcccccs.ss..',
    '..sssss......'
  ],
  saltando: [
    '.........dd...',
    '........dcr...',
    '.......dcc....',
    '......dhccc...',
    '..ddhhcccoc...',
    '.dhccccccccn..',
    'lccccccccll...',
    'llccccsscl....',
    '.lsss...ss....',
    '.ss.......s...'
  ]
};

const CIERVO = {
  mirando: [
    '..........a..a..',
    '..........aaa...',
    '...........a....',
    '..........dcc...',
    '.........dccrr..',
    '.........dcoccc.',
    '..........ccccn.',
    '.........dcc....',
    '.........dcl....',
    '..dddddddccl....',
    '.lhccccccccl....',
    '.lcccccccccs....',
    '..scccccccs.....',
    '..sc.s...sc.....',
    '..s..s...s.s....',
    '..s..s...s.s....',
    '..d..d...d.d....'
  ],
  pastando: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..ddddddddd.....',
    '.lhcccccccccd...',
    '.lcccccccccccd..',
    '..sccccccccsccc.',
    '..sc.s...sc.dcoc',
    '..s..s...s..acrn',
    '..s..s...s.s.a..',
    '..d..d...d.d....'
  ],
  caminando: [
    '..........a..a..',
    '..........aaa...',
    '...........a....',
    '..........dcc...',
    '.........dccrr..',
    '.........dcoccc.',
    '..........ccccn.',
    '.........dcc....',
    '.........dcl....',
    '..dddddddccl....',
    '.lhccccccccl....',
    '.lcccccccccs....',
    '..scccccccs.....',
    '...sc...cs......',
    '...s.c..s.c.....',
    '..s...c.s..c....',
    '..d...d.d...d...'
  ]
};

const ZORRO = {
  trote1: [
    '.............dd.',
    '............dcr.',
    '............cccc.',
    '.dd.........ccoccn',
    'dccd.......dcclw..',
    '.dccddddddcccl....',
    '..dccccccccccl....',
    '...lccccccccl.....',
    '....sc.s..sc.s....',
    '....s..s..s..s....',
    '....d..d..d..d....'
  ],
  trote2: [
    '.............dd.',
    '............dcr.',
    '............cccc.',
    '..dd........ccoccn',
    '.dccd......dcclw..',
    '..dccdddddccccl...',
    '...dcccccccccl....',
    '....lcccccccl.....',
    '.....sc..cs.......',
    '....s..cs..s......',
    '...d...dd...d.....'
  ]
};

const PATO = {
  nadando: [
    '........gg...',
    '.......ggog..',
    '.......gggbb.',
    '.......ll....',
    '..sssssss....',
    '.ssccccsss...',
    '..sssssss....'
  ],
  buceando: [
    '.............',
    '.............',
    '.............',
    '...s.........',
    '..sss........',
    '.ssccs.......',
    '..sssssss....'
  ]
};

const GARZA = {
  parada: [
    '....dd...',
    '...dwwo..',
    '...wwwbbb',
    '....ww...',
    '.....w...',
    '....ww...',
    '....w....',
    '...hww...',
    '..hhwww..',
    '.hhhwww..',
    '.hhwwww..',
    '..hhww...',
    '...hs....',
    '....s....',
    '....s....',
    '....s....',
    '...ss....'
  ],
  pescando: [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '...hww...',
    '..hhwww..',
    '.hhhwwwww',
    '.hhwwww.w',
    '..hhww...w',
    '...hs....wo',
    '....s.....b',
    '....s.....b',
    '....s....',
    '...ss....'
  ]
};

const AGUILA = {
  planeando: [
    'sss.........sss',
    '..sss.....sss..',
    '....sscccss....',
    '......ccl......',
    '.......c.......'
  ],
  arriba: [
    's.............s',
    '.ss.........ss.',
    '...sss...sss...',
    '.....sccss.....',
    '......ccl......',
    '.......c.......'
  ],
  abajo: [
    '...............',
    '.....sccs......',
    '...sssccsss....',
    '.ss...ccl..ss..',
    's......c.....s.'
  ]
};

// Colores por defecto, tomados de la paleta apagada de los fondos
const COLORES = {
  conejo: { c: '#9c8591', h: '#bfa9b3', s: '#735f6d', d: '#4f3e4d', l: '#efe8dc', o: '#2d2230', r: '#d6a9b3', n: '#c98f9c' },
  ciervo: { c: '#a07e84', h: '#c3a3a6', s: '#76596a', d: '#533f50', l: '#efe6da', o: '#2d2230', r: '#caa0a6', n: '#2d2230', a: '#7a6258' },
  zorro: { c: '#cf9577', h: '#e2b394', s: '#9a6a5c', d: '#6e4a4a', l: '#f3e9de', w: '#fbf6ee', o: '#2d2230', n: '#2d2230', r: '#3d2e3d' },
  garza: { w: '#eee8ea', h: '#b7a9ba', s: '#6f6070', d: '#4a3c4c', o: '#2d2230', b: '#d9b07e' },
  pato: { g: '#6f8577', o: '#302b3c', b: '#e3b886', l: '#f4e8ce', s: '#6d5a6e', c: '#b8bcb0' },
  aguila: { s: '#4a354b', c: '#6a4f63', l: '#f2e4df' }
};

function sprites(dibujos, paleta) {
  const listos = {};
  for (const [nombre, filas] of Object.entries(dibujos)) listos[nombre] = prepararSprite(filas, paleta);
  return listos;
}

// Sombra suave bajo los animales que pisan el suelo
function sombra(ctx, x, y, ancho) {
  ctx.globalAlpha = 0.18;
  pixel(ctx, x - ancho / 2, y - 2, ancho, 3, '#3a2c3c');
  pixel(ctx, x - ancho / 2 + 3, y - 3, ancho - 6, 1, '#3a2c3c');
  ctx.globalAlpha = 1;
}

function punteroCerca(mundo, x, y, radio, tiempo) {
  const p = mundo.puntero;
  if (!p || tiempo - p.tiempo > 1.5) return null;
  const distancia = Math.hypot(p.x - x, p.y - y);
  return distancia < radio ? p : null;
}

// ─── Pájaros ───────────────────────────────────────────────────────────────

// Una bandada que cruza el cielo de vez en cuando, en formación de V suelta
export function bandada({ semilla = 3, y = [80, 220], color = '#6d5a70', cada = [14, 30], tamano = [4, 9], escala = 1 } = {}) {
  const azar = crearAzar(semilla);
  let pajaros = [];
  let espera = 3 + azar() * 6;

  function lanzar() {
    const cantidad = Math.round(tamano[0] + azar() * (tamano[1] - tamano[0]));
    const direccion = azar() < 0.75 ? 1 : -1; // casi siempre con el viento
    const altura = y[0] + azar() * (y[1] - y[0]);
    const velocidad = (38 + azar() * 22) * direccion;
    pajaros = Array.from({ length: cantidad }, (_, i) => {
      const lado = i % 2 ? 1 : -1;
      const fila = Math.ceil(i / 2);
      return {
        x: (direccion > 0 ? -40 : ANCHO + 40) - direccion * fila * (16 + azar() * 6),
        y: altura + lado * fila * (7 + azar() * 3),
        velocidad: velocidad * (0.97 + azar() * 0.06),
        fase: azar() * 6,
        ritmo: 7 + azar() * 3
      };
    });
  }

  return {
    capa: 'cielo',
    actualizar(dt, tiempo) {
      if (!pajaros.length) {
        espera -= dt;
        if (espera <= 0) lanzar();
        return;
      }
      for (const p of pajaros) {
        p.x += p.velocidad * dt;
        p.y += Math.sin(tiempo * 0.7 + p.fase) * 4 * dt;
      }
      if (pajaros.every((p) => p.x < -80 || p.x > ANCHO + 80)) {
        pajaros = [];
        espera = cada[0] + azar() * (cada[1] - cada[0]);
      }
    },
    dibujar(ctx, tiempo) {
      const e = escala;
      for (const p of pajaros) {
        // Aleteo con pausas de planeo, como las aves reales
        const ciclo = Math.sin(tiempo * p.ritmo + p.fase);
        const planea = Math.sin(tiempo * 0.9 + p.fase) > 0.55;
        const ala = planea ? 0 : ciclo > 0.3 ? -1 : ciclo < -0.3 ? 1 : 0;
        const x = Math.round(p.x);
        const yy = Math.round(p.y);
        pixel(ctx, x - e, yy, e * 3, e, color);
        pixel(ctx, x - e * 3, yy + ala * e, e * 2, e, color);
        pixel(ctx, x + e * 2, yy + ala * e, e * 2, e, color);
        if (ala !== 0) {
          pixel(ctx, x - e * 4, yy + ala * e * 2, e, e, color);
          pixel(ctx, x + e * 4, yy + ala * e * 2, e, e, color);
        }
      }
    }
  };
}

// Un ave grande que planea en círculos amplios aprovechando las térmicas
export function aguila({ x = 700, y = 170, radio = [220, 60], colores, escala = 3 } = {}) {
  const dibujos = sprites(AGUILA, { ...COLORES.aguila, ...colores });
  let angulo = 0;
  let aleteo = 0;
  let proximoAleteo = 6;
  let centroX = x;
  return {
    capa: 'cielo',
    actualizar(dt, tiempo) {
      angulo += dt * 0.11;
      centroX = x + Math.sin(tiempo * 0.03) * 180;
      proximoAleteo -= dt;
      if (proximoAleteo <= 0) {
        aleteo = 1.4;
        proximoAleteo = 8 + Math.random() * 8;
      }
      aleteo = Math.max(0, aleteo - dt);
    },
    dibujar(ctx, tiempo) {
      const px = centroX + Math.cos(angulo) * radio[0];
      const py = y + Math.sin(angulo) * radio[1];
      // Se ladea según hacia dónde gira
      const cuadro = aleteo > 0
        ? (Math.sin(tiempo * 11) > 0 ? dibujos.arriba : dibujos.abajo)
        : dibujos.planeando;
      const lejania = 0.85 + 0.15 * Math.sin(angulo);
      dibujarSprite(ctx, cuadro, px, py, { escala: Math.max(2, Math.round(escala * lejania)) });
    }
  };
}

// ─── Animales de suelo ─────────────────────────────────────────────────────

// Conejos que comen, paran la oreja y saltan. Si el puntero se acerca, huyen.
export function conejos({ semilla = 5, cantidad = 3, zona, colores, escala = 3, escalaLejos = 2, lejosHasta = 0 } = {}) {
  const azar = crearAzar(semilla);
  const dibujos = sprites(CONEJO, { ...COLORES.conejo, ...colores });
  const lista = [];

  function lugarValido(mundo, x, y) {
    return x > zona.x0 && x < zona.x1 && y > zona.y0 && y < zona.y1
      && mundo.region(x, y) === REGION_PASTO && mundo.region(x, y - 12) === REGION_PASTO;
  }

  function elegir(conejo, mundo) {
    const r = azar();
    if (r < 0.45) {
      conejo.estado = 'comiendo';
      conejo.espera = 2 + azar() * 4;
    } else if (r < 0.75) {
      conejo.estado = 'sentado';
      conejo.espera = 1.5 + azar() * 3;
    } else {
      saltar(conejo, mundo, (azar() < 0.5 ? -1 : 1), 1 + Math.floor(azar() * 3), 1);
    }
  }

  function saltar(conejo, mundo, direccion, saltos, apuro) {
    for (let intento = 0; intento < 8; intento++) {
      const x = conejo.x + direccion * (26 + azar() * 22) * (apuro > 1 ? 1.5 : 1);
      const y = conejo.y + (azar() - 0.5) * 18;
      if (lugarValido(mundo, x, y)) {
        conejo.estado = 'saltando';
        conejo.salto = { x0: conejo.x, y0: conejo.y, x1: x, y1: y, avance: 0, duracion: 0.38 / apuro };
        conejo.saltosRestantes = saltos - 1;
        conejo.apuro = apuro;
        conejo.direccion = direccion;
        return;
      }
      direccion = intento > 3 ? -direccion : direccion;
    }
    conejo.estado = 'sentado';
    conejo.espera = 1;
  }

  return {
    capa: 'suelo',
    actualizar(dt, tiempo, mundo) {
      if (!lista.length) {
        for (let i = 0; i < 200 && lista.length < cantidad; i++) {
          const x = zona.x0 + azar() * (zona.x1 - zona.x0);
          const y = zona.y0 + azar() * (zona.y1 - zona.y0);
          if (lugarValido(mundo, x, y)) {
            lista.push({ x, y, estado: 'sentado', espera: azar() * 3, direccion: azar() < 0.5 ? -1 : 1, orejas: 0 });
          }
        }
      }
      for (const conejo of lista) {
        const susto = punteroCerca(mundo, conejo.x, conejo.y, 120, tiempo);
        if (susto && conejo.estado !== 'saltando') {
          saltar(conejo, mundo, conejo.x > susto.x ? 1 : -1, 3, 1.8);
          continue;
        }
        if (conejo.estado === 'saltando') {
          const s = conejo.salto;
          s.avance += dt / s.duracion;
          const t = Math.min(1, s.avance);
          conejo.x = s.x0 + (s.x1 - s.x0) * t;
          conejo.y = s.y0 + (s.y1 - s.y0) * t;
          conejo.altura = Math.sin(t * Math.PI) * 14;
          if (t >= 1) {
            conejo.altura = 0;
            if (conejo.saltosRestantes > 0) {
              saltar(conejo, mundo, conejo.direccion, conejo.saltosRestantes, conejo.apuro);
            } else {
              conejo.estado = 'sentado';
              conejo.espera = 0.6 + azar() * 1.2;
            }
          }
          continue;
        }
        conejo.espera -= dt;
        // Mueve las orejas de vez en cuando
        conejo.orejas = Math.max(0, conejo.orejas - dt);
        if (conejo.estado === 'sentado' && azar() < dt * 0.6) conejo.orejas = 0.25;
        if (conejo.espera <= 0) elegir(conejo, mundo);
      }
    },
    tocar(punto, tiempo, mundo) {
      for (const conejo of lista) {
        if (Math.hypot(punto.x - conejo.x, punto.y - conejo.y) < 160) {
          saltar(conejo, mundo, conejo.x > punto.x ? 1 : -1, 3, 1.8);
        }
      }
    },
    dibujar(ctx) {
      // Los de atrás se dibujan primero
      lista.sort((a, b) => a.y - b.y);
      for (const conejo of lista) {
        const e = conejo.y < lejosHasta ? escalaLejos : escala;
        sombra(ctx, conejo.x, conejo.y, 7 * e);
        let cuadro = dibujos.sentado;
        if (conejo.estado === 'saltando') cuadro = dibujos.saltando;
        else if (conejo.estado === 'comiendo') cuadro = dibujos.comiendo;
        else if (conejo.orejas > 0) cuadro = dibujos.orejas;
        dibujarSprite(ctx, cuadro, conejo.x, conejo.y - (conejo.altura || 0), { escala: e, espejo: conejo.direccion < 0 });
      }
    }
  };
}

// Ciervos que pastan, levantan la cabeza y caminan unos pasos
export function ciervos({ semilla = 9, lugares, colores, escala = 3, rango = 60 } = {}) {
  const azar = crearAzar(semilla);
  const dibujos = sprites(CIERVO, { ...COLORES.ciervo, ...colores });
  const lista = lugares.map((lugar) => ({
    ...lugar, origen: lugar.x, estado: 'pastando', espera: 2 + azar() * 5,
    direccion: lugar.direccion || 1, paso: 0, alerta: 0, destino: lugar.x
  }));

  return {
    capa: 'suelo',
    actualizar(dt, tiempo, mundo) {
      for (const c of lista) {
        const e = c.escala || escala;
        const susto = punteroCerca(mundo, c.x, c.y - 20, 170, tiempo);
        if (susto) {
          c.alerta += dt;
          if (c.estado !== 'caminando') {
            c.estado = 'mirando';
            c.espera = 2;
          }
          if (c.alerta > 1.2 && c.estado !== 'caminando') {
            c.estado = 'caminando';
            c.direccion = c.x > susto.x ? 1 : -1;
            c.destino = Math.max(c.origen - rango, Math.min(c.origen + rango, c.x + c.direccion * rango));
            c.apuro = 2.4;
          }
        } else {
          c.alerta = Math.max(0, c.alerta - dt);
        }
        if (c.estado === 'caminando') {
          const velocidad = 9 * (c.apuro || 1) * (e / 3);
          c.x += Math.sign(c.destino - c.x) * velocidad * dt;
          c.paso += dt * 4 * (c.apuro || 1);
          if (Math.abs(c.destino - c.x) < 1.5) {
            c.estado = 'mirando';
            c.espera = 1 + azar() * 2;
            c.apuro = 1;
          }
          continue;
        }
        c.espera -= dt;
        if (c.espera > 0) continue;
        const r = azar();
        if (r < 0.55) {
          c.estado = 'pastando';
          c.espera = 3 + azar() * 6;
        } else if (r < 0.8) {
          c.estado = 'mirando';
          c.espera = 1.5 + azar() * 2.5;
        } else {
          c.estado = 'caminando';
          c.destino = c.origen + (azar() - 0.5) * 2 * rango;
          c.direccion = c.destino > c.x ? 1 : -1;
          c.apuro = 1;
        }
      }
    },
    dibujar(ctx) {
      for (const c of lista) {
        const e = c.escala || escala;
        sombra(ctx, c.x, c.y, 11 * e);
        let cuadro = c.estado === 'pastando' ? dibujos.pastando : dibujos.mirando;
        if (c.estado === 'caminando') cuadro = Math.floor(c.paso) % 2 ? dibujos.caminando : dibujos.mirando;
        dibujarSprite(ctx, cuadro, c.x, c.y, { escala: e, espejo: c.direccion < 0 });
      }
    }
  };
}

// Un zorro que cada tanto cruza trotando por un camino
export function zorro({ semilla = 13, camino, colores, escala = 3, cada = [25, 50] } = {}) {
  const azar = crearAzar(semilla);
  const dibujos = sprites(ZORRO, { ...COLORES.zorro, ...colores });
  let x = null;
  let direccion = 1;
  let espera = 8 + azar() * 10;
  let paso = 0;
  let puntoOlfateo = 0;
  let olfateo = 0;
  let yaOlfateo = false;
  return {
    capa: 'suelo',
    actualizar(dt, tiempo, mundo) {
      if (x === null) {
        espera -= dt;
        if (espera > 0) return;
        direccion = azar() < 0.5 ? 1 : -1;
        x = direccion > 0 ? camino.x0 - 60 : camino.x1 + 60;
        puntoOlfateo = camino.x0 + (camino.x1 - camino.x0) * (0.3 + azar() * 0.4);
        yaOlfateo = false;
        return;
      }
      const cerca = punteroCerca(mundo, x, camino.y(x), 140, tiempo);
      // A mitad de camino se detiene a olfatear un momento
      if (!yaOlfateo && Math.abs(x - puntoOlfateo) < 3 && !cerca) {
        yaOlfateo = true;
        olfateo = 2.2;
      }
      if (olfateo > 0) {
        olfateo = cerca ? 0 : olfateo - dt;
        return;
      }
      const velocidad = cerca ? 150 : 55;
      x += direccion * velocidad * dt;
      paso += dt * (cerca ? 14 : 7);
      if (x < camino.x0 - 80 || x > camino.x1 + 80) {
        x = null;
        espera = cada[0] + azar() * (cada[1] - cada[0]);
      }
    },
    dibujar(ctx) {
      if (x === null) return;
      const y = camino.y(x);
      sombra(ctx, x, y, 11 * escala);
      const quieto = olfateo > 0;
      const cuadro = quieto || Math.floor(paso) % 2 ? dibujos.trote1 : dibujos.trote2;
      dibujarSprite(ctx, cuadro, x, y + (quieto ? escala : 0), { escala, espejo: direccion < 0 });
    }
  };
}

// ─── Agua ──────────────────────────────────────────────────────────────────

// Anillos que se abren en el agua (los usan los peces, los patos y los toques)
export function ondas({ color = '#fff1d8', sombra: colorSombra = '#8a8298' } = {}) {
  const lista = [];
  const ser = {
    capa: 'agua',
    agregar(x, y, tamano = 1) {
      lista.push({ x, y, edad: 0, tamano });
    },
    actualizar(dt) {
      for (const onda of lista) onda.edad += dt;
      while (lista.length && lista[0].edad > 2.4) lista.shift();
    },
    tocar(punto, tiempo, mundo) {
      if (mundo.region(punto.x, punto.y) === REGION_AGUA) ser.agregar(punto.x, punto.y, 1.4);
    },
    dibujar(ctx) {
      for (const onda of lista) {
        const t = onda.edad / 2.4;
        const radio = (6 + t * 44) * onda.tamano;
        ctx.globalAlpha = (1 - t) * 0.55;
        // Las ondas se ven aplastadas por la perspectiva
        pixel(ctx, onda.x - radio, onda.y, radio * 2, 2, color);
        pixel(ctx, onda.x - radio * 0.8, onda.y - radio * 0.22, radio * 1.6, 2, color);
        pixel(ctx, onda.x - radio * 0.8, onda.y + radio * 0.22, radio * 1.6, 2, colorSombra);
      }
      ctx.globalAlpha = 1;
    }
  };
  return ser;
}

// Destellos del sol sobre el agua
export function destellos({ semilla = 27, cantidad = 50, zona, color = '#fff2ce' } = {}) {
  const azar = crearAzar(semilla);
  const lista = Array.from({ length: cantidad }, () => ({
    x: zona.x0 + azar() * (zona.x1 - zona.x0),
    y: zona.y0 + azar() * (zona.y1 - zona.y0),
    fase: azar() * Math.PI * 2,
    ancho: 3 + Math.round(azar() * 12)
  }));
  return {
    capa: 'agua',
    dibujar(ctx, tiempo, mundo) {
      for (const luz of lista) {
        const x = luz.x + Math.sin(tiempo * 0.8 + luz.fase) * 12;
        const y = luz.y + Math.sin(tiempo * 0.6 + luz.fase) * 3;
        if (mundo.region(x, y) !== REGION_AGUA) continue;
        ctx.globalAlpha = Math.pow((1 + Math.sin(tiempo * 1.6 + luz.fase)) / 2, 2) * 0.55;
        pixel(ctx, x, y, luz.ancho, 2, color);
      }
      ctx.globalAlpha = 1;
    }
  };
}

// Patos que navegan despacio dejando una estela en V
export function patos({ semilla = 17, recorrido, colores, cantidad = 3, escala = 3, ondas: agua } = {}) {
  const azar = crearAzar(semilla);
  const dibujos = sprites(PATO, { ...COLORES.pato, ...colores });
  const lista = Array.from({ length: cantidad }, (_, i) => ({ desfase: i, buceo: 0, fase: azar() * 6 }));
  let direccion = 1;
  let avance = 0.35;
  let susto = 0;
  return {
    capa: 'agua',
    actualizar(dt, tiempo, mundo) {
      const lider = posicion(0);
      if (punteroCerca(mundo, lider.x, lider.y, 130, tiempo)) susto = 3;
      susto = Math.max(0, susto - dt);
      avance += direccion * dt * (susto > 0 ? 0.03 : 0.009);
      if (avance > 1 || avance < 0) {
        direccion = -direccion;
        avance = Math.max(0, Math.min(1, avance));
      }
      for (const pato of lista) {
        pato.buceo = Math.max(0, pato.buceo - dt);
        if (pato.buceo === 0 && susto === 0 && azar() < dt * 0.02) {
          pato.buceo = 1.6;
          const p = posicion(pato.desfase);
          agua?.agregar(p.x, p.y, 0.5);
        }
      }
    },
    dibujar(ctx, tiempo) {
      for (const pato of lista) {
        const p = posicion(pato.desfase);
        const balanceo = Math.sin(tiempo * 2 + pato.fase) * 0.8;
        // Estela: dos líneas que se abren hacia atrás
        ctx.globalAlpha = 0.3;
        for (let k = 1; k <= 4; k++) {
          const largo = 4 + k * 4;
          pixel(ctx, p.x - direccion * (k * 9 + 10), p.y - 1 - k * 1.5, largo, 1, '#f6e7cd');
          pixel(ctx, p.x - direccion * (k * 9 + 10), p.y + 1 + k * 1.5, largo, 1, '#f6e7cd');
        }
        ctx.globalAlpha = 1;
        const cuadro = pato.buceo > 0.3 && pato.buceo < 1.4 ? dibujos.buceando : dibujos.nadando;
        dibujarSprite(ctx, cuadro, p.x, p.y + balanceo + 2, { escala, espejo: direccion < 0 });
      }
    }
  };

  function posicion(desfase) {
    // Van en fila india, cada uno un poco corrido hacia la orilla
    const t = Math.max(0, Math.min(1, avance - direccion * desfase * 0.09));
    return {
      x: recorrido.x0 + (recorrido.x1 - recorrido.x0) * t,
      y: recorrido.y0 + (recorrido.y1 - recorrido.y0) * t + desfase * 7
    };
  }
}

// Un pez que salta cada tanto y deja un anillo en el agua
export function peces({ semilla = 19, zona, color = '#b9a6b8', brillo = '#f6e7cd', ondas: agua, cada = [5, 12] } = {}) {
  const azar = crearAzar(semilla);
  let salto = null;
  let espera = 3;
  return {
    capa: 'agua',
    actualizar(dt, tiempo, mundo) {
      if (!salto) {
        espera -= dt;
        if (espera > 0) return;
        for (let i = 0; i < 20; i++) {
          const x = zona.x0 + azar() * (zona.x1 - zona.x0);
          const y = zona.y0 + azar() * (zona.y1 - zona.y0);
          if (mundo.region(x, y) === REGION_AGUA && mundo.region(x + 40, y) === REGION_AGUA) {
            salto = { x, y, t: 0, direccion: azar() < 0.5 ? -1 : 1, largo: 26 + azar() * 16 };
            agua?.agregar(x, y, 0.5);
            break;
          }
        }
        espera = cada[0] + azar() * (cada[1] - cada[0]);
        return;
      }
      salto.t += dt / 0.9;
      if (salto.t >= 1) {
        agua?.agregar(salto.x + salto.direccion * salto.largo, salto.y, 0.7);
        salto = null;
      }
    },
    dibujar(ctx) {
      if (!salto) return;
      const t = salto.t;
      const x = salto.x + salto.direccion * salto.largo * t;
      const y = salto.y - Math.sin(t * Math.PI) * 26;
      const pendiente = Math.cos(t * Math.PI) * salto.direccion; // de subir a bajar
      // El pez es una rayita de 4 píxeles que acompaña la curva del salto
      for (let i = 0; i < 4; i++) {
        pixel(ctx, x - salto.direccion * i * 3, y + pendiente * i * 2.4, 3, 3, i === 0 ? brillo : color);
      }
      pixel(ctx, x - salto.direccion * 12, y + pendiente * 12 - 2, 3, 5, color);
    }
  };
}

// Una garza que espera quieta en la orilla y de golpe pesca
export function garza({ x, y, colores, escala = 3, ondas: agua } = {}) {
  const dibujos = sprites(GARZA, { ...COLORES.garza, ...colores });
  let espera = 6;
  let pescando = 0;
  return {
    capa: 'agua',
    actualizar(dt, tiempo, mundo) {
      if (punteroCerca(mundo, x, y - 20, 90, tiempo)) {
        pescando = 0;
        espera = 5;
      }
      if (pescando > 0) {
        pescando -= dt;
        return;
      }
      espera -= dt;
      if (espera <= 0) {
        pescando = 1.1;
        espera = 7 + Math.random() * 9;
        agua?.agregar(x + 16, y, 0.4);
      }
    },
    dibujar(ctx) {
      ctx.globalAlpha = 0.25;
      pixel(ctx, x - 12, y + 2, 26, 2, '#f6e7cd');
      ctx.globalAlpha = 1;
      dibujarSprite(ctx, pescando > 0 ? dibujos.pescando : dibujos.parada, x, y, { escala });
    }
  };
}

// ─── Aire ──────────────────────────────────────────────────────────────────

// Mariposas que revolotean sobre las flores y esquivan el puntero
export function mariposas({ semilla = 7, cantidad = 4, zona, colores = ['#ebbad6', '#f2d5b8', '#f4f0e0'], cuerpo = '#65536b', escala = 3 } = {}) {
  const azar = crearAzar(semilla);
  const lista = Array.from({ length: cantidad }, (_, i) => ({
    x: zona.x0 + azar() * (zona.x1 - zona.x0),
    y: zona.y0 + azar() * (zona.y1 - zona.y0),
    vx: 0, vy: 0,
    fase: azar() * 10,
    color: colores[i % colores.length],
    posada: 0
  }));
  return {
    capa: 'aire',
    actualizar(dt, tiempo, mundo) {
      for (const m of lista) {
        if (m.posada > 0) {
          m.posada -= dt;
          if (!punteroCerca(mundo, m.x, m.y, 70, tiempo)) continue;
          m.posada = 0;
        }
        // Un rumbo que cambia suave, más el empuje del viento
        const rumbo = Math.sin(tiempo * 0.5 + m.fase) * 2 + Math.sin(tiempo * 1.3 + m.fase * 2);
        m.vx += (Math.cos(rumbo) * 30 + (viento(m.x, tiempo) - 0.5) * 20 - m.vx) * dt * 2;
        m.vy += (Math.sin(rumbo * 1.3) * 20 - m.vy) * dt * 2;
        const p = punteroCerca(mundo, m.x, m.y, 90, tiempo);
        if (p) {
          const d = Math.max(10, Math.hypot(m.x - p.x, m.y - p.y));
          m.vx += (m.x - p.x) / d * 260 * dt;
          m.vy += (m.y - p.y) / d * 260 * dt - 60 * dt;
        }
        m.x += m.vx * dt;
        m.y += (m.vy + Math.sin(tiempo * 9 + m.fase) * 16) * dt;
        // Vuelven a su jardín si se alejan
        if (m.x < zona.x0) m.vx += 40 * dt;
        if (m.x > zona.x1) m.vx -= 40 * dt;
        if (m.y < zona.y0) m.vy += 40 * dt;
        if (m.y > zona.y1) m.vy -= 40 * dt;
        if (azar() < dt * 0.05) m.posada = 2 + azar() * 3;
      }
    },
    dibujar(ctx, tiempo) {
      const e = escala;
      for (const m of lista) {
        // Posada abre y cierra las alas lento; volando, rápido
        const ritmo = m.posada > 0 ? 1.5 : 14;
        const abierta = Math.sin(tiempo * ritmo + m.fase) > 0;
        const x = Math.round(m.x / e) * e;
        const y = Math.round(m.y / e) * e;
        if (abierta) {
          pixel(ctx, x - e * 2, y - e, e * 2, e * 2, m.color);
          pixel(ctx, x + e, y - e, e * 2, e * 2, m.color);
        } else {
          pixel(ctx, x - e, y - e * 2, e, e * 2, m.color);
          pixel(ctx, x + e, y - e * 2, e, e * 2, m.color);
        }
        pixel(ctx, x, y - e, e, e * 2, cuerpo);
      }
    }
  };
}

// Hojas o pétalos que se sueltan de las copas y el viento se lleva
export function hojas({ semilla = 11, origenes, colores, cantidad = 14, escala = 3 } = {}) {
  const azar = crearAzar(semilla);
  const lista = [];
  function nueva(inicial) {
    const origen = origenes[Math.floor(azar() * origenes.length)];
    return {
      x: origen.x0 + azar() * (origen.x1 - origen.x0),
      y: origen.y0 + azar() * (origen.y1 - origen.y0),
      suelo: origen.suelo + azar() * 60,
      vida: inicial ? azar() * 6 : 0,
      fase: azar() * 10,
      color: colores[Math.floor(azar() * colores.length)],
      velocidad: 18 + azar() * 16
    };
  }
  for (let i = 0; i < cantidad; i++) lista.push(nueva(true));
  return {
    capa: 'aire',
    actualizar(dt, tiempo) {
      for (let i = 0; i < lista.length; i++) {
        const h = lista[i];
        h.vida += dt;
        const empuje = viento(h.x, tiempo);
        if (h.y < h.suelo) {
          h.x += (empuje * 70 + Math.sin(tiempo * 2.2 + h.fase) * 22) * dt;
          h.y += (h.velocidad + Math.sin(tiempo * 3.1 + h.fase) * 14) * dt;
        } else {
          h.x += empuje * 6 * dt; // en el suelo apenas se arrastra
        }
        if (h.vida > 14 || h.x > ANCHO + 20) lista[i] = nueva(false);
      }
    },
    dibujar(ctx, tiempo) {
      for (const h of lista) {
        const giro = Math.sin(tiempo * 5 + h.fase);
        ctx.globalAlpha = Math.min(1, h.vida * 2, (14 - h.vida) / 2);
        const e = escala;
        pixel(ctx, h.x, h.y, giro > 0 ? e * 2 : e, e, h.color);
        if (Math.abs(giro) > 0.6) pixel(ctx, h.x + e, h.y + e, e, e, h.color);
      }
      ctx.globalAlpha = 1;
    }
  };
}

// Pelusas de diente de león que flotan con el viento
export function pelusas({ semilla = 23, cantidad = 10, zona, color = '#fbf7ee' } = {}) {
  const azar = crearAzar(semilla);
  const lista = Array.from({ length: cantidad }, () => ({
    x: zona.x0 + azar() * (zona.x1 - zona.x0),
    y: zona.y0 + azar() * (zona.y1 - zona.y0),
    fase: azar() * 10
  }));
  return {
    capa: 'aire',
    actualizar(dt, tiempo) {
      for (const p of lista) {
        p.x += (viento(p.x, tiempo) * 45 + 5) * dt;
        p.y += (Math.sin(tiempo * 0.9 + p.fase) * 9 - 3) * dt;
        if (p.x > ANCHO + 10) {
          p.x = -10;
          p.y = zona.y0 + azar() * (zona.y1 - zona.y0);
        }
      }
    },
    dibujar(ctx, tiempo) {
      for (const p of lista) {
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(tiempo * 2 + p.fase);
        pixel(ctx, p.x, p.y, 3, 3, color);
        ctx.globalAlpha *= 0.4;
        pixel(ctx, p.x - 2, p.y - 2, 7, 7, color);
      }
      ctx.globalAlpha = 1;
    }
  };
}

// Luciérnagas que titilan a ras del pasto
export function luciernagas({ semilla = 29, cantidad = 20, zona, color = '#fff5ce' } = {}) {
  const azar = crearAzar(semilla);
  const lista = Array.from({ length: cantidad }, () => ({
    x: zona.x0 + azar() * (zona.x1 - zona.x0),
    y: zona.y0 + azar() * (zona.y1 - zona.y0),
    fase: azar() * 12
  }));
  return {
    capa: 'aire',
    dibujar(ctx, tiempo) {
      for (const luz of lista) {
        const x = luz.x + Math.sin(tiempo * 0.35 + luz.fase) * 18;
        const y = luz.y + Math.cos(tiempo * 0.5 + luz.fase) * 10;
        const brillo = Math.pow((1 + Math.sin(tiempo * 1.3 + luz.fase)) / 2, 3);
        ctx.globalAlpha = brillo * 0.14;
        pixel(ctx, x - 5, y - 5, 12, 12, color);
        ctx.globalAlpha = brillo * 0.9;
        pixel(ctx, x, y, 3, 3, color);
      }
      ctx.globalAlpha = 1;
    }
  };
}

// Bancos de niebla que se deslizan entre las capas de montañas. Cada banco
// es una pila de franjas de 6 px con bordes irregulares, casi transparentes.
export function niebla({ semilla = 31, bandas, color = '255, 226, 232' } = {}) {
  const azar = crearAzar(semilla);
  const bancos = bandas.flatMap((banda) => Array.from({ length: banda.cantidad || 4 }, () => {
    const ancho = 260 + azar() * 320;
    const filas = 4 + Math.floor(azar() * 4);
    return {
      ...banda,
      x: azar() * (ANCHO + 800) - 400,
      fase: azar() * 10,
      filas: Array.from({ length: filas }, (_, i) => {
        // Más ancha en el medio, afinándose arriba y abajo
        const forma = Math.sin((i + 0.5) / filas * Math.PI);
        const largo = ancho * (0.35 + 0.65 * forma) * (0.8 + azar() * 0.35);
        return { dx: (ancho - largo) / 2 + (azar() - 0.5) * 60, largo, peso: 0.4 + 0.6 * forma };
      })
    };
  }));
  return {
    capa: 'cielo',
    dibujar(ctx, tiempo) {
      for (const b of bancos) {
        const x = ((b.x + tiempo * b.velocidad) % (ANCHO + 900)) - 450;
        const y = b.y + Math.sin(tiempo * 0.1 + b.fase) * 4 - b.filas.length * 3;
        const respiro = 0.7 + 0.3 * Math.sin(tiempo * 0.2 + b.fase);
        b.filas.forEach((fila, i) => {
          ctx.fillStyle = `rgba(${color}, ${b.alfa * fila.peso * respiro})`;
          const deriva = Math.sin(tiempo * 0.15 + b.fase + i) * 10;
          ctx.fillRect(Math.round((x + fila.dx + deriva) / 6) * 6, Math.round(y + i * 6), Math.round(fila.largo / 6) * 6, 6);
        });
      }
    }
  };
}

