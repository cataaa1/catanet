# CataNet — Instrucciones para Claude Code

## Qué es este proyecto
Hub de juegos online para jugar con amigos via link compartido, sin registro.
El primer juego es **Co-Wordle**: dos jugadores adivinan la misma palabra en tiempo real.

## Stack tecnológico

### Frontend
- HTML + CSS + JavaScript vanilla (sin frameworks)
- Sin bundlers, sin npm en el frontend
- Tipografía: Inter (Google Fonts)
- Paleta de colores: ver `/docs/design-tokens.md`

### Backend
- **Runtime**: Node.js
- **Framework**: Express (servidor HTTP)
- **Tiempo real**: Socket.io (WebSockets)
- **Base de datos**: Ninguna por ahora — estado de partidas en memoria (Map)
- **Package manager**: npm

### Deploy (futuro)
- Frontend: Vercel o GitHub Pages
- Backend: Railway o Render (soportan WebSockets)

## Estructura de carpetas

```
CataNet/
├── CLAUDE.md                  ← este archivo
├── README.md
├── .gitignore
├── docs/
│   ├── design-tokens.md       ← colores, tipografía, componentes
│   ├── architecture.md        ← cómo funciona el backend
│   └── game-specs/
│       └── co-wordle.md       ← reglas y flujo del co-wordle
├── backend/
│   ├── package.json
│   ├── server.js              ← entrada principal
│   ├── rooms.js               ← manejo de salas de juego
│   └── words.js               ← lista de palabras
└── frontend/
    ├── hub/
    │   └── index.html         ← menú principal de CataNet
    └── co-wordle/
        ├── index.html
        ├── style.css
        └── game.js            ← lógica cliente + Socket.io
```

## Reglas importantes al escribir código

1. **Un archivo a la vez** — terminar y probar cada archivo antes de seguir
2. **Sin dependencias innecesarias** — solo Express y Socket.io en el backend
3. **Comentarios en español** — este es un proyecto de aprendizaje
4. **Variables y funciones en español** — ej: `estadoPartida`, `verificarIntento`
5. **Nunca hardcodear URLs** — usar la constante `SERVIDOR_URL` en el frontend
6. **Siempre manejar errores** — try/catch en el servidor, mensajes claros al usuario

## Cómo correr el proyecto localmente

```bash
cd backend
npm install
node server.js
# Servidor corriendo en http://localhost:3000
```

Abrir `frontend/hub/index.html` en el navegador o servir con Live Server de VS Code.

## Estado actual del proyecto

- [x] Estructura de carpetas creada
- [x] Documentación inicial
- [ ] Backend: server.js con Express + Socket.io
- [ ] Backend: lógica de salas (rooms.js)
- [ ] Frontend: hub/index.html (menú principal)
- [ ] Frontend: co-wordle (cliente completo)

## Próximos juegos planeados
- Sudoku colaborativo
- Ajedrez online
