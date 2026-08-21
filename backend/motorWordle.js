// Puente al motor del Wordle, que vive en frontend/shared para que lo compartan
// el navegador y el servidor. Como aquel es un modulo ES y esto es CommonJS, se
// carga con import() dinamico antes de escuchar conexiones, igual que el motor
// del Buscaminas y el del Sudoku.
let motor = null;

async function cargarMotorWordle() {
  if (!motor) {
    motor = await import('../frontend/shared/wordle.js');
  }

  return motor;
}

function exigirMotor() {
  if (!motor) {
    throw new Error('El motor del Wordle todavia no esta cargado.');
  }

  return motor;
}

function calcularColores(palabraSecreta, intento) {
  return exigirMotor().calcularColores(palabraSecreta, intento);
}

function esIntentoValido(intento, largo) {
  return exigirMotor().esIntentoValido(intento, largo);
}

function normalizarLetrasParciales(texto, largo) {
  return exigirMotor().normalizarLetrasParciales(texto, largo);
}

module.exports = {
  cargarMotorWordle,
  calcularColores,
  esIntentoValido,
  normalizarLetrasParciales
};
