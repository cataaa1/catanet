# Roadmap — Qué falta para decir que CataNet está completo

Este documento existe para responder una sola pregunta: **¿cuándo está terminado?**
Hay dos líneas de llegada distintas y conviene no mezclarlas.

---

## Nivel 1 — v1 publicable

El objetivo declarado del proyecto es *"jugar con amigos vía link compartido"*.
Hoy eso **no se cumple**: todo funciona sólo en `localhost`. Estos son los puntos
mínimos para que el proyecto haga lo que promete.

- [x] ~~Deploy en un host con WebSockets~~ — vivo en
      [catanet.onrender.com](https://catanet.onrender.com), con auto-deploy en
      cada push a `main`.
- [ ] **Probar los modos online de punta a punta.**
      El Co-Wordle por turnos y el Versus por tiempo están escritos completos,
      pero nunca se jugó una partida real de dos clientes contra el servidor
      desplegado. Hasta que eso pase, "funciona" es una suposición.
- [ ] **Revisar los links del hub contra las rutas reales.**
      El catálogo es la fuente de verdad de los menús; un modo mal declarado
      manda a un 404 sin avisar.
- [x] Documentación del Sudoku (`docs/game-specs/sudoku.md`)
- [x] Documentación del Buscaminas (`docs/game-specs/buscaminas.md`)
- [x] ~~Actualizar `docs/game-specs/co-wordle.md`~~ — reescrito según lo que
      hace `backend/rooms.js`: cooperativo por turnos, con seis intentos
      compartidos y un solo tablero.

Cuando estos puntos estén, CataNet es un producto real: un link que le pasás a
alguien y juegan.

---

## Nivel 2 — Visión completa

Lo que convierte el v1 en el proyecto que describe el hub.

### Juegos
- [x] ~~Buscaminas cooperativo~~ — listo, en `backend/buscaminasRooms.js`
- [x] ~~Buscaminas versus~~ — listo, mismo tablero para los dos
- [ ] **Buscaminas sin adivinanza** — solver que garantice tableros deducibles
- [x] ~~Sudoku diario~~ — un tablero experto por día, el mismo para todo el mundo
- [x] ~~Carrera de Sudoku~~ — hasta seis personas, gana quien resuelve primero
- [ ] **Sudoku cooperativo** — mismo tablero, varias personas en tiempo real
- [ ] **Sudoku versus** — mismo tablero, gana quien completa primero
- [x] ~~Ajedrez~~ — descartado: necesita un motor de evaluación propio, que es un
      proyecto aparte. Se reemplazó por el Buscaminas.

El menú de Sudoku ya promete estos modos en su texto de presentación, así que
mientras no existan, la página está prometiendo de más.

### Calidad
- [ ] **Persistencia de la partida en curso.** El Sudoku diario ya se guarda en
      `localStorage`; el resto de los modos todavía pierden el tablero al recargar.
- [x] ~~Tests~~ — 406 chequeos en `/tests`, se corren con `npm test`. Cubren los
      tres motores, las salas de los cuatro juegos online, los juegos contra un
      DOM falso y los modos online contra el servidor real.
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
