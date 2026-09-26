// Montañas (fondo del menú Buscaminas): el cielo de nubes rasgadas corre más
// rápido arriba que en el horizonte, la niebla se desliza entre los cerros y
// un águila planea en círculos.
import { iniciarPaisaje, suave } from '/background/motor.js';
import { bandada, aguila, niebla, conejos, mariposas, luciernagas } from '/background/vida.js';

iniciarPaisaje({
  mascara: '/background/assets/mascara-3.png',
  mensaje: 'Mirá al águila dar vueltas.',
  cielo: {
    textura: '/background/assets/cielo-3.png',
    velocidad: (y) => 6.5 * (1 - suave(120, 410, y))
  },
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
    conejos({
      cantidad: 2,
      zona: { x0: 40, x1: 1360, y0: 722, y1: 780 }
    }),
    mariposas({ cantidad: 3, zona: { x0: 60, x1: 1340, y0: 640, y1: 750 } }),
    luciernagas({ cantidad: 14, zona: { x0: 0, x1: 1400, y0: 660, y1: 775 } })
  ]
});
