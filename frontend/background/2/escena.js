// Lago (fondo del menú Sudoku): nubes rosadas, reflejos que tiemblan,
// patos, una garza que pesca, peces que saltan y luciérnagas en la orilla.
import { iniciarPaisaje, suave } from '/background/motor.js';
import {
  bandada, ondas, destellos, patos, peces, garza, conejos, mariposas, luciernagas, hojas
} from '/background/vida.js';

iniciarPaisaje({
  mascara: '/background/assets/mascara-2.png',
  mensaje: 'Tocá el agua para hacer ondas.',
  cielo: {
    textura: '/background/assets/cielo-2.png',
    velocidad: (y) => 3.4 * (1 - suave(250, 400, y))
  },
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
      patos({
        recorrido: { x0: 820, x1: 1180, y0: 612, y1: 648 },
        ondas: agua
      }),
      garza({ x: 762, y: 702, ondas: agua }),
      conejos({
        cantidad: 2,
        zona: { x0: 20, x1: 520, y0: 560, y1: 780 }
      }),
      hojas({
        origenes: [{ x0: 20, x1: 240, y0: 70, y1: 330, suelo: 470 }],
        colores: ['#8fa89a', '#6f8a80', '#b3c4b1'],
        cantidad: 8
      }),
      mariposas({ cantidad: 3, zona: { x0: 20, x1: 520, y0: 560, y1: 740 } }),
      luciernagas({ cantidad: 20, zona: { x0: 20, x1: 560, y0: 470, y1: 770 } })
    ];
  }
});
