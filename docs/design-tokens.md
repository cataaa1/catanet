# Design Tokens — CataNet

## Paleta de colores

```css
:root {
  --mint:     #C5EBC3;   /* verde menta — badges, acentos suaves */
  --sage:     #B7C8B5;   /* verde salvia — bordes de cards */
  --mauve:    #A790A5;   /* malva — textos secundarios */
  --plum:     #875C74;   /* ciruela — botones, acentos fuertes */
  --eggplant: #54414E;   /* berenjena — texto principal */
  --card:     #ffffff;   /* fondo de cards */

  /* Fondo del hub */
  --bg-hub: linear-gradient(135deg, #eef6ec 0%, #ece2ea 100%);

  /* Fondo de los juegos (oscuro para mejor contraste) */
  --bg-game: #1a1a2e;

  /* Colores del juego Wordle */
  --wordle-correcto:  #6aaa64;   /* verde — letra en posición correcta */
  --wordle-presente:  #c9b458;   /* amarillo — letra existe, mal lugar */
  --wordle-ausente:   #787c7e;   /* gris — letra no está */
  --wordle-vacio:     #ffffff;   /* celda vacía */
  --wordle-borde:     #d3d6da;   /* borde celda sin llenar */
}
```

## Tipografía

- **Familia**: Inter (Google Fonts)
- **Pesos**: 400 (regular), 500 (medium) — nunca 600 ni 700
- **Tamaños**:
  - Título principal: `clamp(40px, 6vw, 64px)`
  - Título card: `22px`
  - Cuerpo: `15–17px`
  - Labels / badges: `12–13px`
  - Texto secundario: `13px`

## Componentes reutilizables

### Card de juego
```css
.card {
  background: var(--card);
  border: 1px solid var(--sage);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 4px 14px rgba(84, 65, 78, 0.06);
  transition: transform 0.4s cubic-bezier(.2,.8,.2,1), box-shadow 0.4s ease;
}
.card:hover {
  transform: translateY(-6px) rotate(-0.4deg);
  box-shadow: 0 22px 50px rgba(84, 65, 78, 0.18);
  border-color: var(--plum);
}
```

### Badge "En vivo"
```html
<span class="badge live">
  <span class="live-dot"></span>En vivo
</span>
```
- Fondo: `var(--mint)`, texto: `var(--eggplant)`
- El punto pulsa con animación `pulse` cada 1.6s

### Badge "Próximamente"
```html
<span class="badge soon">Próximamente</span>
```
- Fondo: `#f1eaef`, texto: `var(--plum)`, borde: `#e3d4df`

### Botón primario
```html
<a class="btn" href="...">Jugar <span class="arrow">→</span></a>
```
- Fondo: `linear-gradient(135deg, var(--plum), var(--eggplant))`
- Al hover: la flecha se mueve 4px a la derecha

### Botón "Volver"
```html
<a class="btn-volver" href="../hub/">← Volver</a>
```
- Estilo fantasma: sin fondo, borde `var(--plum)`, texto `var(--plum)`

## Animaciones globales

```css
/* Aparición al cargar */
@keyframes rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Blobs de fondo */
@keyframes float1 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(60px,80px);} }
@keyframes float2 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-70px,-50px);} }
@keyframes float3 { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-40px,60px);} }

/* Formas geométricas */
@keyframes bob {
  0%,100% { transform: translateY(0) rotate(0deg); }
  50%     { transform: translateY(-22px) rotate(15deg); }
}

/* Punto live */
@keyframes pulse {
  0%   { transform: scale(0.6); opacity: 0.6; }
  100% { transform: scale(2.4); opacity: 0; }
}
```

## Fondo del hub (blobs + puntos)

El fondo usa tres blobs con `filter: blur(70px)` y `mix-blend-mode: multiply`,
más un grid de puntos con `radial-gradient` y `mask-image` para que se desvanezca
hacia los bordes. Ver implementación en `frontend/hub/index.html`.

## Responsive

| Breakpoint | Grid de cards |
|---|---|
| `> 900px` | 3 columnas |
| `540px – 900px` | 2 columnas |
| `< 540px` | 1 columna |

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
```

## Iconos del sitio

Viven en `/frontend/icons/` y se generaron a partir de dos ilustraciones en pixel
art: una para el favicon, más simple, y otra con más detalle para el icono de la
app.

| Archivo | Uso |
|---|---|
| `favicon-16/32/48.png` | La pestaña del navegador |
| `apple-touch-icon.png` | "Agregar a inicio" en iOS, 180x180 |
| `icono-192.png`, `icono-512.png` | La PWA |
| `icono-maskable-192/512.png` | Android, que recorta el icono a la forma del sistema |

### Cómo se prepararon
Las dos venían con fondo blanco y sin transparencia, de 1254x1254 y pesando 2,4 MB
entre las dos. El fondo se sacó con un relleno desde los bordes, no con un umbral:
**el cuerpo de la figura es casi blanco** (254,241,236) y un umbral simple se lo
comía. Lo que separa limpio es la saturación — el fondo y su sombra están en 0-2,
y lo más apagado del dibujo, en 17.

Después se recortaron a lo que no es transparente y se pasaron a paleta. Los ocho
archivos juntos pesan 170 KB.

Las versiones *maskable* llevan el dibujo al 78% y rellenan el margen con el verde
del propio cielo, para que Android pueda recortar sin comerse nada.

### Colores de la PWA
- `theme_color`: `#54414e` (la ciruela de la paleta)
- `background_color`: `#f4edf0` (el fondo del hub)

## Fondos de los menús

Cada menú tiene su ilustración en `/frontend/hub/assets/menus/`, aplicada sobre
`.bg-scene` con `cover` y un degradado encima que la apaga un poco para que el
texto se lea.

| Archivo | Menú |
|---|---|
| `background-1.png` | Wordle |
| `background-2.png` | Sudoku |
| `background-3.png` | Buscaminas |
| `background-4.png` | Hub |

### La versión vertical
Los originales son apaisados (1672x941). En un teléfono, `cover` recorta tanto
que del paisaje entran unos 370 de los 1672 píxeles de ancho: se ve un pedazo de
cielo y nada más. Por eso cada fondo tiene un `-vertical.png` de 900x1600 que
entra por media query:

```css
@media (orientation: portrait) and (max-width: 900px) {
  .bg-scene { background-image: /* degradados */, url(".../background-N-vertical.png"); }
}
```

No son dibujos nuevos: son la misma ilustración estirada **solo donde no hay
detalle**. Se calcula la energía de cada fila (cuánto cambia respecto de la de
abajo, más cuánto cambia a lo ancho) y se duplican las filas más planas —cielo
liso, pasto, agua—, promediándolas con la siguiente para que no se vea el corte.
Así el horizonte, las montañas y los árboles conservan su proporción.

Dos detalles que costaron encontrar, los dos por el mismo motivo —una fila puede
parecer plana mirando solo hacia abajo:

- **las estrellas** salían como rayas verticales, porque una fila con una
  estrella promedia casi igual que una de cielo liso. Se arregló sumando a la
  energía el salto vertical más grande de la fila, no solo el promedio.
- **el sol** salía ovalado: adentro del sol dos filas seguidas son idénticas.
  Ahí hace falta mirar a lo ancho, y el promedio tampoco alcanza, porque el sol
  ocupa 90 de los 1672 píxeles y se diluye. Lo que lo cuida es el salto
  horizontal más grande, que en esa fila es el borde del propio sol.

El estiramiento es de 1,6x. Con 1,9x el recorte queda más ancho, pero las nubes
empiezan a verse deformadas. Los cuatro verticales juntos pesan 911 KB.
