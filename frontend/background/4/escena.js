// Colinas (fondo del hub): pinos y un árbol grande al viento, nubes que
// cruzan, un lago que brilla a lo lejos, ciervos pastando y un zorro de paso.
import { iniciarPaisaje, suave } from '/background/motor.js';
import {
  bandada, destellos, ciervos, zorro, conejos, mariposas, hojas, pelusas
} from '/background/vida.js';

iniciarPaisaje({
  mascara: '/background/assets/mascara-4.png',
  mensaje: 'Fijate quién anda por las colinas.',
  cielo: {
    textura: '/background/assets/cielo-4.png',
    velocidad: (y) => 4 * (1 - suave(300, 440, y))
  },
  sol: { x: 757, y: 455, radio: 34 },
  estrellas: [[808, 31, 5, 6], [234, 39, 6, 6], [1034, 56, 7, 7], [832, 66, 5, 5], [492, 72, 5, 5],
    [636, 90, 5, 5], [1390, 99, 4, 4], [415, 118, 5, 7], [902, 119, 4, 3], [700, 123, 4, 5]],
  pasto: { amplitud: 3, brillo: 0.05 },
  agua: { amplitud: 0.6 },
  crearVida: () => [
    bandada({ y: [130, 330], color: '#7d6680', tamano: [4, 8] }),
    destellos({ zona: { x0: 570, x1: 800, y0: 522, y1: 568 }, cantidad: 18, color: '#fff6e4' }),
    ciervos({
      lugares: [{ x: 880, y: 598 }, { x: 930, y: 606, direccion: -1 }],
      escala: 2,
      rango: 50
    }),
    zorro({
      camino: { x0: 250, x1: 1100, y: (x) => 712 - x * 0.02 }
    }),
    conejos({
      cantidad: 3,
      zona: { x0: 40, x1: 1360, y0: 690, y1: 775 }
    }),
    hojas({
      origenes: [{ x0: 1165, x1: 1385, y0: 375, y1: 560, suelo: 640 }],
      colores: ['#9a5f80', '#b77c99', '#7d4d6a'],
      cantidad: 10
    }),
    mariposas({ cantidad: 4, zona: { x0: 40, x1: 900, y0: 650, y1: 760 } }),
    pelusas({ cantidad: 8, zona: { x0: 0, x1: 1400, y0: 520, y1: 700 } })
  ]
});
