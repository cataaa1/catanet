# CataNet 🎮

Hub de juegos online para jugar con amigos vía link, sin registro.

## Juegos disponibles

### Wordle
- **Individual** — la experiencia clásica, a tu ritmo
- **Custom** — creás una palabra y compartís un link para que otra persona la adivine
- **Co-Wordle por turnos** — dos jugadores comparten seis intentos, en tiempo real
- **Versus por tiempo** — 90 segundos para completar la mayor cantidad de Wordles

### Sudoku
- **Individual** — tableros de 9x9 en tres dificultades

## En camino
- Sudoku cooperativo y versus
- Ajedrez online

Ver [docs/roadmap.md](docs/roadmap.md) para el estado detallado.

## Cómo correr el proyecto

### Requisitos
- Node.js 18+
- npm

### Instalación

```bash
# 1. Instalar dependencias del backend
cd backend
npm install

# 2. Correr el servidor
npm run dev   # con auto-reload (desarrollo)
npm start     # sin auto-reload (producción)
```

### Abrir el frontend

Entrá a **http://localhost:3000** — Express sirve el hub y todos los juegos.

> No abras los `index.html` con doble click. El frontend usa módulos ES con rutas
> absolutas (`/shared/catalog.js`) que sólo funcionan si la página viene del servidor.

> Ojo: el `package.json` está en `backend/`, no en la raíz. Si corrés `npm run dev`
> desde la raíz vas a ver un error `ENOENT ... package.json`.

## Estructura del proyecto

```
CataNet/
├── CLAUDE.md              ← instrucciones para el agente IA
├── README.md
├── .gitignore
├── docs/
│   ├── design-tokens.md   ← colores y componentes de diseño
│   ├── architecture.md    ← cómo funciona el backend
│   ├── roadmap.md         ← qué falta para darlo por completo
│   └── game-specs/        ← reglas de cada juego
├── backend/
│   ├── package.json
│   ├── server.js          ← Express + Socket.io + archivos estáticos
│   ├── rooms.js           ← salas del Co-Wordle
│   ├── versusRooms.js     ← salas del Versus por tiempo
│   └── words.js           ← palabras del juego
└── frontend/
    ├── hub/               ← menú principal
    ├── shared/            ← catálogo de juegos y lógica compartida
    ├── co-wordle/
    ├── wordle/            ← menú + individual + custom + versus-tiempo
    └── sudoku/            ← menú + individual
```

## Stack
- **Frontend**: HTML + CSS + JS vanilla, sin bundler
- **Backend**: Node.js + Express + Socket.io
- **Deploy**: pendiente — un solo servicio, con soporte WebSocket
