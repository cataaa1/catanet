# Genera, para cada fondo, la mascara de regiones y la textura del cielo que
# usan los paisajes animados (/background). Se corre a mano, sólo si cambia
# una ilustración:
#   pip install numpy scipy opencv-python-headless pillow
#   python herramientas/mascaras-paisajes.py 1 2 3 4 1v 2v 3v 4v
# (1v = versión vertical). Deja también prev-*.png en herramientas/salida/
# para revisar a ojo qué quedó marcado como cielo, planta, pasto y agua.
# mascara-N.png: R = region (0 fijo, 1 cielo, 2 planta, 3 pasto, 4 agua),
#                G = id de planta, B = fuerza del viento en esa planta (x100)
# cielo-N.png:   el cielo sin arboles, montes, sol ni estrellas, repetible en horizontal
import sys, json
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy import ndimage

import os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, 'frontend', 'hub', 'assets', 'menus')
SALIDA = os.path.join(RAIZ, 'frontend', 'background', 'assets')
REVISION = os.path.join(RAIZ, 'herramientas', 'salida')
W, H = 1400, 788


def canales(img):
    R, G, B = (img[..., i].astype(int) for i in range(3))
    return R, G, B, R * .3 + G * .59 + B * .11


def poligono(puntos):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(puntos, fill=1)
    return np.array(m).astype(bool)


def debajo_de(linea):
    return poligono(linea + [(W, H), (0, H)])


def caja(x0, y0, x1, y1):
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = True
    return m


def circulo(cx, cy, r):
    yy, xx = np.mgrid[:H, :W]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def estrellas(img, cielo, y_max, tam_max=9, factor=1):
    """Puntitos claros aislados en el cielo: se sacan de la textura y titilan aparte."""
    R, G, B, L = canales(img)
    vecinos = ndimage.uniform_filter(L, 15 * factor)
    # Solo donde el cielo es parejo: descarta los brillos de las nubes
    v = 21 * factor
    desvio = np.sqrt(np.maximum(ndimage.uniform_filter(L * L, v) - ndimage.uniform_filter(L, v) ** 2, 0))
    claro = (L - vecinos > 28) & cielo & (np.arange(H)[:, None] < y_max) & (desvio < 24)
    etiquetas, n = ndimage.label(claro)
    lista = []
    for i, sl in enumerate(ndimage.find_objects(etiquetas)):
        alto, ancho = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 3 <= alto <= tam_max and 3 <= ancho <= tam_max:
            lista.append([int(sl[1].start), int(sl[0].start), int(ancho), int(alto)])
    return lista


ESCENAS = {}


def escena(n):
    def registrar(f):
        ESCENAS[n] = f
        return f
    return registrar


@escena(1)
def e1(img):
    R, G, B, L = canales(img)
    arbolado = ((R - G) > 6) | (L < 150)
    plantas = [
        (1, (caja(128, 150, 360, 470) | caja(200, 470, 290, 530)) & arbolado, 1.0),
        (2, caja(338, 325, 476, 552) & arbolado, .8),
        (3, caja(36, 466, 460, 556) & arbolado, .3),
        (4, caja(940, 498, 1125, 572) & arbolado, .3),
    ]
    return dict(
        cielo=~debajo_de([(0, 458), (W, 458)]),
        plantas=plantas,
        pasto=debajo_de([(0, 500), (W, 500)]) & ~caja(85, 605, 240, 705),
        agua=None, fondo_cielo=458,
        # Lo tapado por los arboles se rellena con cielo de la derecha
        clonar=[(caja(0, 0, 360, 458), 1000), (caja(338, 0, 480, 458), 800)],
    )


@escena(2)
def e2(img):
    R, G, B, L = canales(img)
    verde = ((G >= R - 5) & (L < 190)) | (L < 125)
    horizonte = [(0, 335), (90, 335), (200, 345), (260, 350), (330, 383), (400, 395),
                 (480, 398), (560, 398), (640, 405), (700, 418), (760, 412), (820, 395),
                 (880, 378), (930, 358), (975, 338), (1020, 322), (1080, 322), (1120, 340),
                 (1180, 360), (1240, 368), (1300, 366), (1360, 356), (W, 352)]
    cielo = ~debajo_de(horizonte)
    sol = circulo(760, 382, 40)
    plantas = [
        (1, (caja(0, 48, 258, 345) | caja(112, 345, 138, 440)) & verde, 1.0),
        (2, caja(238, 286, 348, 482) & verde, .75),
    ]
    orilla = poligono([(0, 430), (330, 470), (520, 555), (560, 600), (620, 660), (700, 690),
                       (800, 730), (970, H), (0, H)])
    pasto = orilla & (((G >= R - 4) & (L > 90)) | (L > 215))
    agua = poligono([(500, 528), (900, 528), (1398, 558), (1398, 788), (796, 788), (690, 744),
                     (610, 714), (532, 674), (432, 634), (516, 592), (630, 584), (622, 562),
                     (498, 560)]) & (L > 120)
    return dict(cielo=cielo, fijo_en_cielo=sol, plantas=plantas, pasto=pasto, agua=agua,
                fondo_cielo=440, estrellas_hasta=72,
                clonar=[(caja(0, 0, 350, 330), 1000)])


@escena(3)
def e3(img):
    R, G, B, L = canales(img)
    verde = (G > R + 4)
    horizonte = [(0, 402), (60, 408), (120, 415), (180, 396), (222, 376), (262, 396),
                 (320, 415), (420, 420), (520, 425), (600, 420), (660, 427), (700, 418),
                 (740, 405), (780, 418), (840, 415), (880, 405), (920, 385), (960, 366),
                 (1000, 348), (1030, 332), (1060, 346), (1100, 370), (1140, 390),
                 (1200, 395), (1250, 378), (1300, 390), (1360, 405), (W, 405)]
    cielo = ~debajo_de(horizonte)
    sol = circulo(945, 383, 42)
    matas = caja(0, 630, W, 730) & verde
    return dict(cielo=cielo, fijo_en_cielo=sol, plantas=[('auto', matas, .7)],
                pasto=debajo_de([(0, 712), (W, 712)]) & verde, agua=None,
                fondo_cielo=430, empalme_desde=260)


@escena(4)
def e4(img):
    R, G, B, L = canales(img)
    oscuro = (L < 118) & (R > G)
    copa = (L < 150) & (R > G + 10)
    horizonte = [(0, 418), (100, 416), (160, 408), (240, 398), (300, 403), (350, 408),
                 (420, 410), (480, 422), (560, 437), (620, 444), (700, 445), (800, 445),
                 (880, 437), (940, 425), (990, 415), (1030, 412), (1080, 417), (1150, 426),
                 (1180, 420), (1250, 412), (1400, 405)]
    cielo = ~debajo_de(horizonte)
    sol = circulo(757, 455, 46)
    plantas = [
        ('auto', caja(0, 345, 262, 604) & ~caja(180, 440, 262, 500) & oscuro, .8),
        (40, caja(1140, 355, W, 648) & copa, 1.0),
        ('auto', caja(1040, 540, 1190, 652) & copa, .55),
    ]
    agua = poligono([(560, 540), (600, 520), (760, 516), (810, 530), (790, 560), (700, 572),
                     (600, 570)]) & (L > 185)
    pasto = debajo_de([(0, 600), (360, 620), (W, 640)]) & (((G >= R - 6) & (L > 100)) | (L > 205))
    return dict(cielo=cielo, fijo_en_cielo=sol, plantas=plantas, pasto=pasto, agua=agua,
                fondo_cielo=455, estrellas_hasta=130,
                clonar=[(caja(0, 0, 262, 455), 560), (caja(1140, 0, W, 455), -620)])


@escena('1v')
def e1v(img):
    R, G, B, L = canales(img)
    arbolado = ((R - G) > 6) | (L < 150)
    return dict(
        cielo=~debajo_de([(0, 950), (W, 950)]),
        plantas=[
            (1, caja(0, 620, 122, 1120) & arbolado, 1.0),
            (2, caja(560, 1075, W, 1175) & arbolado, .3),
        ],
        pasto=debajo_de([(0, 1040), (W, 1040)]),
        agua=None, fondo_cielo=950, bloque=12,
        clonar=[(caja(0, 0, 130, 950), 640)],
    )


@escena('2v')
def e2v(img):
    R, G, B, L = canales(img)
    verde = (G >= R - 4)
    horizonte = [(0, 866), (100, 884), (200, 912), (300, 918), (420, 926), (480, 922), (560, 895),
                 (640, 864), (720, 830), (800, 804), (860, 786), (W, 776)]
    orilla = poligono([(0, 1335), (150, 1375), (300, 1425), (450, 1495), (620, H), (0, H)])         | poligono([(0, 1150), (240, 1165), (240, 1240), (0, 1262)])
    juncos = caja(540, 1430, W, H) & verde & (L > 80) & (L < 160)
    agua = poligono([(0, 1138), (W, 1138), (W, H), (620, H), (450, 1495), (300, 1425), (150, 1375),
                     (0, 1335)]) & (L > 120) & ~juncos
    return dict(cielo=~debajo_de(horizonte), fijo_en_cielo=circulo(530, 855, 54), plantas=[],
                pasto=(orilla & ((verde & (L > 80)) | (L > 215))) | juncos, agua=agua,
                fondo_cielo=930, estrellas_hasta=300, estrella_max=16, bloque=12)


@escena('3v')
def e3v(img):
    R, G, B, L = canales(img)
    verde = (G > R + 4)
    horizonte = [(0, 882), (100, 896), (200, 896), (300, 886), (380, 860), (460, 880), (520, 872),
                 (640, 850), (700, 838), (760, 822), (820, 804), (870, 792), (W, 800)]
    matas = caja(0, 1430, W, 1510) & verde
    return dict(cielo=~debajo_de(horizonte), fijo_en_cielo=circulo(762, 862, 52),
                plantas=[('auto', matas, .7)],
                pasto=debajo_de([(0, 1490), (W, 1490)]) & verde, agua=None,
                fondo_cielo=900, empalme_desde=120, bloque=12)


@escena('4v')
def e4v(img):
    R, G, B, L = canales(img)
    copa = (L < 150) & (R > G + 10)
    horizonte = [(0, 1062), (100, 1066), (200, 1080), (300, 1098), (400, 1110), (640, 1110),
                 (700, 1094), (800, 1074), (W, 1066)]
    agua = poligono([(270, 1240), (330, 1225), (560, 1228), (560, 1270), (430, 1292), (280, 1285)]) & (L > 185)
    pasto = debajo_de([(0, 1300), (W, 1330)]) & (((G >= R - 6) & (L > 100)) | (L > 205))
    return dict(cielo=~debajo_de(horizonte), fijo_en_cielo=circulo(520, 1128, 56),
                plantas=[('auto', caja(0, 1270, W, 1440) & copa, .5)],
                pasto=pasto, agua=agua, fondo_cielo=1110, estrellas_hasta=460, estrella_max=16,
                bloque=12)


def pixelar(rellena, hueco, paleta, bloque=6):
    """Lo inventado por el relleno se lleva a bloques y a la paleta del dibujo."""
    h, w = hueco.shape
    chica = cv2.resize(rellena, (w // bloque + 1, h // bloque + 1), interpolation=cv2.INTER_AREA)
    grande = cv2.resize(chica, (chica.shape[1] * bloque, chica.shape[0] * bloque),
                        interpolation=cv2.INTER_NEAREST)[:h, :w]
    salida = rellena.copy()
    pix = grande[hueco].astype(float)
    dist = ((pix[:, None, :] - paleta[None, :, :]) ** 2).sum(-1)
    salida[hueco] = paleta[dist.argmin(1)].astype(np.uint8)
    return salida


def construir(n):
    global W, H
    archivo = f'background-{n[:-1]}-vertical.png' if str(n).endswith('v') else f'background-{n}.png'
    img = np.array(Image.open(f'{BASE}/{archivo}').convert('RGB'))
    H, W = img.shape[:2]
    d = ESCENAS[n](img)
    mascara = np.zeros((H, W, 3), np.uint8)
    ocupado = np.zeros((H, W), bool)
    siguiente = 60
    for id_, m, fuerza in d['plantas']:
        m = m & ~ocupado
        if id_ == 'auto':
            # Cada mata o arbol suelto recibe su propio id
            etiquetas, cant = ndimage.label(ndimage.binary_dilation(m, iterations=3))
            for i in range(1, cant + 1):
                parte = (etiquetas == i) & m
                if parte.sum() < 40:
                    continue
                mascara[parte] = (2, siguiente, int(fuerza * 100))
                siguiente += 1
        else:
            mascara[m] = (2, id_, int(fuerza * 100))
        ocupado |= m
    # El cielo no pisa el borde de las plantas
    cerca_planta = ndimage.binary_dilation(ocupado, iterations=2)
    cielo = d['cielo'] & ~cerca_planta
    if d.get('fijo_en_cielo') is not None:
        cielo &= ~d['fijo_en_cielo']
    lista_estrellas = []
    if d.get('estrellas_hasta'):
        lista_estrellas = estrellas(img, cielo, d['estrellas_hasta'], d.get('estrella_max', 9), d.get('bloque', 6) // 6)
    mascara[cielo, 0] = 1
    if d['agua'] is not None:
        a = d['agua'] & ~ocupado & ~cielo
        mascara[a, 0] = 4
        ocupado |= a
    if d['pasto'] is not None:
        p = d['pasto'] & ~ocupado & (mascara[..., 0] == 0)
        mascara[p, 0] = 3
    Image.fromarray(mascara).save(f'{SALIDA}/mascara-{n}.png', optimize=True)

    # Textura del cielo
    alto = d['fondo_cielo']
    franja = img[:alto].copy()
    es_cielo = cielo[:alto].copy()
    for x0, y0, x1, y1 in lista_estrellas:
        es_cielo[max(0, y0 - 2):y1 + y0 + 2, max(0, x0 - 2):x0 + x1 + 2] = False
    for zona, dx in d.get('clonar', []):
        zona = zona[:alto] & ~es_cielo
        ys, xs = np.nonzero(zona)
        xo = xs + dx
        ok = (xo >= 0) & (xo < W)
        ys, xs, xo = ys[ok], xs[ok], xo[ok]
        ok = es_cielo[ys, xo]
        franja[ys[ok], xs[ok]] = img[ys[ok], xo[ok]]
        es_cielo[ys[ok], xs[ok]] = True
    hueco = ~es_cielo
    rellena = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(franja, cv2.COLOR_RGB2BGR),
                                       hueco.astype(np.uint8), 9, cv2.INPAINT_TELEA),
                           cv2.COLOR_BGR2RGB)
    paleta = np.unique(img[:alto][cielo[:alto]].reshape(-1, 3), axis=0).astype(float)
    rellena = pixelar(rellena, hueco, paleta, d.get('bloque', 6)).astype(float)
    # Repetible: se agrega a la derecha un tramo de empalme (fuera de pantalla al
    # arrancar). Las nubes del borde se disuelven en bloques hacia un cielo
    # liso y del cielo liso aparecen las del borde izquierdo.
    E, F = 460, 96
    liso = np.array([np.median(rellena[y][cielo[y, :W]], axis=0) if cielo[y].any() else rellena[y].mean(0)
                     for y in range(alto)])
    liso = np.repeat(liso[:, None, :], E, axis=1)
    if d.get('empalme_desde') is not None:
        # En un cielo todo nublado, el tramo del medio es otro pedazo de nubes
        liso = rellena[:, d['empalme_desde']:d['empalme_desde'] + E].copy()
    espejo_der = rellena[:, ::-1][:, :F]            # continua el borde derecho
    espejo_izq = rellena[:, :F][:, ::-1]            # termina en el borde izquierdo
    # Ruido suave en bloques de 6 px: el borde queda deshilachado como una nube
    rng = np.random.default_rng(int(str(n).rstrip('v')) + (100 if str(n).endswith('v') else 0))
    bq = d.get('bloque', 6)
    ruido = ndimage.gaussian_filter(rng.random((alto // bq + 1, E // bq + 1)), 1.6)
    ruido = (ruido - ruido.min()) / (ruido.max() - ruido.min())
    yy, xx = np.mgrid[:alto, :E]
    umbral = 0.15 + 0.7 * ruido[yy // bq, xx // bq]
    empalme = liso.copy()
    salida_der = (xx < F) & (xx / F < 1 - umbral)
    empalme[salida_der] = espejo_der[:, :][yy[salida_der], xx[salida_der]]
    k = E - 1 - xx
    entrada_izq = (k < F) & (k / F < 1 - umbral)
    empalme[entrada_izq] = espejo_izq[yy[entrada_izq], F - 1 - k[entrada_izq]]
    tile = np.concatenate([rellena, empalme], axis=1)
    Lr = tile.shape[1]
    Image.fromarray(tile.round().astype(np.uint8)).save(f'{SALIDA}/cielo-{n}.png', optimize=True)

    prev = img.astype(float)
    colores = {1: (255, 60, 60), 2: (40, 255, 40), 3: (60, 120, 255), 4: (0, 255, 255)}
    for r, c in colores.items():
        m = mascara[..., 0] == r
        prev[m] = prev[m] * .45 + np.array(c) * .55
    for x0, y0, w_, h_ in lista_estrellas:
        prev[y0:y0 + h_, x0:x0 + w_] = (255, 255, 0)
    os.makedirs(REVISION, exist_ok=True)
    Image.fromarray(prev.astype(np.uint8)).save(f'{REVISION}/prev-{n}.png')
    return dict(estrellas=lista_estrellas, ancho_cielo=Lr, alto_cielo=alto)


if __name__ == '__main__':
    datos = {}
    for n in [a if a.endswith('v') else int(a) for a in sys.argv[1:]]:
        datos[n] = construir(n)
        print(n, json.dumps(datos[n]))
