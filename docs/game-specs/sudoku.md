# Sudoku — Especificación del juego

## Qué es
Sudoku clásico de 9x9. Hay que completar la grilla con los dígitos 1 a 9 sin
repetir ninguno en la misma fila, columna ni bloque de 3x3.

Hay tres modos: **individual** y **diario**, que corren en el navegador, y
**carrera**, que es online. El cooperativo sigue planeado.

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

El panel de la izquierda tiene cuatro acciones arriba y el numpad de 3x3 abajo.

- **Click o toque** sobre una celda editable para seleccionarla
- **Teclas 1-9** o los botones del numpad para escribir
- **0, Delete o Backspace** (o el botón "Borrar") para vaciar la celda
- **Flechas** para mover la selección (con wrap-around en los bordes)
- **Deshacer** (o `Ctrl+Z`) revierte jugada por jugada, incluidas las notas
- **Borrador** (o la tecla `N`) alterna el modo de anotaciones
- **Pista** revela una celda; hay tres por tablero. Deshacer una pista
  devuelve el crédito
- Las pistas iniciales son fijas: si se intenta escribirlas o borrarlas,
  aparece un aviso y no cambia nada

### Modo borrador
Con el borrador activo, cada dígito se agrega o se saca de las anotaciones de
la celda, que se dibujan en una grilla de 3x3 dentro del casillero. Escribir un
valor real borra las anotaciones de esa celda.

### Numpad
Cada tecla se apaga a gris cuando ese dígito ya aparece nueve veces en el
tablero, para no tener que contarlos a mano. Con la tecla apagada no se puede
escribir ese número.

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

## Modo diario

Un tablero por día, **el mismo para todo el mundo**, que cambia a la medianoche
hora de Argentina (UTC-3).

### Cómo se consigue que sea el mismo para todos
La librería externa saca todo su azar de una sola función, `_rand_range`. El
motor la reemplaza temporalmente por un generador con semilla (mulberry32), así
que la misma semilla produce siempre el mismo tablero. La semilla sale de la
fecha, con lo cual el tablero del día es reproducible incluso si el servidor se
reinicia.

### Por qué lo genera el servidor y no el navegador
Generar es caro y muy variable. Medido en esta máquina:

| Pistas | Tiempo por tablero |
|---|---|
| 34 (fácil/medio) | ~220 ms |
| 30 (difícil) | ~1,8 s |
| 28 (experto) | ~6,4 s |
| 26 | ~95 s |
| 24 | revienta: `Maximum call stack size exceeded` |

**Ojo con bajar de 28 pistas.** La librería externa tiene un límite duro ahí:
con 26 tarda un minuto y medio por tablero, y con 24 la recursión de `_eliminate`
se queda sin pila y tira una excepción. Si algún día se quiere un diario más
difícil que `experto`, no alcanza con bajar las pistas: hace falta otro generador.

Como `experto` usa 28 y queda a un escalón de esa zona, si la generación falla el
diario sale en dificultad `difícil` antes que no salir, y tras un fallo el
servidor espera treinta segundos antes de reintentar, para que el cliente que
pregunta cada segundo y medio no dispare un worker en cada pregunta.

Un tablero experto tarda unos 20 segundos en salir, contando los reintentos que
hacen falta para que cumpla las reglas de dificultad. Eso es inaceptable en el
navegador, así que lo genera el servidor **una vez por día** y lo cachea:

- Corre en un **worker thread**, no en el hilo principal. Si no, el servidor se
  quedaría sin responder veinte segundos y cortaría las partidas online en curso.
- Se dispara al arrancar el servidor, para que nadie tenga que esperarlo.
- El endpoint `GET /api/sudoku/diario` contesta `202` con `{ listo: false }`
  mientras se genera, en vez de dejar la petición colgada. El cliente vuelve a
  preguntar cada segundo y medio.

### Dificultad
Usa la dificultad `experto`: 28 pistas, sin ninguna jugada obvia de entrada
(`maxSingles: 0`) y con un promedio alto de candidatos por celda.

### Sin ayudas, a propósito
No tiene pistas, borrador ni deshacer. Si la gracia es que todos resuelvan el
mismo tablero, las ayudas arruinan la comparación de tiempos.

## Modo carrera (online)

Hasta seis personas, **el mismo tablero para todas**, y gana quien lo completa
primero. No hay límite de tiempo: un Sudoku lleva su rato y cortar por reloj
dejaría casi todas las partidas sin ganador.

- Cada quien juega su propia copia del tablero.
- Se ve el avance del resto en vivo, con una barra por persona, pero no su
  tablero.
- Se puede entrar con la carrera empezada, arrancando desde el tablero original.

### El servidor es el árbitro
A diferencia del Buscaminas, acá **no hay información oculta**: cualquiera puede
resolver el tablero a partir de las pistas, así que esconder la solución no
protegería nada. Lo que sí importa es que el conteo sea confiable, y por eso el
servidor guarda el tablero de cada persona, cuenta cuántas celdas coinciden con
la solución y decide quién terminó. La solución recién viaja al cliente cuando la
carrera termina.

### Eventos de Socket.io

| Evento | Dirección | Qué hace |
|---|---|---|
| `sudoku-crear-sala` | C→S | Crea la sala con una dificultad |
| `sudoku-unirse-sala` | C→S | Se suma a una sala |
| `sudoku-jugada` | C→S | Escribe o borra una celda |
| `sudoku-reiniciar` | C→S | Otra carrera con tablero nuevo |
| `sudoku-sala-creada` | S→C | Devuelve id y link |
| `sudoku-estado` | S→C | Estado, incluido mientras se genera |
| `sudoku-partida-iniciada` | S→C | Reparte el tablero |
| `sudoku-jugada-registrada` | S→C | Avance actualizado de todos |
| `sudoku-partida-terminada` | S→C | Ganador y solución |

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
