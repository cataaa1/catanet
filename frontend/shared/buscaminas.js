// Motor del Buscaminas, compartido entre el modo individual (corre en el
// navegador) y los modos online (corre en el servidor). No toca el DOM.
//
// A diferencia de sudoku.js, este motor muta el estado en vez de devolver copias:
// una cascada puede tocar cientos de celdas y clonar el tablero en cada revelado
// no tiene sentido. Las funciones devuelven que cambio, no el tablero entero.

const VECINDARIO = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

export const DIFICULTADES_BUSCAMINAS = [
  {
    id: 'facil',
    etiqueta: 'Facil',
    filas: 9,
    columnas: 9,
    minas: 10,
    descripcion: 'Grilla chica para entrar en calor y aprender a leer los numeros.'
  },
  {
    id: 'medio',
    etiqueta: 'Medio',
    filas: 16,
    columnas: 16,
    minas: 40,
    descripcion: 'El tamano clasico: mas espacio y bastante mas densidad de minas.'
  },
  {
    id: 'dificil',
    etiqueta: 'Dificil',
    filas: 16,
    columnas: 30,
    minas: 99,
    descripcion: 'Tablero ancho y una de cada cinco celdas escondiendo una mina.'
  }
];

const DIFICULTADES_POR_ID = new Map(
  DIFICULTADES_BUSCAMINAS.map((dificultad) => [dificultad.id, dificultad])
);

export function obtenerDificultadBuscaminas(dificultadId) {
  return DIFICULTADES_POR_ID.get(dificultadId) || DIFICULTADES_POR_ID.get('facil');
}

/**
 * Crea una partida vacia. Las minas todavia no existen: se colocan en el primer
 * revelado para poder garantizar que esa celda sea segura.
 */
export function crearPartidaBuscaminas(dificultadId = 'facil') {
  const dificultad = obtenerDificultadBuscaminas(dificultadId);

  return {
    dificultad: dificultad.id,
    filas: dificultad.filas,
    columnas: dificultad.columnas,
    minas: dificultad.minas,
    tablero: crearTablero(dificultad.filas, dificultad.columnas),
    minasColocadas: false,
    fase: 'jugando',
    celdasReveladas: 0,
    banderas: 0,
    celdaExplotada: null
  };
}

export function crearTableroVacio(filas, columnas) {
  return crearTablero(filas, columnas);
}

/**
 * Coloca las minas en posiciones ya conocidas, en vez de sortearlas. Sirve para
 * clonar un tablero: en el modo versus las dos personas tienen que recibir
 * exactamente el mismo, y con esto se siembra el segundo igual que el primero.
 * @param {Array<{fila: number, columna: number}>} posiciones
 */
export function sembrarMinas(estado, posiciones) {
  if (estado.minasColocadas) {
    throw new Error('Ese tablero ya tiene las minas colocadas.');
  }

  posiciones.forEach(({ fila, columna }) => {
    if (!estaDentro(estado, fila, columna)) {
      throw new Error(`La mina ${fila},${columna} cae fuera del tablero.`);
    }

    estado.tablero[fila][columna].mina = true;
  });

  contarAdyacentes(estado);
  estado.minas = posiciones.length;
  estado.minasColocadas = true;

  return estado;
}

/**
 * Elige por donde conviene abrir el tablero en los modos online.
 *
 * Busca la celda en cero cuya cascada destape la menor cantidad de celdas: da
 * un punto de apoyo para empezar a deducir sin regalar medio tablero. Abrir en
 * una celda al azar puede destapar el 90% de un tablero facil.
 *
 * Si no hay ninguna celda en cero (tableros muy densos), devuelve cualquier
 * celda sin mina, que destapa una sola.
 */
export function elegirAperturaMinima(estado) {
  const visitadas = new Set();
  let mejor = null;

  for (let fila = 0; fila < estado.filas; fila += 1) {
    for (let columna = 0; columna < estado.columnas; columna += 1) {
      const celda = estado.tablero[fila][columna];

      if (celda.mina || celda.adyacentes !== 0 || visitadas.has(crearClave(fila, columna))) {
        continue;
      }

      const region = medirRegionVacia(estado, fila, columna, visitadas);

      if (!mejor || region.destapadas < mejor.destapadas) {
        mejor = { fila, columna, destapadas: region.destapadas };
      }
    }
  }

  if (mejor) {
    return { fila: mejor.fila, columna: mejor.columna, destapadas: mejor.destapadas };
  }

  for (let fila = 0; fila < estado.filas; fila += 1) {
    for (let columna = 0; columna < estado.columnas; columna += 1) {
      if (!estado.tablero[fila][columna].mina) {
        return { fila, columna, destapadas: 1 };
      }
    }
  }

  return null;
}

// Cuenta cuantas celdas destaparia la cascada desde esta celda vacia: las celdas
// en cero conectadas mas el borde de numeros que las rodea.
function medirRegionVacia(estado, filaInicial, columnaInicial, visitadas) {
  const pendientes = [[filaInicial, columnaInicial]];
  const destapadas = new Set();

  while (pendientes.length) {
    const [fila, columna] = pendientes.pop();
    const clave = crearClave(fila, columna);
    const celda = estado.tablero[fila] && estado.tablero[fila][columna];

    if (!celda || celda.mina || destapadas.has(clave)) {
      continue;
    }

    destapadas.add(clave);

    if (celda.adyacentes !== 0) {
      continue;
    }

    visitadas.add(clave);

    for (const [df, dc] of VECINDARIO) {
      if (estaDentro(estado, fila + df, columna + dc)) {
        pendientes.push([fila + df, columna + dc]);
      }
    }
  }

  return { destapadas: destapadas.size };
}

/**
 * Revela una celda. Si es la primera del tablero, antes coloca las minas
 * dejandola segura a ella y a sus vecinas.
 * @returns {{celdas: Array, exploto: boolean, gano: boolean}} las celdas que
 *   quedaron reveladas, cada una con `{ fila, columna, adyacentes, mina }`.
 */
export function revelarCelda(estado, fila, columna) {
  const vacio = { celdas: [], exploto: false, gano: false };

  if (estado.fase !== 'jugando' || !estaDentro(estado, fila, columna)) {
    return vacio;
  }

  const celda = estado.tablero[fila][columna];

  if (celda.revelada || celda.bandera) {
    return vacio;
  }

  if (!estado.minasColocadas) {
    colocarMinas(estado, fila, columna);
  }

  if (celda.mina) {
    celda.revelada = true;
    estado.fase = 'perdido';
    estado.celdaExplotada = { fila, columna };

    return {
      celdas: [describirCelda(estado, fila, columna)],
      exploto: true,
      gano: false
    };
  }

  const celdas = revelarEnCascada(estado, fila, columna);
  const gano = revisarVictoria(estado);

  return { celdas, exploto: false, gano };
}

/**
 * Click sobre un numero que ya tiene todas sus banderas puestas: revela las
 * vecinas que no estan marcadas. Si alguna bandera estaba mal, se pierde.
 */
export function revelarVecinos(estado, fila, columna) {
  const vacio = { celdas: [], exploto: false, gano: false };

  if (estado.fase !== 'jugando' || !estaDentro(estado, fila, columna)) {
    return vacio;
  }

  const celda = estado.tablero[fila][columna];

  if (!celda.revelada || !celda.adyacentes) {
    return vacio;
  }

  if (contarBanderasVecinas(estado, fila, columna) !== celda.adyacentes) {
    return vacio;
  }

  const celdas = [];
  let exploto = false;

  for (const [df, dc] of VECINDARIO) {
    const vecina = estado.tablero[fila + df] && estado.tablero[fila + df][columna + dc];

    if (!vecina || vecina.revelada || vecina.bandera) {
      continue;
    }

    const resultado = revelarCelda(estado, fila + df, columna + dc);

    celdas.push(...resultado.celdas);

    if (resultado.exploto) {
      exploto = true;
      break;
    }
  }

  return { celdas, exploto, gano: !exploto && revisarVictoria(estado) };
}

/**
 * Pone o saca una bandera.
 * @returns {{cambio: boolean, puesta: boolean}}
 */
export function alternarBandera(estado, fila, columna) {
  if (estado.fase !== 'jugando' || !estaDentro(estado, fila, columna)) {
    return { cambio: false, puesta: false };
  }

  const celda = estado.tablero[fila][columna];

  if (celda.revelada) {
    return { cambio: false, puesta: false };
  }

  celda.bandera = !celda.bandera;
  estado.banderas += celda.bandera ? 1 : -1;

  return { cambio: true, puesta: celda.bandera };
}

/** Minas que faltan marcar segun las banderas puestas. Puede dar negativo. */
export function contarMinasRestantes(estado) {
  return estado.minas - estado.banderas;
}

/** Posiciones de todas las minas. Solo para dibujar el tablero al terminar. */
export function obtenerMinas(estado) {
  const minas = [];

  recorrer(estado, (celda, fila, columna) => {
    if (celda.mina) {
      minas.push({ fila, columna });
    }
  });

  return minas;
}

/**
 * Vista del tablero sin informacion secreta, para mandarle al cliente en los
 * modos online: solo lo revelado y donde hay banderas.
 */
export function obtenerVistaPublica(estado) {
  const celdas = [];

  recorrer(estado, (celda, fila, columna) => {
    if (celda.revelada) {
      celdas.push({ fila, columna, adyacentes: celda.adyacentes, mina: celda.mina });
    } else if (celda.bandera) {
      celdas.push({ fila, columna, bandera: true });
    }
  });

  return {
    dificultad: estado.dificultad,
    filas: estado.filas,
    columnas: estado.columnas,
    minas: estado.minas,
    fase: estado.fase,
    celdasReveladas: estado.celdasReveladas,
    minasRestantes: contarMinasRestantes(estado),
    celdas
  };
}

function crearTablero(filas, columnas) {
  return Array.from({ length: filas }, () => (
    Array.from({ length: columnas }, () => ({
      mina: false,
      adyacentes: 0,
      revelada: false,
      bandera: false
    }))
  ));
}

// Sortea las minas dejando libre la celda del primer click y sus ocho vecinas,
// para que ese click siempre abra un area en vez de terminar la partida.
function colocarMinas(estado, filaSegura, columnaSegura) {
  const seguras = new Set([crearClave(filaSegura, columnaSegura)]);
  const total = estado.filas * estado.columnas;

  // Solo protegemos el vecindario si despues siguen entrando todas las minas
  if (total - 9 >= estado.minas) {
    for (const [df, dc] of VECINDARIO) {
      if (estaDentro(estado, filaSegura + df, columnaSegura + dc)) {
        seguras.add(crearClave(filaSegura + df, columnaSegura + dc));
      }
    }
  }

  const disponibles = [];

  recorrer(estado, (_celda, fila, columna) => {
    if (!seguras.has(crearClave(fila, columna))) {
      disponibles.push({ fila, columna });
    }
  });

  // Fisher-Yates parcial: alcanza con desordenar las primeras `minas` posiciones
  for (let indice = 0; indice < estado.minas && indice < disponibles.length; indice += 1) {
    const salto = indice + Math.floor(Math.random() * (disponibles.length - indice));
    const guardada = disponibles[indice];

    disponibles[indice] = disponibles[salto];
    disponibles[salto] = guardada;

    estado.tablero[disponibles[indice].fila][disponibles[indice].columna].mina = true;
  }

  contarAdyacentes(estado);
  estado.minasColocadas = true;
}

function contarAdyacentes(estado) {
  recorrer(estado, (celda, fila, columna) => {
    if (celda.mina) {
      celda.adyacentes = 0;
      return;
    }

    let total = 0;

    for (const [df, dc] of VECINDARIO) {
      const vecina = estado.tablero[fila + df] && estado.tablero[fila + df][columna + dc];

      if (vecina && vecina.mina) {
        total += 1;
      }
    }

    celda.adyacentes = total;
  });
}

// Cascada iterativa (con pila propia) en vez de recursiva: en la grilla dificil
// una sola apertura puede encadenar cientos de celdas.
function revelarEnCascada(estado, filaInicial, columnaInicial) {
  const pendientes = [[filaInicial, columnaInicial]];
  const celdas = [];

  while (pendientes.length) {
    const [fila, columna] = pendientes.pop();
    const celda = estado.tablero[fila] && estado.tablero[fila][columna];

    if (!celda || celda.revelada || celda.bandera || celda.mina) {
      continue;
    }

    celda.revelada = true;
    estado.celdasReveladas += 1;
    celdas.push(describirCelda(estado, fila, columna));

    if (celda.adyacentes !== 0) {
      continue;
    }

    for (const [df, dc] of VECINDARIO) {
      if (estaDentro(estado, fila + df, columna + dc)) {
        pendientes.push([fila + df, columna + dc]);
      }
    }
  }

  return celdas;
}

function revisarVictoria(estado) {
  if (estado.fase !== 'jugando') {
    return false;
  }

  const sinMinas = (estado.filas * estado.columnas) - estado.minas;

  if (estado.celdasReveladas < sinMinas) {
    return false;
  }

  estado.fase = 'ganado';

  return true;
}

function contarBanderasVecinas(estado, fila, columna) {
  let total = 0;

  for (const [df, dc] of VECINDARIO) {
    const vecina = estado.tablero[fila + df] && estado.tablero[fila + df][columna + dc];

    if (vecina && vecina.bandera) {
      total += 1;
    }
  }

  return total;
}

function describirCelda(estado, fila, columna) {
  const celda = estado.tablero[fila][columna];

  return {
    fila,
    columna,
    adyacentes: celda.adyacentes,
    mina: celda.mina
  };
}

function recorrer(estado, accion) {
  for (let fila = 0; fila < estado.filas; fila += 1) {
    for (let columna = 0; columna < estado.columnas; columna += 1) {
      accion(estado.tablero[fila][columna], fila, columna);
    }
  }
}

function estaDentro(estado, fila, columna) {
  return fila >= 0 && fila < estado.filas && columna >= 0 && columna < estado.columnas;
}

function crearClave(fila, columna) {
  return `${fila}-${columna}`;
}
