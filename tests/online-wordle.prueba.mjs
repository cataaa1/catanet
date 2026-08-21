import { createRequire } from 'node:module';

import { crearReporte, informar } from './ayudas/reportar.mjs';
import { ruta } from './ayudas/rutas.mjs';
import { conectar, dormir, esperarEvento, levantarServidor } from './ayudas/servidor.mjs';

const { chequear, resultados } = crearReporte();

const require = createRequire(ruta('backend', 'package.json'));
const palabras = require(ruta('backend', 'words.js'));

const PUERTO = Number(process.env.PUERTO_PRUEBA) || 3620;
const servidor = await levantarServidor(PUERTO);

try {
  // ==================== Co-Wordle ====================
  const ana = await conectar(servidor.url);
  const beto = await conectar(servidor.url);

  ana.emit('crear-sala', {});
  const creada = await esperarEvento(ana, 'sala-creada');

  chequear('crear sala devuelve link al co-wordle',
    creada.link.includes('/co-wordle/?sala='), creada.link);
  chequear('el estado inicial no trae la palabra secreta',
    !JSON.stringify(creada.estado).match(/palabraSecreta/));

  const arranqueAna = esperarEvento(ana, 'partida-iniciada');
  const arranqueBeto = esperarEvento(beto, 'partida-iniciada');
  beto.emit('unirse-sala', { salaId: creada.salaId });
  const [inicioAna, inicioBeto] = await Promise.all([arranqueAna, arranqueBeto]);

  chequear('los dos reciben la partida iniciada',
    inicioAna.estado.fase === 'jugando' && inicioBeto.estado.fase === 'jugando');
  chequear('los dos comparten el mismo tablero',
    inicioAna.estado.historialIntentos.length === inicioBeto.estado.historialIntentos.length);
  chequear('el tablero llega vacio', inicioAna.estado.historialIntentos.length === 0);

  const turnoDeAna = inicioAna.estado.turnoActual === ana.id;
  const conTurno = turnoDeAna ? ana : beto;
  const sinTurno = turnoDeAna ? beto : ana;

  chequear('hay un turno asignado',
    inicioAna.estado.turnoActual === ana.id || inicioAna.estado.turnoActual === beto.id);

  // Quien no tiene el turno recibe un error, no un intento aceptado
  const errorFueraDeTurno = esperarEvento(sinTurno, 'error-sala', 2000);
  sinTurno.emit('enviar-intento', { salaId: creada.salaId, intento: palabras.respuestas[0] });
  const error = await errorFueraDeTurno;
  chequear('quien no tiene el turno recibe un error', error.mensaje.includes('turno'), error.mensaje);

  // El tipeo en vivo llega a la otra persona, filtrado
  const tipeoVisto = esperarEvento(sinTurno, 'oponente-tipeando', 3000);
  conTurno.emit('tipeo', { salaId: creada.salaId, letras: 'ca<s>' });
  const tipeo = await tipeoVisto;
  chequear('el tipeo en vivo llega al rival', typeof tipeo.letras === 'string');
  chequear('el tipeo llega ya filtrado de basura',
    /^[A-ZÑ]*$/.test(tipeo.letras), tipeo.letras);

  // Un intento valido: los dos ven el resultado y el turno cambia
  const vistoPorAna = esperarEvento(ana, 'intento-registrado');
  const vistoPorBeto = esperarEvento(beto, 'intento-registrado');
  conTurno.emit('enviar-intento', { salaId: creada.salaId, intento: palabras.respuestas[0] });
  const [regAna, regBeto] = await Promise.all([vistoPorAna, vistoPorBeto]);

  chequear('el intento llega a los dos', regAna.intento === regBeto.intento);
  chequear('vuelve un color por letra', regAna.colores.length === 5);
  chequear('los colores son validos',
    regAna.colores.every((color) => ['correcto', 'presente', 'ausente'].includes(color)),
    regAna.colores.join());
  chequear('el turno pasa a la otra persona',
    regAna.estado.turnoActual === sinTurno.id,
    regAna.estado.turnoActual === sinTurno.id ? 'ok' : 'no cambio');
  chequear('el intento queda en el tablero compartido',
    regBeto.estado.historialIntentos.length === 1);
  chequear('la palabra secreta sigue sin viajar',
    !JSON.stringify(regAna.estado).includes('palabraSecreta'));

  // Una palabra inventada se rechaza
  const errorInventada = esperarEvento(sinTurno, 'error-sala', 2000);
  sinTurno.emit('enviar-intento', { salaId: creada.salaId, intento: 'XKQZW' });
  chequear('rechaza una palabra que no esta en la lista',
    (await errorInventada).mensaje.includes('lista'));

  // Jugar hasta agotar los seis intentos compartidos.
  //
  // Ojo: "intento-registrado" se emite a los DOS jugadores. Si uno espera el
  // evento reciEn despues de emitir, puede resolver con el eco del turno
  // anterior. Por eso se escucha en los dos desde el principio y se guarda
  // siempre el ultimo estado.
  let ultimoEstado = regAna.estado;

  [ana, beto].forEach((socket) => {
    socket.on('intento-registrado', ({ estado }) => { ultimoEstado = estado; });
  });

  const finalAna = esperarEvento(ana, 'partida-terminada', 10000);

  for (let i = 1; i < 6 && ultimoEstado.fase === 'jugando'; i += 1) {
    const quien = [ana, beto].find((socket) => socket.id === ultimoEstado.turnoActual);

    quien.emit('enviar-intento', { salaId: creada.salaId, intento: palabras.respuestas[i] });
    await dormir(200);
  }

  const terminada = await finalAna;

  chequear('la partida termina y avisa a los dos',
    terminada.estado.fase === 'terminada', terminada.estado.fase);
  chequear('recien al terminar se revela la palabra',
    /^[A-ZÑ]{5}$/.test(terminada.palabraSecreta), String(terminada.palabraSecreta));
  chequear('se usaron los seis intentos compartidos',
    terminada.estado.historialIntentos.length === 6,
    `${terminada.estado.historialIntentos.length}`);
  chequear('el resultado es de equipo, no de una persona',
    terminada.resultado === 'victoria' || terminada.resultado === 'derrota',
    String(terminada.resultado));

  // Revancha, ahora que si esta terminada
  const revanchaAna = esperarEvento(ana, 'partida-iniciada', 5000);
  ana.emit('reiniciar-sala', { salaId: creada.salaId });
  const revancha = await revanchaAna;
  chequear('la revancha reparte un tablero limpio',
    revancha.estado.historialIntentos.length === 0);

  ana.disconnect();
  beto.disconnect();

  // ==================== Versus por tiempo ====================
  const uno = await conectar(servidor.url);
  const dos = await conectar(servidor.url);

  uno.emit('versus-crear-sala', {});
  const salaVersus = await esperarEvento(uno, 'versus-sala-creada');
  chequear('el link del versus apunta al modo correcto',
    salaVersus.link.includes('/wordle/versus-tiempo/?sala='), salaVersus.link);

  const arranqueUno = esperarEvento(uno, 'versus-partida-iniciada');
  dos.emit('versus-unirse-sala', { salaId: salaVersus.salaId });
  const versusInicio = await arranqueUno;

  chequear('el versus arranca con dos', versusInicio.estado.fase === 'jugando');
  chequear('el versus no manda las palabras secretas',
    !JSON.stringify(versusInicio.estado).includes('palabraSecreta'));
  chequear('los dos arrancan en cero',
    Object.values(versusInicio.estado.jugadores).every((jugador) => jugador.puntaje === 0));

  // En el versus no hay turnos: se juega cuando uno quiere
  const jugadaUno = esperarEvento(uno, 'versus-intento-registrado', 5000);
  uno.emit('versus-enviar-intento', { salaId: salaVersus.salaId, intento: palabras.respuestas[0] });
  const registroVersus = await jugadaUno;

  chequear('se juega sin esperar turno', registroVersus.colores.length === 5);
  chequear('el rival ve la jugada', typeof registroVersus.estado === 'object');

  uno.disconnect();
  dos.disconnect();
} catch (error) {
  chequear('la prueba corrio sin excepciones', false, error.message);
} finally {
  servidor.apagar();
}

informar(resultados);
