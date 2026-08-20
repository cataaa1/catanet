# Buscaminas — Especificación del juego

## Qué es
El Buscaminas clásico: una grilla con minas escondidas. Cada celda revelada
muestra cuántas minas hay en las ocho celdas que la rodean, y con eso se deduce
dónde están el resto. Se gana cuando quedan reveladas todas las celdas sin mina.

La familia tiene tres modos:

| Modo | Ruta | Jugadores | Online |
|---|---|---|---|
| Individual | `/buscaminas/individual/` | 1 | No |
| Cooperativo | `/buscaminas/cooperativo/` | 2+ | Sí |
| Versus | `/buscaminas/versus/` | 2 | Sí |

## Dificultades

| Dificultad | Grilla | Minas | Densidad |
|---|---|---|---|
| Fácil | 9 x 9 | 10 | 12,3 % |
| Medio | 16 x 16 | 40 | 15,6 % |
| Difícil | 16 x 30 | 99 | 20,6 % |

Son las medidas clásicas del juego original. En mobile la grilla difícil no entra
a lo ancho, así que scrollea en horizontal dentro de su contenedor.

## Generación del tablero

### Las minas se colocan recién en el primer click
Al crear la partida el tablero está vacío. Las minas se sortean cuando la persona
revela su primera celda, excluyendo esa celda **y sus ocho vecinas**. Eso garantiza
dos cosas:

1. El primer click nunca es una mina.
2. Esa celda queda en cero, así que dispara la cascada y abre un área grande.

Sin esto, la primera jugada sería a ciegas y podría terminar la partida al instante,
lo que en versus y cooperativo es especialmente injusto.

Si la dificultad no deja lugar suficiente para excluir las nueve celdas (no pasa con
las tres dificultades actuales, pero podría con una grilla chica y muchas minas), se
excluye solamente la celda clickeada.

### Números adyacentes
Colocadas las minas, cada celda sin mina guarda cuántas minas tiene alrededor,
contando las ocho vecinas. Se calcula una sola vez, al colocar las minas.

## Reglas de juego

### Revelar
- Revelar una celda con mina termina la partida.
- Revelar una celda en cero abre en cascada todas las celdas conectadas que también
  estén en cero, más el borde de números que las rodea.
- Una celda con bandera no se puede revelar: primero hay que sacar la bandera.

### Banderas
Marcan dónde uno cree que hay una mina. No se pueden revelar y descuentan del
contador de minas restantes, que puede quedar en negativo si se ponen de más.

- **Desktop**: click derecho sobre la celda.
- **Touch**: botón que alterna entre modo revelar y modo bandera.

### Chording
Click sobre un número que ya tiene tantas banderas alrededor como indica, revela
todas sus vecinas sin bandera de una. Si alguna de esas banderas estaba mal puesta,
se revela una mina y se pierde. Es lo que hace jugable el nivel difícil.

### Victoria
Se gana cuando todas las celdas **sin mina** están reveladas. Las banderas no
importan para ganar: se puede ganar sin haber puesto ninguna.

## Modo individual

Corre entero en el cliente, sin servidor, igual que el Sudoku individual.

- Selector de dificultad, contador de minas restantes y cronómetro que arranca en
  el primer click.
- Al perder se revelan todas las minas y se marca en rojo la que se pisó.
- Al ganar se llama a `festejar()` de `/shared/celebracion.js`.

## Modo cooperativo (online)

Varias personas sobre un mismo tablero, en tiempo real. Sin turnos: todas pueden
revelar cuando quieran.

- **Una mina y se acabó.** La primera mina que pise cualquiera termina la partida
  para todo el equipo. Es el Buscaminas clásico, sin vidas ni penalizaciones.
- Cada persona tiene un color, y las celdas que revela se marcan con ese color para
  ver quién hizo qué.
- Las banderas son compartidas: cualquiera puede sacar la de otro.
- Se ve el cursor de las demás personas sobre la grilla.
- Al ganar, festejan todas.

## Modo versus (online)

Dos personas, el **mismo** tablero, cada una con su copia.

- Gana quien despeja primero.
- **Pisar una mina es derrota inmediata**, y la otra persona gana en el acto.
- Cada una ve el progreso de la otra: cuántas celdas lleva reveladas, pero no
  cuáles ni qué hay debajo.

## Arquitectura

### El tablero online vive en el servidor
En cooperativo y versus, el cliente **nunca** recibe dónde están las minas. Solo
recibe las celdas ya reveladas y su número. Es el mismo criterio que la palabra
secreta del Co-Wordle: si el tablero viajara entero, ganar sería abrir el DevTools.

Cuando alguien revela una celda:

1. El cliente manda `fila` y `columna`.
2. El servidor revela, calcula la cascada y decide si explotó o si se gano.
3. El servidor devuelve **solo** las celdas que se revelaron con su número.

### Reparto de responsabilidades

- `frontend/shared/buscaminas.js` — el motor: generación, revelado con cascada,
  banderas, chording y condición de victoria. Sin DOM, para poder usarlo tanto en
  el cliente del modo individual como en el servidor de los modos online.
- `frontend/buscaminas/individual/` — usa el motor directo en el navegador.
- `backend/buscaminasRooms.js` — salas de cooperativo y versus, con el motor del
  lado del servidor.

### Eventos de Socket.io

**Cliente → Servidor**

| Evento | Datos | Qué hace |
|---|---|---|
| `buscaminas-crear-sala` | `{ modo, dificultad }` | Crea sala y devuelve link |
| `buscaminas-unirse-sala` | `{ salaId }` | Se suma a una sala existente |
| `buscaminas-revelar` | `{ salaId, fila, columna }` | Revela una celda |
| `buscaminas-bandera` | `{ salaId, fila, columna }` | Pone o saca una bandera |
| `buscaminas-reiniciar` | `{ salaId }` | Revancha con tablero nuevo |

**Servidor → Cliente**

| Evento | Datos | Cuándo |
|---|---|---|
| `buscaminas-sala-creada` | `{ salaId, link, estado }` | Al crear |
| `buscaminas-partida-iniciada` | `{ estado }` | Cuando hay gente suficiente |
| `buscaminas-celdas-reveladas` | `{ jugadorId, celdas, estado }` | Tras revelar |
| `buscaminas-bandera-cambiada` | `{ jugadorId, fila, columna, puesta }` | Tras marcar |
| `buscaminas-partida-terminada` | `{ resultado, minas, estado }` | Al ganar o perder |

Las minas reales se mandan **solo** en `buscaminas-partida-terminada`, para poder
dibujar el tablero completo cuando ya no importa.

## Pendiente para una segunda vuelta

**Tableros sin adivinanza.** Hoy la generación es clásica: minas al azar con el
primer click protegido. Eso significa que algunas partidas llegan a una posición
donde no queda más remedio que adivinar entre dos celdas. Resolverlo necesita un
solver que verifique que el tablero se puede deducir entero, y regenerar hasta
encontrar uno que cumpla. Queda para después de tener el juego andando.
