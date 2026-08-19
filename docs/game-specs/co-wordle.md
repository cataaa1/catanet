# Co-Wordle — Especificación del juego

> ATENCIÓN: este documento está desactualizado. Describe una versión simultánea
> y competitiva (un tablero por jugador, gana quien adivina primero), pero lo que
> se implementó en `backend/rooms.js` es **cooperativo por turnos**: los dos
> jugadores comparten un mismo tablero de seis intentos y alternan jugadas.
> Las secciones de verificación de colores, palabras y animaciones siguen siendo
> válidas. Falta reescribir el flujo y las pantallas. Ver `docs/roadmap.md`.

## Qué es
Versión multijugador en tiempo real del Wordle clásico.
Dos jugadores reciben la misma palabra secreta y compiten para adivinarla primero.
No hace falta registro: un jugador crea la sala, comparte el link, y listo.

## Flujo completo desde el usuario

### Jugador A (crea la sala)
1. Entra al hub CataNet y hace clic en "Co-Wordle"
2. Ve una pantalla con dos opciones: "Nueva partida" y "Unirse con código"
3. Hace clic en "Nueva partida"
4. El servidor crea la sala y devuelve un link (ej: `catanet.com/co-wordle/?sala=abc123`)
5. Jugador A ve su tablero vacío con el mensaje "Esperando al rival..." y el link para copiar
6. Cuando Jugador B se conecta, ambos ven "¡Empezamos!" y el tablero se activa

### Jugador B (se une)
1. Recibe el link de Jugador A
2. Abre el link directamente → lo lleva a la sala ya lista
3. Ve la pantalla de "Unirse" con el código pre-cargado
4. Hace clic en "Unirse" → aparece en la sala, ambos arrancan

### Durante la partida
- Cada jugador tiene su propio tablero de 6×5
- Los tableros se muestran uno al lado del otro (desktop) o apilados (mobile)
- Ambos juegan simultáneamente — no hay turnos
- Cada jugador ve en tiempo real el progreso del otro (qué fila está completando, no las letras exactas hasta que confirma)
- Cuando alguien confirma un intento, el resultado aparece en su tablero y el otro lo ve

### Fin de la partida
- Gana quien adivina la palabra primero
- Si ambos la adivinan en el mismo intento: empate
- Si alguno usa los 6 intentos sin acertar: pierde (aunque el otro siga)
- Al terminar: pantalla con resultado, la palabra revelada, y botón "Revancha"

## Pantallas del frontend

### 1. Pantalla de inicio (`/co-wordle/`)
```
┌─────────────────────────────┐
│  ← Volver      Co-Wordle    │
│                             │
│   [Nueva partida]           │
│                             │
│   ─── o ───                 │
│                             │
│   Código de sala: [______]  │
│              [Unirse]       │
└─────────────────────────────┘
```

### 2. Sala esperando rival
```
┌─────────────────────────────┐
│  Sala: abc123               │
│  [Copiar link] 📋           │
│                             │
│  Vos          Rival         │
│  ┌─────┐     ┌─────┐        │
│  │     │     │  ?  │        │  ← rival no conectado
│  └─────┘     └─────┘        │
│                             │
│  Esperando al rival...      │
└─────────────────────────────┘
```

### 3. Partida en curso
```
┌──────────────────────────────────┐
│  Sala: abc123    ⏱ 02:34         │
│                                  │
│  Vos              Rival          │
│  ┌───┬───┬───┐   ┌───┬───┬───┐  │
│  │ G │ A │...│   │ P │ E │...│  │  ← intentos propios en color
│  └───┴───┴───┘   └───┴───┴───┘  │  ← intentos del rival en gris tenue
│  [teclado virtual]               │
└──────────────────────────────────┘
```

### 4. Fin de partida
```
┌─────────────────────────────┐
│  🎉 ¡Ganaste!               │
│  (o: "El rival ganó" / "Empate") │
│                             │
│  La palabra era: PERRO      │
│                             │
│  Vos: 3 intentos            │
│  Rival: 4 intentos          │
│                             │
│  [Revancha] [Volver al hub] │
└─────────────────────────────┘
```

## Reglas de la lógica de verificación

### Colores de las celdas
- **Verde** (`--wordle-correcto`): letra correcta en posición correcta
- **Amarillo** (`--wordle-presente`): letra existe en la palabra pero en otra posición
- **Gris** (`--wordle-ausente`): la letra no aparece en la palabra

### Manejo de letras repetidas
Este es el caso más difícil. Ejemplo: palabra = "PERRO", intento = "RADAR"
- R en posición 0: está en "PERRO" → amarillo
- A en posición 1: no está → gris
- D en posición 2: no está → gris
- A en posición 3: no está → gris
- R en posición 4: está en posición 4 de "PERRO" → verde

Algoritmo correcto:
1. Primera pasada: marcar los verdes exactos
2. Segunda pasada: para los no-verdes, marcar amarillos solo si la letra
   aparece en la palabra Y quedan ocurrencias sin asignar

### Validación de intentos
- Exactamente 5 letras
- Solo letras A-Z y Ñ (sin tildes)
- Cualquier palabra de 5 letras es válida (no se valida contra diccionario
  en la primera versión — simplifica mucho y evita frustración)

## Palabras
- Lista en `backend/words.js`
- Mínimo 200 palabras de 5 letras en español
- Sin tildes ni caracteres especiales
- Palabras comunes y conocidas (no palabras muy técnicas o raras)
- La palabra se elige aleatoriamente al crear la sala (no por fecha,
  ya que dos salas distintas deben poder tener palabras distintas)

## Animaciones del juego

- **Flip**: al revelar el resultado de un intento, las celdas rotan en Y (0→90°→0°) mostrando el color
- **Shake**: si se intenta confirmar con menos de 5 letras o palabra inválida
- **Bounce**: cuando se adivina la palabra (las celdas de la fila ganadora saltan)
- **Pop**: pequeño scale al tipear cada letra (1→1.1→1)
- Todas con `@keyframes` CSS, sin librerías

## Consideraciones técnicas

- La palabra secreta **nunca se envía al cliente** — solo el servidor la sabe
- El cliente envía el intento como string, el servidor devuelve el array de colores
- El ID de sala: 6 caracteres alfanuméricos aleatorios (ej: "abc123")
- Máximo 2 jugadores por sala
- Tiempo máximo de partida: sin límite en v1
