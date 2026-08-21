# Pruebas de CataNet

```bash
cd backend
npm test                 # corre todas
npm test -- sudoku       # corre solo las que tengan "sudoku" en el nombre
```

También se puede llamar directo: `node tests/correr.mjs`.

## Cómo están armadas

No hay framework: son scripts de Node que usan el motor y los juegos de verdad.
La idea es que se puedan leer de arriba a abajo sin conocer ninguna herramienta.

Cada archivo `*.prueba.mjs` corre **en su propio proceso**. Eso no es capricho:
varias pruebas montan un DOM falso sobre `globalThis`, y compartiendo proceso se
pisan entre sí. Además, los juegos con cronómetro dejan un `setInterval` andando
y nunca cierran solos, así que el corredor las da por terminadas apenas imprimen
su resultado y las cierra.

Las pruebas se comunican con el corredor imprimiendo una línea `RESULTADO_PRUEBA:`
con un JSON al final.

## Qué cubre cada una

| Archivo | Qué prueba |
|---|---|
| `motor-buscaminas` | Generación, cascada, banderas, chording, victoria y que la vista pública no filtre dónde están las minas |
| `salas-buscaminas` | Salas de cooperativo y versus, sin sockets de por medio |
| `online-buscaminas` | Servidor real y dos clientes de Socket.io jugando |
| `online-sudoku` | Tablero diario y carrera, con servidor real y tres clientes |
| `sudoku-individual` | Escribir, deshacer, lápiz, pistas y los tres errores |
| `sudoku-diario` | Vidas, marcado de errores y que el progreso sobreviva a recargar |
| `buscaminas-individual` | Partida completa: ganar despejando y perder pisando una mina |
| `celebracion` | Papel picado: que dibuje, que limpie y que respete `prefers-reduced-motion` |
| `resultado` | La cruz para cerrar el panel, incluida su convivencia con el panel de ayuda |

## Las ayudas

- `ayudas/rutas.mjs` — rutas del repo, para no clavar rutas absolutas
- `ayudas/dom.mjs` — DOM falso, con las diferencias con el navegador que fueron
  apareciendo (vaciar `innerHTML` borra los hijos, `closest` reconoce los
  `data-*`, los modales arrancan ocultos)
- `ayudas/juego.mjs` — carga un `game.js` reescribiendo sus imports, porque los
  juegos importan con rutas del sitio (`/shared/...`) que Node no resuelve
- `ayudas/servidor.mjs` — levanta el servidor real y conecta clientes
- `ayudas/motor-espia.mjs` — envuelve el motor del Buscaminas para que la prueba
  sepa dónde están las minas y pueda ganar o perder a propósito
- `ayudas/stubs.mjs` — reemplazos del festejo y del cierre del resultado
