const fs = require('fs');
const path = require('path');

const rutaPalabrasFrontend = path.resolve(__dirname, '../frontend/shared/words.js');
const palabrasRespaldo = [
  'ABEJA', 'ABRIL', 'ACTOR', 'AGUDA', 'AGUDO', 'ALTAR', 'AMIGO', 'ANCLA', 'ARBOL', 'ARENA',
  'AVION', 'BAILE', 'BALON', 'BANCO', 'BARCO', 'BEBER', 'BESAR', 'BICHO', 'BOLSA', 'BOTON',
  'CABRA', 'CAMPO', 'CANTO', 'CARNE', 'CARRO', 'CARTA', 'CERCA', 'CERDO', 'CIELO', 'CLAVE',
  'COLOR', 'COMER', 'CORAL', 'CORTE', 'CREMA', 'CRUDO', 'DULCE', 'ECHAR', 'ENOJO', 'ERROR',
  'FERIA', 'FINAL', 'FORMA', 'FUEGO', 'GAFAS', 'GANAR', 'GIRAR', 'GORRO', 'GRAVE', 'GRUPO',
  'HACER', 'HIELO', 'HOGAR', 'JUGAR', 'LIBRO', 'LUGAR', 'MANGO', 'MARCA', 'NUBES', 'PERRO'
];

const { validWords, answerWords } = cargarListas();
const palabrasValidas = new Set(validWords);
const respuestasValidas = new Set(answerWords);

function cargarListas() {
  try {
    const contenido = fs.readFileSync(rutaPalabrasFrontend, 'utf8');
    const validas = extraerArrayExportado(contenido, 'validWords');
    const respuestas = extraerArrayExportado(contenido, 'answerWords');

    return {
      validWords: validas.length ? validas : palabrasRespaldo,
      answerWords: respuestas.length ? respuestas : (validas.length ? validas : palabrasRespaldo)
    };
  } catch (error) {
    console.warn('No se pudo cargar la lista compartida de palabras. Se usa respaldo.', error.message);
    return {
      validWords: palabrasRespaldo,
      answerWords: palabrasRespaldo
    };
  }
}

function extraerArrayExportado(contenido, nombreExport) {
  const coincidenciaArray = contenido.match(new RegExp(`export const ${nombreExport} = \\[([\\s\\S]*?)\\];`));

  if (!coincidenciaArray) {
    return [];
  }

  const palabrasExtraidas = [];
  const patronPalabra = /'([^']+)'/g;
  let coincidencia = patronPalabra.exec(coincidenciaArray[1]);

  while (coincidencia) {
    const palabra = normalizarPalabra(coincidencia[1]);

    if (/^[A-Z\u00D1]{5}$/.test(palabra) && !palabrasExtraidas.includes(palabra)) {
      palabrasExtraidas.push(palabra);
    }

    coincidencia = patronPalabra.exec(coincidenciaArray[1]);
  }

  return palabrasExtraidas;
}

function obtenerPalabraAleatoria() {
  const indiceAleatorio = Math.floor(Math.random() * answerWords.length);
  return answerWords[indiceAleatorio];
}

function esPalabraAceptada(palabra) {
  return palabrasValidas.has(normalizarPalabra(palabra));
}

function esRespuestaPosible(palabra) {
  return respuestasValidas.has(normalizarPalabra(palabra));
}

function normalizarPalabra(palabra) {
  return quitarTildesPreservandoEnie(repararMojibake(String(palabra || '')))
    .trim()
    .toUpperCase();
}

function repararMojibake(texto) {
  if (!texto.includes('Ã')) {
    return texto;
  }

  return Buffer.from(texto, 'latin1').toString('utf8');
}

function quitarTildesPreservandoEnie(texto) {
  return texto
    .replace(/\u00F1/g, '__enie_min__')
    .replace(/\u00D1/g, '__enie_may__')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/__enie_min__/g, '\u00F1')
    .replace(/__enie_may__/g, '\u00D1');
}

module.exports = {
  palabras: validWords,
  palabrasValidas,
  respuestas: answerWords,
  respuestasValidas,
  obtenerPalabraAleatoria,
  esPalabraAceptada,
  esRespuestaPosible,
  normalizarPalabra
};
