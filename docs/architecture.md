# Arquitectura del Backend — CataNet

## Visión general

```
[Jugador A] ←──WebSocket──→ [Servidor Node.js] ←──WebSocket──→ [Jugador B]
                                    │
                              Estado en memoria
                              (Map de salas)
```

El servidor es el árbitro: recibe acciones de los jugadores, actualiza
el estado de la sala, y reenvía los cambios a todos los participantes.
**No hay base de datos** — todo vive en memoria. Si el servidor se reinicia,
las partidas en curso se pierden. Es aceptable para este proyecto.

## Tecnologías

- **Express**: servidor HTTP para servir el frontend y manejar rutas simples
- **Socket.io**: WebSockets con fallback automático, manejo de salas integrado

## Flujo de una partida Co-Wordle

### 1. Crear sala
```
Jugador A abre co-wordle → clic "Nueva partida"
  → frontend emite: socket.emit('crear-sala')
  → servidor crea sala con ID único (ej: "abc123")
  → servidor responde: socket.emit('sala-creada', { salaId, linkCompartir })
  → frontend muestra link para copiar
```

### 2. Unirse a sala
```
Jugador B abre el link (ej: /co-wordle/?sala=abc123)
  → frontend emite: socket.emit('unirse-sala', { salaId })
  → servidor verifica que la sala existe y tiene lugar
  → servidor notifica a ambos: io.to(salaId).emit('partida-iniciada', { estado })
  → ambos ven el tablero y pueden jugar
```

### 3. Jugar un intento
```
Jugador A escribe "GATOS" y presiona Enter
  → frontend emite: socket.emit('enviar-intento', { salaId, intento: 'GATOS' })
  → servidor verifica el intento contra la palabra secreta
  → servidor calcula colores (verde/amarillo/gris)
  → servidor actualiza estado de la sala
  → servidor emite a todos: io.to(salaId).emit('intento-registrado', { jugador, intento, colores, estadoPartida })
  → ambos frontends actualizan sus tableros
```

### 4. Tipeo en tiempo real (opcional, fase 2)
```
Mientras Jugador A tipea letra por letra
  → frontend emite: socket.emit('tipeo', { salaId, letrasActuales })
  → servidor reenvía al otro: socket.to(salaId).emit('oponente-tipeando', { letrasActuales })
  → Jugador B ve en tiempo real lo que tipea A (en su propio tablero, tenue)
```

## Estructura del estado de una sala

```js
{
  id: "abc123",
  palabraSecreta: "PERRO",
  jugadores: {
    "socket-id-A": { nombre: "Jugador 1", color: "plum",  intentos: [], turno: 0 },
    "socket-id-B": { nombre: "Jugador 2", color: "mint",  intentos: [], turno: 0 }
  },
  fase: "esperando" | "jugando" | "terminada",
  ganador: null | "socket-id-A" | "socket-id-B" | "empate",
  creadaEn: Date
}
```

## Eventos Socket.io

### Cliente → Servidor
| Evento | Payload | Descripción |
|---|---|---|
| `crear-sala` | — | Crea una sala nueva |
| `unirse-sala` | `{ salaId }` | Jugador B se une |
| `enviar-intento` | `{ salaId, intento }` | Confirma una palabra |
| `tipeo` | `{ salaId, letras }` | Letras en tiempo real |
| `reiniciar-sala` | `{ salaId }` | Nueva partida en la misma sala |

### Servidor → Cliente
| Evento | Payload | Descripción |
|---|---|---|
| `sala-creada` | `{ salaId, link }` | Sala creada exitosamente |
| `error-sala` | `{ mensaje }` | Sala llena o no existe |
| `partida-iniciada` | `{ estado }` | Ambos conectados, a jugar |
| `intento-registrado` | `{ jugadorId, intento, colores, estado }` | Resultado de un intento |
| `oponente-tipeando` | `{ letras }` | Tipeo en tiempo real del rival |
| `partida-terminada` | `{ ganador, palabraSecreta }` | Fin del juego |
| `jugador-desconectado` | — | El rival se fue |

## Manejo de desconexiones

Si un jugador se desconecta:
1. El servidor detecta el evento `disconnect` de Socket.io
2. Notifica al otro jugador con `jugador-desconectado`
3. La sala queda en estado "pausada" por 60 segundos
4. Si el jugador vuelve a conectarse al mismo link, se reconecta a su sala
5. Si no vuelve, la sala se elimina

## Limpieza de salas

```js
// Cada 30 minutos, eliminar salas viejas
setInterval(() => {
  const hace30min = Date.now() - 30 * 60 * 1000;
  for (const [id, sala] of salas) {
    if (sala.creadaEn < hace30min) salas.delete(id);
  }
}, 30 * 60 * 1000);
```
