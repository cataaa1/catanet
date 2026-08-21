# Co-Wordle — Especificación del juego

## Qué es
Wordle **cooperativo y por turnos**. Dos personas comparten una misma palabra
secreta y un mismo tablero de seis intentos, y juegan alternando: cuando una
escribe, la otra espera. Ganan o pierden juntas.

No hace falta registro: una persona crea la sala, comparte el link y listo.

## Flujo completo

### Quien crea la sala
1. Entra al hub y elige "Co-Wordle"
2. Toca "Nueva partida"
3. El servidor crea la sala y devuelve un link
   (ej: `catanet.onrender.com/co-wordle/?sala=abc1`)
4. Ve el tablero vacío con "Esperando al rival..." y el botón para copiar el link
5. Cuando entra la segunda persona, arranca la partida

### Quien se suma
1. Abre el link, que ya trae el código de sala
2. Se une automáticamente y arranca la partida

### Durante la partida
- **Un solo tablero de 6x5, compartido.** No hay un tablero por persona.
- **Se juega por turnos.** Sólo quien tiene el turno puede escribir; el servidor
  rechaza el intento de quien no lo tiene.
- Quien está esperando **ve en vivo lo que la otra persona va tipeando**, letra
  por letra, antes de que confirme.
- Al confirmar un intento, el resultado aparece en el tablero compartido y el
  turno pasa a la otra persona.
- El panel de jugadores marca de quién es el turno y cuántos intentos hizo cada
  una.

### Fin de la partida
- **Ganan las dos** si alguna descubre la palabra.
- **Pierden las dos** si se agotan los seis intentos compartidos.
- Al terminar se muestra el resultado con la palabra revelada y el botón de
  revancha. En la revancha **arranca la otra persona**: la sala guarda quién
  empezó la ronda anterior para alternar.

## Reglas de la lógica de verificación

### Colores de las celdas
- **Verde**: letra correcta en la posición correcta
- **Amarillo**: la letra está en la palabra pero en otra posición
- **Gris**: la letra no aparece en la palabra

### Manejo de letras repetidas
Es el caso difícil. Ejemplo: palabra = "PERRO", intento = "RADAR"

- R en posición 0: está en "PERRO" → amarillo
- A, D, A: no están → gris
- R en posición 4: coincide con la R de "PERRO" → verde

El algoritmo es de dos pasadas:

1. Marcar los verdes exactos y descontar esas letras del recuento disponible
2. Para los que no son verdes, marcar amarillo sólo si la letra aparece en la
   palabra **y quedan ocurrencias sin asignar**

### Validación de intentos
El servidor exige que el intento tenga exactamente 5 letras, sólo A-Z o Ñ sin
tildes, y que esté en la lista de palabras del juego. El tipeo en vivo también se
filtra: se descarta cualquier carácter que no sea A-Z o Ñ y se corta en 5.

Esa validación no es sólo comodidad: es lo que evita que alguien mande texto
arbitrario que después se dibuje en la pantalla de la otra persona.

## Palabras
- Lista en `backend/words.js`
- Palabras de 5 letras en español, comunes, sin tildes ni caracteres especiales
- La palabra se sortea al crear la sala, no por fecha: dos salas distintas tienen
  palabras distintas
- **La palabra secreta nunca se envía al cliente.** El cliente manda el intento y
  el servidor devuelve el array de colores. Sólo viaja al terminar la partida,
  para poder mostrarla

## Salas y desconexiones
- El id de sala son 4 caracteres hexadecimales
- Máximo 2 jugadores por sala
- Si alguien se desconecta, la partida queda en pausa y la otra persona recibe el
  aviso. Hay un minuto de gracia para reconectar antes de que la sala se elimine
- Las salas sin nadie conectado se limpian a la media hora
- **Sólo se puede pedir revancha con la partida terminada**, para que nadie pueda
  reiniciar un tablero en curso

## Animaciones
- **Flip**: al revelar un intento, las celdas rotan en Y mostrando el color
- **Shake**: al intentar confirmar una palabra inválida
- **Pop**: pequeño escalado al tipear cada letra
- **Festejo**: al ganar se llama a `festejar()` de `/shared/celebracion.js`
- Todas con `@keyframes` CSS, sin librerías

## Eventos de Socket.io

**Cliente → Servidor**

| Evento | Datos | Qué hace |
|---|---|---|
| `crear-sala` | `{ juegoId, modoId }` | Crea la sala y devuelve el link |
| `unirse-sala` | `{ salaId }` | Se suma a una sala existente |
| `enviar-intento` | `{ salaId, intento }` | Confirma una palabra |
| `tipeo` | `{ salaId, letras }` | Comparte lo que se está escribiendo |
| `reiniciar-sala` | `{ salaId }` | Revancha, sólo si la partida terminó |
| `cerrar-sala` | `{ salaId }` | Cierra la sala al volver al hub |

**Servidor → Cliente**

| Evento | Cuándo |
|---|---|
| `sala-creada` | Al crear, con el link |
| `partida-iniciada` | Cuando hay dos personas conectadas |
| `intento-registrado` | Tras cada intento, con los colores y el turno nuevo |
| `oponente-tipeando` | Mientras la otra persona escribe |
| `partida-terminada` | Al ganar o agotar los intentos, con la palabra |
| `jugador-desconectado` | Cuando alguien se cae |
| `sala-cerrada` | Cuando alguien cierra la sala |
| `error-sala` | Ante cualquier error, con el mensaje |
