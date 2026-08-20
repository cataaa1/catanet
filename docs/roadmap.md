# Roadmap — Qué falta para decir que CataNet está completo

Este documento existe para responder una sola pregunta: **¿cuándo está terminado?**
Hay dos líneas de llegada distintas y conviene no mezclarlas.

---

## Nivel 1 — v1 publicable

El objetivo declarado del proyecto es *"jugar con amigos vía link compartido"*.
Hoy eso **no se cumple**: todo funciona sólo en `localhost`. Estos son los puntos
mínimos para que el proyecto haga lo que promete.

- [ ] **Deploy en un host con WebSockets.**
      No hay ninguna configuración de deploy en el repo. Como Express ya sirve el
      frontend estático, alcanza con **un solo servicio** — no hace falta separar
      frontend y backend.
- [ ] **Probar los modos online de punta a punta.**
      El Co-Wordle por turnos y el Versus por tiempo están escritos completos,
      pero nunca se jugó una partida real de dos clientes contra el servidor
      desplegado. Hasta que eso pase, "funciona" es una suposición.
- [ ] **Revisar los links del hub contra las rutas reales.**
      El catálogo es la fuente de verdad de los menús; un modo mal declarado
      manda a un 404 sin avisar.
- [x] Documentación del Sudoku (`docs/game-specs/sudoku.md`)
- [x] Documentación del Buscaminas (`docs/game-specs/buscaminas.md`)
- [ ] **Actualizar `docs/game-specs/co-wordle.md`.**
      El spec describe un juego simultáneo y competitivo, con un tablero por
      jugador. Lo implementado en `backend/rooms.js` es **cooperativo por turnos**,
      con seis intentos compartidos. El documento quedó desactualizado.

Cuando estos puntos estén, CataNet es un producto real: un link que le pasás a
alguien y juegan.

---

## Nivel 2 — Visión completa

Lo que convierte el v1 en el proyecto que describe el hub.

### Juegos
- [x] ~~Buscaminas cooperativo~~ — listo, en `backend/buscaminasRooms.js`
- [x] ~~Buscaminas versus~~ — listo, mismo tablero para los dos
- [ ] **Buscaminas sin adivinanza** — solver que garantice tableros deducibles
- [ ] **Sudoku cooperativo** — mismo tablero, varias personas en tiempo real
- [ ] **Sudoku versus** — mismo tablero, gana quien completa primero
- [x] ~~Ajedrez~~ — descartado: necesita un motor de evaluación propio, que es un
      proyecto aparte. Se reemplazó por el Buscaminas.

El menú de Sudoku ya promete estos modos en su texto de presentación, así que
mientras no existan, la página está prometiendo de más.

### Calidad
- [ ] **Persistencia de la partida en curso.** Ningún archivo usa `localStorage`:
      si recargás, perdés el tablero del Sudoku o el Wordle individual.
- [ ] **Tests.** No hay ninguno. Los candidatos naturales son la lógica pura:
      colores del Wordle con letras repetidas, detección de conflictos del Sudoku,
      transiciones de turno de las salas.
- [ ] **Reconexión a una sala.** Hoy si se te corta la conexión, se cierra la sala.
- [ ] **Limpieza de assets sin usar.** Quedaron huérfanos
      `frontend/hub/assets/hub-pixel-river.png` y `logo-ajedrez.png`. Los cuatro
      fondos de `assets/menus/` sí están en uso, uno por cada menú.

---

## Cómo mantener este documento

Cuando termines algo, marcá el checkbox acá y actualizá la sección
"Estado actual del proyecto" de `CLAUDE.md`. Ese archivo es lo que lee el agente
al empezar cada sesión: si miente sobre el estado, el agente trabaja con
información vieja.
