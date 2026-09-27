// Las escenas animadas de cada fondo, en versión horizontal y vertical.
// Las coordenadas del cielo, el sol y las estrellas están en píxeles de la
// ilustración. Las de los animales, en píxeles de la ilustración divididos por
// `movimiento` (las verticales tienen el píxel del dibujo el doble de grande).
import { suave } from '/background/motor.js';
import {
  bandada, aguila, niebla, ondas, destellos, patos, peces, garza,
  conejos, ciervos, zorro, mariposas, hojas, pelusas, luciernagas
} from '/background/vida.js';

const MENUS = '/hub/assets/menus';
const PROPIOS = '/background/assets';

function recursos(clave, archivo) {
  return {
    imagen: `${MENUS}/${archivo}`,
    mascara: `${PROPIOS}/mascara-${clave}.png`,
    textura: `${PROPIOS}/cielo-${clave}.png`
  };
}

function variante(clave, archivo, { velocidad, ...resto }) {
  const { imagen, mascara, textura } = recursos(clave, archivo);
  return { imagen, mascara, cielo: { textura, velocidad }, ...resto };
}

export const ESCENAS = {
  // Pradera (menú Wordle): un cúmulo enorme, dos árboles, conejos y un ciervo
  1: {
    titulo: 'La pradera',
    horizontal: variante('1', 'background-1.png', {
      // El cúmulo se mueve entero; sólo la bruma del horizonte se queda quieta
      velocidad: (y) => 4 * (1 - suave(390, 456, y)),
      pasto: { amplitud: 3, brillo: 0.07 },
      crearVida: () => [
        bandada({ y: [90, 260], color: '#7b6a7e', tamano: [5, 9] }),
        ciervos({ lugares: [{ x: 1180, y: 566, direccion: -1 }], escala: 2, rango: 40 }),
        conejos({ cantidad: 3, zona: { x0: 330, x1: 1360, y0: 610, y1: 775 } }),
        hojas({
          origenes: [
            { x0: 160, x1: 340, y0: 180, y1: 430, suelo: 520 },
            { x0: 355, x1: 460, y0: 345, y1: 470, suelo: 545 }
          ],
          colores: ['#b58fa6', '#9c7a91', '#d7b9c9'],
          cantidad: 12
        }),
        mariposas({ cantidad: 4, zona: { x0: 60, x1: 1200, y0: 580, y1: 740 } }),
        pelusas({ cantidad: 9, zona: { x0: 0, x1: 1400, y0: 470, y1: 700 } })
      ]
    }),
    vertical: variante('1v', 'background-1-vertical.png', {
      movimiento: 2,
      velocidad: (y) => 6 * (1 - suave(860, 948, y)),
      pasto: { amplitud: 3, brillo: 0.07 },
      crearVida: () => [
        bandada({ y: [60, 300], color: '#7b6a7e', tamano: [4, 7] }),
        ciervos({ lugares: [{ x: 262, y: 552, direccion: 1 }], escala: 2, rango: 25 }),
        conejos({ cantidad: 2, zona: { x0: 20, x1: 430, y0: 580, y1: 790 } }),
        hojas({
          origenes: [{ x0: 4, x1: 58, y0: 320, y1: 500, suelo: 555 }],
          colores: ['#b58fa6', '#9c7a91', '#d7b9c9'],
          cantidad: 6
        }),
        mariposas({ cantidad: 3, zona: { x0: 20, x1: 430, y0: 580, y1: 760 } }),
        pelusas({ cantidad: 6, zona: { x0: 0, x1: 450, y0: 480, y1: 720 } })
      ]
    })
  },

  // Lago (menú Sudoku): reflejos, patos, una garza, peces y luciérnagas
  2: {
    titulo: 'Un ratito en el lago',
    horizontal: variante('2', 'background-2.png', {
      velocidad: (y) => 3.4 * (1 - suave(250, 400, y)),
      sol: { x: 760, y: 382, radio: 32 },
      estrellas: [[797, 23, 5, 5], [322, 34, 5, 5], [532, 34, 5, 5], [90, 40, 3, 3], [1264, 41, 6, 7],
        [323, 51, 4, 3], [498, 65, 4, 5], [594, 66, 4, 4], [1325, 66, 3, 4]],
      pasto: { amplitud: 2 },
      agua: { amplitud: 1 },
      crearVida: () => {
        const agua = ondas();
        return [
          bandada({ y: [110, 300], color: '#7d6680', tamano: [4, 7] }),
          agua,
          destellos({ zona: { x0: 620, x1: 1300, y0: 536, y1: 780 } }),
          peces({ zona: { x0: 680, x1: 1340, y0: 575, y1: 770 }, ondas: agua }),
          patos({ recorrido: { x0: 820, x1: 1180, y0: 612, y1: 648 }, ondas: agua }),
          garza({ x: 762, y: 702, ondas: agua }),
          conejos({ cantidad: 2, zona: { x0: 20, x1: 520, y0: 560, y1: 780 } }),
          hojas({
            origenes: [{ x0: 20, x1: 240, y0: 70, y1: 330, suelo: 470 }],
            colores: ['#8fa89a', '#6f8a80', '#b3c4b1'],
            cantidad: 8
          }),
          mariposas({ cantidad: 3, zona: { x0: 20, x1: 520, y0: 560, y1: 740 } }),
          luciernagas({ cantidad: 20, zona: { x0: 20, x1: 560, y0: 470, y1: 770 } })
        ];
      }
    }),
    vertical: variante('2v', 'background-2-vertical.png', {
      movimiento: 2,
      velocidad: (y) => 5 * (1 - suave(560, 900, y)),
      sol: { x: 530, y: 855, radio: 44 },
      estrellas: [[573, 115, 6, 12], [236, 159, 7, 13], [193, 265, 6, 12], [314, 265, 6, 12]],
      pasto: { amplitud: 2 },
      agua: { amplitud: 1 },
      crearVida: () => {
        const agua = ondas();
        return [
          bandada({ y: [80, 330], color: '#7d6680', tamano: [3, 6] }),
          agua,
          destellos({ zona: { x0: 150, x1: 450, y0: 575, y1: 795 }, cantidad: 36 }),
          peces({ zona: { x0: 150, x1: 440, y0: 590, y1: 760 }, ondas: agua }),
          patos({ recorrido: { x0: 250, x1: 420, y0: 612, y1: 632 }, cantidad: 2, ondas: agua }),
          garza({ x: 196, y: 706, ondas: agua }),
          conejos({ cantidad: 1, zona: { x0: 0, x1: 240, y0: 690, y1: 800 } }),
          mariposas({ cantidad: 2, zona: { x0: 0, x1: 250, y0: 640, y1: 790 } }),
          luciernagas({ cantidad: 12, zona: { x0: 0, x1: 260, y0: 560, y1: 800 } })
        ];
      }
    })
  },

  // Montañas (menú Buscaminas): nubes rasgadas, niebla entre los cerros, un águila
  3: {
    titulo: 'Entre montañas',
    horizontal: variante('3', 'background-3.png', {
      velocidad: (y) => 6.5 * (1 - suave(120, 410, y)),
      sol: { x: 945, y: 383, radio: 34 },
      pasto: { amplitud: 2, brillo: 0.05 },
      crearVida: () => [
        niebla({
          bandas: [
            { y: 470, velocidad: 4, alfa: 0.16, cantidad: 3 },
            { y: 545, velocidad: 6, alfa: 0.18, cantidad: 4 },
            { y: 622, velocidad: 9, alfa: 0.11, cantidad: 4 }
          ]
        }),
        aguila({ x: 560, y: 210, radio: [240, 45] }),
        bandada({ y: [260, 380], color: '#5f4760', tamano: [3, 6], cada: [18, 35] }),
        conejos({ cantidad: 2, zona: { x0: 40, x1: 1360, y0: 722, y1: 780 } }),
        mariposas({ cantidad: 3, zona: { x0: 60, x1: 1340, y0: 640, y1: 750 } }),
        luciernagas({ cantidad: 14, zona: { x0: 0, x1: 1400, y0: 660, y1: 775 } })
      ]
    }),
    vertical: variante('3v', 'background-3-vertical.png', {
      movimiento: 2,
      velocidad: (y) => 9 * (1 - suave(200, 880, y)),
      sol: { x: 762, y: 862, radio: 40 },
      pasto: { amplitud: 2, brillo: 0.05 },
      crearVida: () => [
        niebla({
          bandas: [
            { y: 505, velocidad: 3, alfa: 0.16, cantidad: 2 },
            { y: 580, velocidad: 4, alfa: 0.18, cantidad: 3 },
            { y: 655, velocidad: 6, alfa: 0.11, cantidad: 3 }
          ]
        }),
        aguila({ x: 225, y: 230, radio: [140, 30] }),
        bandada({ y: [300, 400], color: '#5f4760', tamano: [3, 5], cada: [18, 35] }),
        conejos({ cantidad: 1, zona: { x0: 20, x1: 430, y0: 752, y1: 790 } }),
        mariposas({ cantidad: 2, zona: { x0: 20, x1: 430, y0: 700, y1: 775 } }),
        luciernagas({ cantidad: 10, zona: { x0: 0, x1: 450, y0: 715, y1: 790 } })
      ]
    })
  },

  // Colinas (hub): pinos y un árbol grande, ciervos pastando y un zorro de paso
  4: {
    titulo: 'Las colinas',
    horizontal: variante('4', 'background-4.png', {
      velocidad: (y) => 4 * (1 - suave(300, 440, y)),
      sol: { x: 757, y: 455, radio: 34 },
      estrellas: [[808, 31, 5, 6], [234, 39, 6, 6], [1034, 56, 7, 7], [832, 66, 5, 5], [492, 72, 5, 5],
        [636, 90, 5, 5], [1390, 99, 4, 4], [415, 118, 5, 7], [902, 119, 4, 3], [700, 123, 4, 5]],
      pasto: { amplitud: 3, brillo: 0.05 },
      agua: { amplitud: 0.6 },
      crearVida: () => [
        bandada({ y: [130, 330], color: '#7d6680', tamano: [4, 8] }),
        destellos({ zona: { x0: 570, x1: 800, y0: 522, y1: 568 }, cantidad: 18, color: '#fff6e4' }),
        ciervos({ lugares: [{ x: 880, y: 598 }, { x: 930, y: 606, direccion: -1 }], escala: 2, rango: 50 }),
        zorro({ camino: { x0: 250, x1: 1100, y: (x) => 712 - x * 0.02 } }),
        conejos({ cantidad: 3, zona: { x0: 40, x1: 1360, y0: 690, y1: 775 } }),
        hojas({
          origenes: [{ x0: 1165, x1: 1385, y0: 375, y1: 560, suelo: 640 }],
          colores: ['#9a5f80', '#b77c99', '#7d4d6a'],
          cantidad: 10
        }),
        mariposas({ cantidad: 4, zona: { x0: 40, x1: 900, y0: 650, y1: 760 } }),
        pelusas({ cantidad: 8, zona: { x0: 0, x1: 1400, y0: 520, y1: 700 } })
      ]
    }),
    vertical: variante('4v', 'background-4-vertical.png', {
      movimiento: 2,
      velocidad: (y) => 6 * (1 - suave(700, 1100, y)),
      sol: { x: 520, y: 1128, radio: 44 },
      estrellas: [[586, 156, 6, 11], [873, 242, 8, 16], [618, 269, 5, 11], [185, 283, 6, 11],
        [368, 328, 7, 12], [89, 401, 6, 15], [706, 403, 4, 8], [449, 414, 5, 10]],
      pasto: { amplitud: 3, brillo: 0.05 },
      agua: { amplitud: 0.6 },
      crearVida: () => [
        bandada({ y: [80, 400], color: '#7d6680', tamano: [3, 6] }),
        destellos({ zona: { x0: 135, x1: 280, y0: 612, y1: 646 }, cantidad: 12, color: '#fff6e4' }),
        ciervos({ lugares: [{ x: 330, y: 668 }, { x: 368, y: 672, direccion: -1 }], escala: 2, rango: 25 }),
        zorro({ camino: { x0: 40, x1: 420, y: (x) => 735 - x * 0.02 } }),
        conejos({ cantidad: 2, zona: { x0: 10, x1: 440, y0: 700, y1: 790 } }),
        mariposas({ cantidad: 3, zona: { x0: 10, x1: 440, y0: 690, y1: 780 } }),
        pelusas({ cantidad: 5, zona: { x0: 0, x1: 450, y0: 560, y1: 720 } })
      ]
    })
  }
};
