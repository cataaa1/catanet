// Reemplazos de los modulos compartidos, para que las pruebas de un juego no
// arrastren el canvas del festejo ni el modal de resultado.

export const festejos = { total: 0 };

export function festejar() {
  festejos.total += 1;
}

export function cortarFestejo() {}

export function habilitarCierreResultado() {}
