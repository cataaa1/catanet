// Pradera (fondo del menú Wordle): un cúmulo enorme que avanza despacio,
// dos árboles que se mecen, pasto peinado por el viento y conejos.
import { iniciarPaisaje, suave } from '/background/motor.js';
import { bandada, conejos, ciervos, mariposas, hojas, pelusas } from '/background/vida.js';

iniciarPaisaje({
  mascara: '/background/assets/mascara-1.png',
  mensaje: 'Acercá el mouse a un conejo.',
  cielo: {
    textura: '/background/assets/cielo-1.png',
    // El cúmulo se mueve entero; sólo la bruma del horizonte se queda quieta
    velocidad: (y) => 4 * (1 - suave(390, 456, y))
  },
  pasto: { amplitud: 3, brillo: 0.07 },
  crearVida: () => [
    bandada({ y: [90, 260], color: '#7b6a7e', tamano: [5, 9] }),
    ciervos({
      lugares: [{ x: 1180, y: 566, direccion: -1 }],
      escala: 2,
      rango: 40
    }),
    conejos({
      cantidad: 3,
      zona: { x0: 330, x1: 1360, y0: 610, y1: 775 }
    }),
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
});
