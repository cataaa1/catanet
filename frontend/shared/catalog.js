export const familias = [
  {
    id: 'wordle',
    titulo: 'Wordle',
    descripcion: 'Palabras de cinco letras en versiones para jugar solo, en equipo o contra otra persona.',
    ruta: '/wordle/',
    estado: 'en-vivo',
    accion: 'Jugar',
    icono: '/hub/assets/logo-wordle.png'
  },
  {
    id: 'sudoku',
    titulo: 'Sudoku',
    descripcion: 'Tableros logicos para resolver en solitario, en colaboracion o con desafios por tiempo.',
    ruta: '/sudoku/',
    estado: 'en-vivo',
    accion: 'Jugar',
    icono: '/hub/assets/logo-sudoku.png'
  },
  {
    id: 'buscaminas',
    titulo: 'Buscaminas',
    descripcion: 'Tableros con minas escondidas para despejar deduciendo, solo, en equipo o contra otra persona.',
    ruta: '/buscaminas/',
    estado: 'en-vivo',
    accion: 'Jugar',
    icono: '/hub/assets/logo-buscaminas.png'
  }
];

export const modos = [
  {
    id: 'co-wordle-turnos',
    familiaId: 'wordle',
    titulo: 'Co-Wordle por turnos',
    descripcion: 'Dos personas comparten seis intentos y alternan jugadas para descubrir la misma palabra.',
    ruta: '/co-wordle/',
    estado: 'en-vivo',
    accion: 'Crear partida',
    tipo: 'coop',
    jugadores: '2 jugadores',
    online: true,
    icono: '/hub/assets/logo-wordle.png'
  },
  {
    id: 'sudoku-individual',
    familiaId: 'sudoku',
    titulo: 'Sudoku individual',
    descripcion: 'Elige dificultad y completa un tablero clasico de 9x9 a tu ritmo desde cualquier dispositivo.',
    ruta: '/sudoku/individual/',
    estado: 'en-vivo',
    accion: 'Resolver',
    tipo: 'solo',
    jugadores: '1 jugador',
    online: false,
    icono: '/hub/assets/logo-sudoku.png'
  },
  {
    id: 'sudoku-diario',
    familiaId: 'sudoku',
    titulo: 'Sudoku diario',
    descripcion: 'Un tablero experto por dia, el mismo para todo el mundo. Sin pistas, para poder comparar tiempos.',
    ruta: '/sudoku/diario/',
    estado: 'en-vivo',
    accion: 'Jugar el de hoy',
    tipo: 'solo',
    jugadores: '1 jugador',
    online: false,
    icono: '/hub/assets/logo-sudoku.png'
  },
  {
    id: 'sudoku-carrera',
    familiaId: 'sudoku',
    titulo: 'Carrera de Sudoku',
    descripcion: 'Hasta seis personas con el mismo tablero: gana quien lo resuelve primero, sin limite de tiempo.',
    ruta: '/sudoku/carrera/',
    estado: 'en-vivo',
    accion: 'Correr',
    tipo: 'versus',
    jugadores: '2 a 6 jugadores',
    online: true,
    icono: '/hub/assets/logo-sudoku.png'
  },
  {
    id: 'buscaminas-individual',
    familiaId: 'buscaminas',
    titulo: 'Buscaminas individual',
    descripcion: 'Tres dificultades clasicas, con banderas, cronometro y el primer click siempre seguro.',
    ruta: '/buscaminas/individual/',
    estado: 'en-vivo',
    accion: 'Jugar',
    tipo: 'solo',
    jugadores: '1 jugador',
    online: false,
    icono: '/hub/assets/logo-buscaminas.png'
  },
  {
    id: 'buscaminas-cooperativo',
    familiaId: 'buscaminas',
    titulo: 'Buscaminas cooperativo',
    descripcion: 'Varias personas sobre un mismo tablero en tiempo real. Una sola mina termina la partida para todo el equipo.',
    ruta: '/buscaminas/cooperativo/',
    estado: 'en-vivo',
    accion: 'Crear sala',
    tipo: 'coop',
    jugadores: '2+ jugadores',
    online: true,
    icono: '/hub/assets/logo-buscaminas.png'
  },
  {
    id: 'buscaminas-versus',
    familiaId: 'buscaminas',
    titulo: 'Buscaminas versus',
    descripcion: 'El mismo tablero para los dos: gana quien despeja primero y pisar una mina es derrota inmediata.',
    ruta: '/buscaminas/versus/',
    estado: 'en-vivo',
    accion: 'Competir',
    tipo: 'versus',
    jugadores: '2 jugadores',
    online: true,
    icono: '/hub/assets/logo-buscaminas.png'
  },
  {
    id: 'wordle-individual',
    familiaId: 'wordle',
    titulo: 'Wordle individual',
    descripcion: 'La experiencia clasica para practicar a tu ritmo con una palabra secreta por partida.',
    ruta: '/wordle/individual/',
    estado: 'en-vivo',
    accion: 'Practicar',
    tipo: 'solo',
    jugadores: '1 jugador',
    online: false,
    icono: '/hub/assets/logo-wordle.png'
  },
  {
    id: 'wordle-versus-tiempo',
    familiaId: 'wordle',
    titulo: 'Versus por tiempo',
    descripcion: 'Dos jugadores compiten durante 90 segundos por completar la mayor cantidad de Wordles.',
    ruta: '/wordle/versus-tiempo/',
    estado: 'en-vivo',
    accion: 'Competir',
    tipo: 'versus',
    jugadores: '2 jugadores',
    online: true,
    icono: '/hub/assets/logo-wordle.png'
  },
  {
    id: 'wordle-custom',
    familiaId: 'wordle',
    titulo: 'Custom Wordle',
    descripcion: 'Crea una palabra personalizada y comparti un link para que otra persona la adivine.',
    ruta: '/wordle/custom/',
    estado: 'en-vivo',
    accion: 'Crear link',
    tipo: 'custom',
    jugadores: '1 creador + 1 jugador',
    online: false,
    icono: '/hub/assets/logo-wordle.png'
  },
];

export function obtenerModosPorFamilia(familiaId) {
  return modos.filter((modo) => modo.familiaId === familiaId);
}

export function estaDisponible(item) {
  return item.estado === 'en-vivo';
}
