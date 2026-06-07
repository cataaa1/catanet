# CataNet 🎮

Hub de juegos online para jugar con amigos via link, sin registro.

## Juegos disponibles
- **Co-Wordle** — Wordle en tiempo real contra un amigo

## Juegos en camino
- Sudoku colaborativo
- Ajedrez online

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

El servidor queda en `http://localhost:3000`

### Abrir el frontend

Abrí `frontend/hub/index.html` en el navegador,
o usá la extensión **Live Server** de VS Code.

## Estructura del proyecto

```
CataNet/
├── CLAUDE.md              ← instrucciones para el agente IA
├── README.md
├── .gitignore
├── docs/
│   ├── design-tokens.md   ← colores y componentes de diseño
│   ├── architecture.md    ← cómo funciona el backend
│   └── game-specs/
│       └── co-wordle.md   ← reglas del Co-Wordle
├── backend/
│   ├── package.json
│   ├── server.js          ← Express + Socket.io
│   ├── rooms.js           ← manejo de salas
│   └── words.js           ← palabras del juego
└── frontend/
    ├── hub/
    │   └── index.html     ← menú principal
    └── co-wordle/
        ├── index.html
        ├── style.css
        └── game.js
```

## Stack
- **Frontend**: HTML + CSS + JS vanilla
- **Backend**: Node.js + Express + Socket.io
- **Deploy**: Vercel (frontend) + Railway (backend)
