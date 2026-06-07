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
    estado: 'proximamente',
    accion: 'Disponible pronto',
    icono: '/hub/assets/logo-sudoku.png'
  },
  {
    id: 'ajedrez',
    titulo: 'Ajedrez',
    descripcion: 'Partidas rapidas, salas privadas y modos contra computadora para practicar jugadas.',
    ruta: '/ajedrez/',
    estado: 'proximamente',
    accion: 'Disponible pronto',
    icono: '/hub/assets/logo-ajedrez.png'
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

export function obtenerFamilia(familiaId) {
  return familias.find((familia) => familia.id === familiaId) || null;
}

export function obtenerModosPorFamilia(familiaId) {
  return modos.filter((modo) => modo.familiaId === familiaId);
}

export function estaDisponible(item) {
  return item.estado === 'en-vivo';
}
