# CataNet — Instrucciones para Claude Code

## Qué es este proyecto
Hub de juegos online para jugar con amigos vía link compartido, sin registro.
Cada juego es una **familia** (Wordle, Sudoku, Buscaminas) y cada familia tiene
varios **modos** (individual, cooperativo, versus, custom).

El catálogo de familias y modos vive en un solo lugar: `frontend/shared/catalog.js`.
Si agregás un juego o un modo, se declara ahí y los menús se arman solos.

## Stack tecnológico

### Frontend
- HTML + CSS + JavaScript vanilla (sin frameworks)
- Sin bundlers, sin npm en el frontend
- Módulos ES nativos (`<script type="module">`) con imports absolutos (`/shared/...`)
- Tipografía: Inter (Google Fonts)
- Paleta de colores: ver `/docs/design-tokens.md`

### Backend
- **Runtime**: Node.js
- **Framework**: Express (servidor HTTP + sirve el frontend estático)
- **Tiempo real**: Socket.io (WebSockets)
- **Base de datos**: Ninguna — el estado de las partidas vive en memoria (Map)
- **Package manager**: npm

### Deploy
- **En vivo en https://catanet.onrender.com** (Render, plan gratuito).
- Un solo servicio: Express sirve el frontend, así que no hay que separar
  frontend y backend.
- En Render, el **Root Directory tiene que estar vacío**. Si apunta a
  `backend/`, los cambios del frontend no disparan el auto-deploy.
- El plan gratuito duerme el servicio tras ~15 minutos sin tráfico, y al
  despertar tarda cerca de un minuto. Como las salas viven en memoria, al
  dormirse se pierden las partidas en curso.

## Estructura de carpetas

```
CataNet/
├── CLAUDE.md                    ← este archivo
├── README.md
├── .gitignore
├── docs/
│   ├── design-tokens.md         ← colores, tipografía, componentes
│   ├── architecture.md          ← cómo funciona el backend
│   ├── roadmap.md               ← qué falta para considerar el proyecto completo
│   └── game-specs/
│       ├── co-wordle.md
│       └── sudoku.md
├── backend/
│   ├── package.json
│   ├── server.js                ← Express + Socket.io + estáticos
│   ├── rooms.js                 ← salas del Co-Wordle por turnos
│   ├── versusRooms.js           ← salas del Versus por tiempo
│   ├── buscaminasRooms.js      ← salas del Buscaminas coop y versus
│   ├── sudokuRooms.js          ← salas de la Carrera de Sudoku
│   ├── sudokuDiario.js         ← genera y cachea el Sudoku del día
│   └── workers/                ← generación pesada fuera del hilo principal
│   └── words.js                 ← lista de palabras
└── frontend/
    ├── hub/
    │   ├── index.html           ← menú principal de CataNet
    │   └── assets/              ← logos y fondos de los menús
    ├── shared/
    │   ├── catalog.js           ← familias y modos (fuente de verdad de los menús)
    │   ├── words.js             ← palabras del lado cliente
    │   ├── sudoku.js            ← lógica compartida de Sudoku
    │   ├── buscaminas.js        ← motor del Buscaminas (cliente y servidor)
    │   ├── celebracion.js       ← festejo al ganar (papel picado + pulso)
    │   ├── resultado.js         ← cruz para cerrar el panel de resultado
    │   └── vendor/sudoku-lib.js ← librería externa de generación/solución
    ├── co-wordle/               ← Wordle cooperativo por turnos (online)
    ├── wordle/
    │   ├── index.html           ← menú de la familia Wordle
    │   ├── individual/
    │   ├── custom/
    │   └── versus-tiempo/       ← online
    ├── sudoku/
    │   ├── index.html           ← menú de la familia Sudoku
    │   ├── individual/
    │   ├── diario/              ← tablero del día, servido por el backend
    │   └── carrera/             ← online
    └── buscaminas/
        ├── index.html           ← menú de la familia Buscaminas
        ├── assets/              ← mina y bandera en pixel art
        ├── online/              ← cliente y estilos que comparten coop y versus
        ├── individual/
        ├── cooperativo/         ← online
        └── versus/              ← online
```

## Reglas importantes al escribir código

1. **Un archivo a la vez** — terminar y probar cada archivo antes de seguir
2. **Sin dependencias innecesarias** — solo Express y Socket.io en el backend
3. **Comentarios en español** — este es un proyecto de aprendizaje
4. **Variables y funciones en español** — ej: `estadoPartida`, `verificarIntento`
5. **Nunca hardcodear URLs** — usar la constante `SERVIDOR_URL` en el frontend
6. **Siempre manejar errores** — try/catch en el servidor, mensajes claros al usuario
7. **Los modos nuevos se declaran en `catalog.js`** — no hardcodear tarjetas en los menús
8. **Renderizar sin datos no debe romper** — inicializar el estado con estructuras
   vacías válidas, porque los menús y tableros se dibujan antes de tener partida
9. **Al ganar se festeja** — llamar a `festejar()` de `/shared/celebracion.js`,
   con una bandera `festejado` en el estado para que salga una sola vez por partida
10. **El panel de resultado se puede cerrar** — llamar a `habilitarCierreResultado()`
   de `/shared/resultado.js` en `inicializar()`. Requiere que el panel sea
   `#panel-resultado` con una tarjeta `.resultado` adentro

## Cómo correr el proyecto localmente

```bash
cd backend
npm install
npm run dev        # con auto-reload (nodemon)
```

Después abrir **http://localhost:3000** en el navegador.

> IMPORTANTE: no abrir los `index.html` con doble click (`file://`). El frontend
> usa módulos ES con rutas absolutas tipo `/shared/catalog.js`, que sólo resuelven
> si la página se sirve desde el servidor.

El `package.json` está en `backend/`, no en la raíz: si corrés `npm run dev`
desde la raíz del repo vas a recibir un error `ENOENT ... package.json`.

## Estado actual del proyecto

### Listo
- [x] Deploy en Render, con auto-deploy en cada push a `main`
- [x] Estructura de carpetas y documentación
- [x] Backend: `server.js` con Express + Socket.io + estáticos
- [x] Backend: salas del Co-Wordle (`rooms.js`) y del Versus (`versusRooms.js`)
- [x] Frontend: hub principal con catálogo compartido
- [x] Wordle: menú de familia + individual + custom + versus por tiempo
- [x] Co-Wordle: cooperativo por turnos, online
- [x] Sudoku: individual, diario (experto, uno por día) y carrera online
- [x] Buscaminas: motor compartido, menú de familia y los tres modos

### Pendiente
- [ ] Probar de punta a punta los modos online con dos clientes reales
- [ ] Sudoku: modo cooperativo
- [ ] Persistencia de la partida en curso (hoy no se usa `localStorage`)
- [ ] Tests

Ver `/docs/roadmap.md` para el detalle de qué falta para considerarlo completo.
