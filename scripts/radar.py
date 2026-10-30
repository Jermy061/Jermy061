"""
Genera los radares SVG del perfil.

Uso:
    python scripts/radar.py

Edita las listas del final para cambiar ejes y valores (0-100),
vuelve a ejecutar y commitea los SVG de assets/.
"""
import math
import os

BG = "#0d0d0e"
GRID = "#2a2a2e"
AXIS = "#3a3a3e"
ACCENT = "#E8B04B"
FILL = "rgba(232,176,75,0.16)"
TEXT = "#c9c9ce"
MUTED = "#74747a"

RAIZ = os.path.join(os.path.dirname(__file__), "..", "assets")


def radar(titulo, ejes, archivo, w=460, h=400):
    cx, cy = w / 2, h / 2 + 14
    R = 118
    n = len(ejes)
    anillos = 4

    def punto(i, v):
        a = -math.pi / 2 + i * 2 * math.pi / n
        r = R * v / 100
        return (cx + r * math.cos(a), cy + r * math.sin(a))

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
         f'viewBox="0 0 {w} {h}" font-family="Segoe UI, Helvetica, Arial, sans-serif">']
    s.append(f'<rect width="{w}" height="{h}" rx="10" fill="{BG}"/>')
    s.append(f'<text x="20" y="28" fill="{ACCENT}" font-size="13" '
             f'font-family="Consolas, monospace">{titulo}</text>')

    for k in range(1, anillos + 1):
        pts = []
        for i in range(n):
            a = -math.pi / 2 + i * 2 * math.pi / n
            r = R * k / anillos
            pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
        s.append(f'<polygon points="{" ".join(pts)}" fill="none" stroke="{GRID}" stroke-width="1"/>')

    for i in range(n):
        x, y = punto(i, 100)
        s.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{AXIS}" stroke-width="1"/>')

    pts = [f"{punto(i, v)[0]:.1f},{punto(i, v)[1]:.1f}" for i, (_, v) in enumerate(ejes)]
    s.append(f'<polygon points="{" ".join(pts)}" fill="{FILL}" stroke="{ACCENT}" '
             f'stroke-width="2" stroke-linejoin="round"/>')
    for i, (_, v) in enumerate(ejes):
        x, y = punto(i, v)
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="{ACCENT}"/>')

    for i, (nombre, v) in enumerate(ejes):
        a = -math.pi / 2 + i * 2 * math.pi / n
        lx, ly = cx + (R + 30) * math.cos(a), cy + (R + 30) * math.sin(a)
        anchor = "middle"
        if math.cos(a) > 0.3:
            anchor = "start"
        elif math.cos(a) < -0.3:
            anchor = "end"
        s.append(f'<text x="{lx:.1f}" y="{ly:.1f}" fill="{TEXT}" font-size="12" '
                 f'text-anchor="{anchor}" dominant-baseline="middle">{nombre}</text>')
        s.append(f'<text x="{lx:.1f}" y="{ly + 14:.1f}" fill="{MUTED}" font-size="10" '
                 f'text-anchor="{anchor}" dominant-baseline="middle" '
                 f'font-family="Consolas, monospace">{v}</text>')

    s.append("</svg>")
    destino = os.path.join(RAIZ, archivo)
    with open(destino, "w", encoding="utf-8") as f:
        f.write("\n".join(s))
    print("escrito:", destino)


if __name__ == "__main__":
    radar("skills.radar", [
        ("Frontend", 88),
        ("Backend", 80),
        ("Bases de datos", 76),
        ("Testing / QA", 72),
        ("DevOps", 58),
        ("Diseño UI", 70),
    ], "radar-skills.svg")

    radar("languages.radar", [
        ("TypeScript", 90),
        ("JavaScript", 82),
        ("C#", 60),
        ("PHP", 48),
        ("Python", 55),
        ("SQL", 74),
    ], "radar-langs.svg")
