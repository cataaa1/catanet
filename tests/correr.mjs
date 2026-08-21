// Corre todas las pruebas del proyecto y resume el resultado.
//
// Cada prueba va en su propio proceso porque varias montan un DOM falso sobre
// globalThis, y aisladas no se pisan entre si. Se les pasa un puerto distinto
// para que las que levantan el servidor no choquen.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { leerResultados } from './ayudas/reportar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PUERTO_BASE = 3600;

const soloEsta = process.argv[2];
const pruebas = fs.readdirSync(AQUI)
  .filter((archivo) => archivo.endsWith('.prueba.mjs'))
  .filter((archivo) => !soloEsta || archivo.includes(soloEsta))
  .sort();

if (!pruebas.length) {
  console.error(soloEsta ? `Ninguna prueba coincide con "${soloEsta}"` : 'No hay pruebas.');
  process.exit(1);
}

/**
 * Corre una prueba en su propio proceso.
 *
 * No espera a que el proceso termine solo: varios juegos dejan un cronometro
 * andando y nunca cierran. En cuanto la prueba imprime su resultado, se la da
 * por terminada y se la cierra. El limite de tiempo es la red de seguridad por
 * si una prueba se cuelga antes de informar.
 */
function correr(archivo, puerto, limiteMs = 120000) {
  return new Promise((resolver) => {
    const proceso = spawn(process.execPath, [path.join(AQUI, archivo)], {
      cwd: path.resolve(AQUI, '..'),
      env: { ...process.env, PUERTO_PRUEBA: String(puerto) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let salida = '';
    let terminado = false;

    const terminar = (codigo) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(limite);
      proceso.kill();
      resolver({ salida, codigo });
    };

    const limite = setTimeout(() => terminar('agotó el tiempo'), limiteMs);

    const revisar = (dato) => {
      salida += dato;
      if (salida.includes('RESULTADO_PRUEBA:')) terminar(0);
    };

    proceso.stdout.on('data', revisar);
    proceso.stderr.on('data', revisar);
    proceso.on('close', (codigo) => terminar(codigo));
  });
}

const inicio = Date.now();
let totalOk = 0;
let totalFallas = 0;
const rotas = [];

for (const [indice, archivo] of pruebas.entries()) {
  process.stdout.write(`${archivo.replace('.prueba.mjs', '').padEnd(28)}`);

  const { salida, codigo } = await correr(archivo, PUERTO_BASE + indice);
  const resultados = leerResultados(salida);

  if (!resultados) {
    rotas.push({ archivo, salida });
    console.log('NO PUDO CORRER');
    continue;
  }

  const fallas = resultados.filter((resultado) => !resultado.ok);

  totalOk += resultados.length - fallas.length;
  totalFallas += fallas.length;

  console.log(`${resultados.length - fallas.length}/${resultados.length}${codigo ? '  (' + codigo + ')' : ''}`);
  fallas.forEach((falla) => {
    console.log(`    FALLA ${falla.nombre}${falla.detalle ? '  [' + falla.detalle + ']' : ''}`);
  });
}

console.log('');
console.log(`${totalOk}/${totalOk + totalFallas} chequeos pasaron en ${((Date.now() - inicio) / 1000).toFixed(0)}s`);

rotas.forEach((rota) => {
  console.log(`\n--- ${rota.archivo} no dio resultados ---`);
  console.log(rota.salida.slice(-1200));
});

process.exit(totalFallas || rotas.length ? 1 : 0);
