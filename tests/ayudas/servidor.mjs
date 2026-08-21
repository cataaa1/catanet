// Levanta el servidor real en un puerto suelto y conecta clientes de Socket.io.
// Las pruebas online no valen mucho contra un mock: lo que interesa es que el
// servidor de verdad acepte los eventos y conteste lo que corresponde.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import { BACKEND, ruta } from './rutas.mjs';

const require = createRequire(ruta('backend', 'package.json'));
const { io } = require('socket.io-client');

export async function levantarServidor(puerto) {
  const proceso = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: String(puerto) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let salida = '';

  proceso.stdout.on('data', (dato) => { salida += dato; });
  proceso.stderr.on('data', (dato) => { salida += dato; });

  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(
      () => rechazar(new Error('El servidor no arranco:\n' + salida)),
      30000
    );
    const revisar = setInterval(() => {
      if (salida.includes('escuchando')) {
        clearInterval(revisar);
        clearTimeout(limite);
        resolver();
      }
    }, 100);
  });

  return {
    url: `http://localhost:${puerto}`,
    obtenerSalida: () => salida,
    apagar: () => proceso.kill()
  };
}

export function conectar(url) {
  return new Promise((resolver) => {
    const socket = io(url, { transports: ['websocket'] });

    socket.on('connect', () => resolver(socket));
  });
}

/** Espera un evento del socket, o falla si no llega en el tiempo dado. */
export function esperarEvento(socket, evento, ms = 8000) {
  return new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => rechazar(new Error('no llego ' + evento)), ms);

    socket.once(evento, (datos) => {
      clearTimeout(limite);
      resolver(datos);
    });
  });
}

export function dormir(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
