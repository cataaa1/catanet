const TAMANIO = 9;
const VACIO = '.';
const DIGITOS_DISPONIBLES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const DIFICULTADES_SUDOKU = [
  {
    id: 'facil',
    etiqueta: 'Facil',
    givens: 40,
    intentos: 8,
    reglas: {
      minSingles: 8,
      minPromedioCandidatos: 2.0,
      maxPromedioCandidatos: 2.8
    },
    descripcion: 'Mas accesible, pero ya con un tablero bastante mas interesante que uno de iniciacion.'
  },
  {
    id: 'medio',
    etiqueta: 'Medio',
    givens: 34,
    intentos: 10,
    reglas: {
      minSingles: 2,
      maxSingles: 6,
      minPromedioCandidatos: 2.7,
      maxPromedioCandidatos: 3.3
    },
    descripcion: 'Menos jugadas obvias al comienzo y mas cruces para deducir.'
  },
  {
    id: 'experto',
    etiqueta: 'Experto',
    givens: 28,
    intentos: 4,
    reglas: {
      maxSingles: 0,
      minPromedioCandidatos: 3.4
    },
    descripcion: 'Sin ninguna jugada obvia de entrada: hay que cruzar datos desde la primera lectura.'
  },
  {
    id: 'dificil',
    etiqueta: 'Dificil',
    givens: 30,
    intentos: 12,
    reglas: {
      maxSingles: 2,
      minPromedioCandidatos: 3.1
    },
    descripcion: 'Pocas entradas directas y bastante menos aire desde la primera lectura.'
  }
];

const DIFICULTADES_POR_ID = new Map(
  DIFICULTADES_SUDOKU.map((dificultad) => [dificultad.id, dificultad])
);

export function obtenerDificultadSudoku(dificultadId) {
  return DIFICULTADES_POR_ID.get(dificultadId) || DIFICULTADES_POR_ID.get('medio');
}

/**
 * Crea una partida.
 * @param {string} dificultadId
 * @param {Object} [opciones]
 * @param {number} [opciones.semilla] Si viene, el tablero es reproducible: la
 *   misma semilla y la misma dificultad devuelven siempre el mismo tablero.
 *   Es lo que hace posible el Sudoku diario y compartir un tablero por link.
 */
export function crearPartidaSudoku(dificultadId = 'medio', opciones = {}) {
  const dificultad = obtenerDificultadSudoku(dificultadId);
  const libreria = obtenerLibreriaSudoku();
  const puzzle = typeof opciones.semilla === 'number'
    ? conAzarSembrado(libreria, opciones.semilla, () => generarPuzzleSegunDificultad(libreria, dificultad))
    : generarPuzzleSegunDificultad(libreria, dificultad);
  const solucion = libreria.solve(puzzle);

  return {
    dificultad: dificultad.id,
    puzzle,
    solucion,
    tableroInicial: stringATablero(puzzle),
    tableroResuelto: stringATablero(solucion)
  };
}

export function stringATablero(boardString) {
  const caracteres = String(boardString || '').split('');

  if (caracteres.length !== TAMANIO * TAMANIO) {
    throw new Error('El tablero de Sudoku debe tener 81 celdas.');
  }

  return Array.from({ length: TAMANIO }, (_, fila) => (
    Array.from({ length: TAMANIO }, (_, columna) => {
      const valor = caracteres[(fila * TAMANIO) + columna];
      return valor === VACIO ? '' : valor;
    })
  ));
}

export function tableroAString(tablero) {
  return tablero
    .flat()
    .map((valor) => (valor ? String(valor) : VACIO))
    .join('');
}

export function clonarTablero(tablero) {
  return tablero.map((fila) => fila.slice());
}

export function esCeldaEditable(tableroInicial, fila, columna) {
  return !tableroInicial[fila][columna];
}

export function normalizarEntradaSudoku(valor) {
  const texto = String(valor || '').trim();
  return /^[1-9]$/.test(texto) ? texto : '';
}

export function actualizarCelda(tablero, fila, columna, valor) {
  const siguiente = clonarTablero(tablero);
  siguiente[fila][columna] = normalizarEntradaSudoku(valor);
  return siguiente;
}

export function contarCeldasLlenas(tablero) {
  return tablero.flat().filter(Boolean).length;
}

export function obtenerConflictos(tablero) {
  const conflictos = new Set();

  for (let fila = 0; fila < TAMANIO; fila += 1) {
    agregarConflictosDeGrupo(conflictos, obtenerCoordenadasFila(fila), tablero);
  }

  for (let columna = 0; columna < TAMANIO; columna += 1) {
    agregarConflictosDeGrupo(conflictos, obtenerCoordenadasColumna(columna), tablero);
  }

  for (let filaBase = 0; filaBase < TAMANIO; filaBase += 3) {
    for (let columnaBase = 0; columnaBase < TAMANIO; columnaBase += 3) {
      agregarConflictosDeGrupo(conflictos, obtenerCoordenadasBloque(filaBase, columnaBase), tablero);
    }
  }

  return conflictos;
}

export function estaSudokuResuelto(tableroActual, tableroResuelto) {
  const actual = tableroAString(tableroActual);

  // Un tablero incompleto nunca cuenta como resuelto, aunque coincida con la solucion
  if (actual.includes(VACIO)) {
    return false;
  }

  return actual === tableroAString(tableroResuelto);
}

export function obtenerRelacionCelda(fila, columna) {
  const relacionadas = new Set();

  obtenerCoordenadasFila(fila).forEach(({ fila: filaActual, columna: columnaActual }) => {
    relacionadas.add(crearIdCelda(filaActual, columnaActual));
  });

  obtenerCoordenadasColumna(columna).forEach(({ fila: filaActual, columna: columnaActual }) => {
    relacionadas.add(crearIdCelda(filaActual, columnaActual));
  });

  obtenerCoordenadasBloque(
    Math.floor(fila / 3) * 3,
    Math.floor(columna / 3) * 3
  ).forEach(({ fila: filaActual, columna: columnaActual }) => {
    relacionadas.add(crearIdCelda(filaActual, columnaActual));
  });

  return relacionadas;
}

export function crearIdCelda(fila, columna) {
  return `${fila}-${columna}`;
}

/** Fecha del dia en Argentina (UTC-3), como 'AAAA-MM-DD'. */
export function obtenerFechaDiaria(momento = new Date()) {
  const enArgentina = new Date(momento.getTime() - (3 * 60 * 60 * 1000));

  return enArgentina.toISOString().slice(0, 10);
}

/** Convierte una fecha 'AAAA-MM-DD' en la semilla del tablero de ese dia. */
export function semillaDeFecha(fecha) {
  let semilla = 2166136261;

  for (let indice = 0; indice < fecha.length; indice += 1) {
    semilla ^= fecha.charCodeAt(indice);
    semilla = Math.imul(semilla, 16777619);
  }

  return semilla >>> 0;
}

/** Cuantas celdas del tablero coinciden con la solucion. Para el ranking. */
export function contarCeldasCorrectas(tableroActual, tableroResuelto) {
  let correctas = 0;

  for (let fila = 0; fila < TAMANIO; fila += 1) {
    for (let columna = 0; columna < TAMANIO; columna += 1) {
      if (tableroActual[fila][columna]
        && tableroActual[fila][columna] === tableroResuelto[fila][columna]) {
        correctas += 1;
      }
    }
  }

  return correctas;
}

// La libreria saca todo su azar de _rand_range, asi que reemplazandola por una
// version con semilla, la generacion entera se vuelve reproducible.
function conAzarSembrado(libreria, semilla, accion) {
  const original = libreria._rand_range;
  const azar = crearAzarConSemilla(semilla);

  libreria._rand_range = function (max, min) {
    const desde = min || 0;

    if (!max) {
      throw new Error('Rango indefinido al generar el Sudoku.');
    }

    return Math.floor(azar() * (max - desde)) + desde;
  };

  try {
    return accion();
  } finally {
    libreria._rand_range = original;
  }
}

// mulberry32: chico, rapido y con buena distribucion para lo que necesitamos
function crearAzarConSemilla(semilla) {
  let estado = semilla >>> 0;

  return function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;

    let valor = estado;

    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);

    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}

function obtenerLibreriaSudoku() {
  const libreria = globalThis.sudoku;

  if (!libreria || typeof libreria.generate !== 'function' || typeof libreria.solve !== 'function') {
    throw new Error('La libreria externa de Sudoku no esta disponible en la pagina.');
  }

  return libreria;
}

function generarPuzzleSegunDificultad(libreria, dificultad) {
  let mejorPuzzle = '';
  let mejorPuntaje = Number.POSITIVE_INFINITY;

  for (let intento = 0; intento < dificultad.intentos; intento += 1) {
    const puzzle = libreria.generate(dificultad.givens);
    const metricas = medirAperturaDelTablero(stringATablero(puzzle));

    if (cumpleReglasDeDificultad(metricas, dificultad.reglas)) {
      return puzzle;
    }

    const puntaje = calcularPuntajeDeCercania(metricas, dificultad.reglas);

    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorPuzzle = puzzle;
    }
  }

  return mejorPuzzle || libreria.generate(dificultad.givens);
}

function agregarConflictosDeGrupo(conflictos, coordenadas, tablero) {
  const posicionesPorValor = new Map();

  coordenadas.forEach(({ fila, columna }) => {
    const valor = tablero[fila][columna];

    if (!valor) {
      return;
    }

    if (!posicionesPorValor.has(valor)) {
      posicionesPorValor.set(valor, []);
    }

    posicionesPorValor.get(valor).push({ fila, columna });
  });

  posicionesPorValor.forEach((posiciones) => {
    if (posiciones.length < 2) {
      return;
    }

    posiciones.forEach(({ fila, columna }) => {
      conflictos.add(crearIdCelda(fila, columna));
    });
  });
}

function medirAperturaDelTablero(tablero) {
  let celdasVacias = 0;
  let singles = 0;
  let sumaCandidatos = 0;

  for (let fila = 0; fila < TAMANIO; fila += 1) {
    for (let columna = 0; columna < TAMANIO; columna += 1) {
      if (tablero[fila][columna]) {
        continue;
      }

      const candidatos = obtenerCandidatosInmediatos(tablero, fila, columna);
      celdasVacias += 1;
      sumaCandidatos += candidatos.length;

      if (candidatos.length === 1) {
        singles += 1;
      }
    }
  }

  return {
    singles,
    promedioCandidatos: celdasVacias ? sumaCandidatos / celdasVacias : 0
  };
}

function obtenerCandidatosInmediatos(tablero, fila, columna) {
  const usados = new Set();

  for (let indice = 0; indice < TAMANIO; indice += 1) {
    if (tablero[fila][indice]) {
      usados.add(tablero[fila][indice]);
    }

    if (tablero[indice][columna]) {
      usados.add(tablero[indice][columna]);
    }
  }

  const filaBase = Math.floor(fila / 3) * 3;
  const columnaBase = Math.floor(columna / 3) * 3;

  for (let filaActual = filaBase; filaActual < filaBase + 3; filaActual += 1) {
    for (let columnaActual = columnaBase; columnaActual < columnaBase + 3; columnaActual += 1) {
      if (tablero[filaActual][columnaActual]) {
        usados.add(tablero[filaActual][columnaActual]);
      }
    }
  }

  return DIGITOS_DISPONIBLES.filter((digito) => !usados.has(digito));
}

function cumpleReglasDeDificultad(metricas, reglas) {
  if (typeof reglas.minSingles === 'number' && metricas.singles < reglas.minSingles) {
    return false;
  }

  if (typeof reglas.maxSingles === 'number' && metricas.singles > reglas.maxSingles) {
    return false;
  }

  if (
    typeof reglas.minPromedioCandidatos === 'number'
    && metricas.promedioCandidatos < reglas.minPromedioCandidatos
  ) {
    return false;
  }

  if (
    typeof reglas.maxPromedioCandidatos === 'number'
    && metricas.promedioCandidatos > reglas.maxPromedioCandidatos
  ) {
    return false;
  }

  return true;
}

function calcularPuntajeDeCercania(metricas, reglas) {
  let puntaje = 0;

  if (typeof reglas.minSingles === 'number' && metricas.singles < reglas.minSingles) {
    puntaje += reglas.minSingles - metricas.singles;
  }

  if (typeof reglas.maxSingles === 'number' && metricas.singles > reglas.maxSingles) {
    puntaje += metricas.singles - reglas.maxSingles;
  }

  if (
    typeof reglas.minPromedioCandidatos === 'number'
    && metricas.promedioCandidatos < reglas.minPromedioCandidatos
  ) {
    puntaje += (reglas.minPromedioCandidatos - metricas.promedioCandidatos) * 3;
  }

  if (
    typeof reglas.maxPromedioCandidatos === 'number'
    && metricas.promedioCandidatos > reglas.maxPromedioCandidatos
  ) {
    puntaje += (metricas.promedioCandidatos - reglas.maxPromedioCandidatos) * 3;
  }

  return puntaje;
}

function obtenerCoordenadasFila(fila) {
  return Array.from({ length: TAMANIO }, (_, columna) => ({ fila, columna }));
}

function obtenerCoordenadasColumna(columna) {
  return Array.from({ length: TAMANIO }, (_, fila) => ({ fila, columna }));
}

function obtenerCoordenadasBloque(filaBase, columnaBase) {
  const coordenadas = [];

  for (let fila = filaBase; fila < filaBase + 3; fila += 1) {
    for (let columna = columnaBase; columna < columnaBase + 3; columna += 1) {
      coordenadas.push({ fila, columna });
    }
  }

  return coordenadas;
}
