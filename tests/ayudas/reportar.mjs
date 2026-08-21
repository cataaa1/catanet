// Cada prueba corre en su propio proceso: varias ensucian globalThis con un DOM
// falso, y aisladas no se pisan entre si. Se comunican con el corredor
// imprimiendo una linea JSON al final.

const MARCA = 'RESULTADO_PRUEBA:';

export function crearReporte() {
  const resultados = [];

  return {
    resultados,
    chequear: (nombre, condicion, detalle = '') => {
      resultados.push({ nombre, ok: Boolean(condicion), detalle });
    }
  };
}

/** Imprime el detalle legible y la linea que lee el corredor. */
export function informar(resultados) {
  resultados.forEach((resultado) => {
    const marca = resultado.ok ? 'OK   ' : 'FALLA';
    const detalle = resultado.detalle ? `  [${resultado.detalle}]` : '';

    console.log(`${marca} ${resultado.nombre}${detalle}`);
  });

  console.log(MARCA + JSON.stringify(resultados));
}

export function leerResultados(salida) {
  const linea = salida.split('\n').find((l) => l.startsWith(MARCA));

  return linea ? JSON.parse(linea.slice(MARCA.length)) : null;
}
