# Sudoku — Especificación del juego

## Qué es
Sudoku clásico de 9x9. Hay que completar la grilla con los dígitos 1 a 9 sin
repetir ninguno en la misma fila, columna ni bloque de 3x3.

Hoy existe un solo modo: **individual** (`/sudoku/individual/`), offline, sin
servidor ni salas. Los modos cooperativo y versus están planeados pero no
construidos.

## Generación de tableros

La generación se apoya en la librería externa `frontend/shared/vendor/sudoku-lib.js`
(sudoku.js, licencia MIT). Encima de eso, `frontend/shared/sudoku.js` agrega un
filtro propio de dificultad, porque la cantidad de pistas por sí sola no describe
bien lo difícil que se siente un tablero.

### Dificultades

| Dificultad | Pistas iniciales | Intentos de generación |
|---|---|---|
| Fácil | 40 | 8 |
| Medio | 34 | 10 |
| Difícil | 30 | 12 |

### Cómo se filtra la dificultad
Por cada intento se genera un tablero y se le miden dos cosas sobre las celdas vacías:

- **singles**: cuántas celdas tienen un único candidato posible mirando sólo
  fila, columna y bloque. Son las jugadas "obvias" que se ven de entrada.
- **promedio de candidatos**: cuántas opciones tiene en promedio cada celda vacía.
  Cuanto más alto, menos se puede deducir directo.

Cada dificultad define un rango aceptable para esos dos números. Si un tablero
entra en el rango, se usa. Si no, se guarda su puntaje de cercanía y se prueba
otro. Agotados los intentos, se usa el mejor candidato encontrado.

Esto hace que la generación tarde un poco más (entre 200 ms y 700 ms según la
dificultad), y por eso la pantalla muestra "Generando tablero..." mientras trabaja.

## Flujo del modo individual

1. El jugador entra a `/sudoku/` y elige "Sudoku individual"
2. Arranca automáticamente un tablero en dificultad **Medio**
3. Puede cambiar de dificultad con los chips Fácil / Medio / Difícil — cada
   cambio genera un tablero nuevo
4. "Nuevo tablero" regenera con la dificultad actual
5. Al completar la grilla correctamente aparece el panel de resultado con la
   opción de jugar otro

## Controles

- **Click o toque** sobre una celda editable para seleccionarla
- **Teclas 1-9** o los botones del numpad para escribir
- **0, Delete o Backspace** (o el botón "Borrar") para vaciar la celda
- **Flechas** para mover la selección (con wrap-around en los bordes)
- Las pistas iniciales son fijas: si se intenta escribirlas o borrarlas,
  aparece un aviso y no cambia nada

## Reglas de la lógica

### Celdas fijas vs editables
El tablero inicial se guarda aparte del tablero actual. Una celda es editable
si venía vacía en el tablero inicial. Nunca se modifica el tablero inicial.

### Conflictos
Después de cada jugada se recorren las 9 filas, las 9 columnas y los 9 bloques.
Si dentro de un grupo un mismo dígito aparece dos o más veces, **todas** las
celdas con ese dígito en ese grupo se marcan en conflicto.

Los conflictos son informativos: no bloquean la escritura, sólo se resaltan y
se cuentan en el panel de progreso.

### Victoria
Se considera resuelto cuando el tablero está **completo** (sin celdas vacías) y
coincide exactamente con la solución guardada. La solución se calcula al generar
la partida y se guarda del lado del cliente — en el modo individual no hay
servidor, así que no tiene sentido ocultarla.

## Ayudas visuales

- La fila, la columna y el bloque de la celda seleccionada se resaltan
- Las celdas con el mismo dígito que la celda seleccionada se resaltan también
- Las celdas en conflicto se marcan en rojo
- Bordes más marcados cada 3 columnas y cada 3 filas, para separar los bloques

## Modos planeados

### Sudoku cooperativo
Dos o más personas resolviendo el mismo tablero en tiempo real, cada una con un
color de celda distinto. Necesita salas en el backend, en la línea de `rooms.js`.

### Sudoku versus
Mismo tablero para ambos, gana quien completa primero (o quien tiene más celdas
correctas cuando se acaba el tiempo). Necesita salas con temporizador, en la
línea de `versusRooms.js`.

## Consideraciones técnicas

- La lógica vive en `frontend/shared/sudoku.js` y no toca el DOM, justamente
  para poder reutilizarla desde los modos online sin cambios
- El estado arranca con una grilla vacía de 9x9 válida, porque la pantalla se
  dibuja antes de que exista el tablero
- No hay persistencia: recargar la página pierde la partida en curso
