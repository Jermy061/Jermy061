"""
Genera assets/activity-graph.svg: un gráfico de líneas con las
contribuciones de los últimos 31 días.

Uso local:
    set GITHUB_TOKEN=tu_token
    python scripts/activity_graph.py Jermy061

En GitHub Actions el token lo inyecta el workflow.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

BG = "#0d0d0e"
GRID = "#1f1f23"
AXIS = "#3a3a3e"
ACCENT = "#E8B04B"
TEXT = "#c9c9ce"
MUTED = "#74747a"

W, H = 900, 320
M_IZQ, M_DER, M_ARR, M_ABA = 56, 28, 56, 48

CONSULTA = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
"""


def traer(login, token, dias=31):
    hasta = datetime.now(timezone.utc)
    desde = hasta - timedelta(days=dias - 1)
    cuerpo = json.dumps({
        "query": CONSULTA,
        "variables": {
            "login": login,
            "from": desde.isoformat(),
            "to": hasta.isoformat(),
        },
    }).encode()
    pet = urllib.request.Request(
        "https://api.github.com/graphql",
        data=cuerpo,
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "activity-graph",
        },
    )
    with urllib.request.urlopen(pet) as r:
        datos = json.load(r)
    if "errors" in datos:
        raise SystemExit("La API respondió con errores: " + json.dumps(datos["errors"]))
    semanas = datos["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
    dias_ = [d for s in semanas for d in s["contributionDays"]]
    dias_.sort(key=lambda d: d["date"])
    return [(d["date"], d["contributionCount"]) for d in dias_][-dias:]


def dibujar(serie, titulo, destino):
    n = len(serie)
    valores = [v for _, v in serie]
    tope = max(max(valores), 1)
    paso = 1 if tope <= 5 else (2 if tope <= 10 else (5 if tope <= 25 else 10))
    tope_eje = ((tope + paso - 1) // paso) * paso

    ancho = W - M_IZQ - M_DER
    alto = H - M_ARR - M_ABA

    def px(i):
        return M_IZQ + (ancho * i / (n - 1) if n > 1 else 0)

    def py(v):
        return M_ARR + alto - (alto * v / tope_eje)

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
         f'viewBox="0 0 {W} {H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">']
    s.append(f'<rect width="{W}" height="{H}" rx="10" fill="{BG}"/>')
    s.append(f'<text x="{M_IZQ}" y="30" fill="{ACCENT}" font-size="13" '
             f'font-family="Consolas, monospace">{titulo}</text>')

    lineas = 4
    for k in range(lineas + 1):
        v = tope_eje * k / lineas
        y = py(v)
        s.append(f'<line x1="{M_IZQ}" y1="{y:.1f}" x2="{W - M_DER}" y2="{y:.1f}" '
                 f'stroke="{GRID}" stroke-width="1"/>')
        s.append(f'<text x="{M_IZQ - 10}" y="{y:.1f}" fill="{MUTED}" font-size="10" '
                 f'text-anchor="end" dominant-baseline="middle" '
                 f'font-family="Consolas, monospace">{int(v)}</text>')

    area = [f"{px(0):.1f},{py(0):.1f}"]
    area += [f"{px(i):.1f},{py(v):.1f}" for i, v in enumerate(valores)]
    area.append(f"{px(n - 1):.1f},{py(0):.1f}")
    s.append(f'<polygon points="{" ".join(area)}" fill="{ACCENT}" fill-opacity="0.14"/>')

    linea = " ".join(f"{px(i):.1f},{py(v):.1f}" for i, v in enumerate(valores))
    s.append(f'<polyline points="{linea}" fill="none" stroke="{ACCENT}" stroke-width="2" '
             f'stroke-linejoin="round" stroke-linecap="round"/>')

    for i, v in enumerate(valores):
        s.append(f'<circle cx="{px(i):.1f}" cy="{py(v):.1f}" r="2.6" fill="{BG}" '
                 f'stroke="{ACCENT}" stroke-width="1.6"/>')

    s.append(f'<line x1="{M_IZQ}" y1="{M_ARR + alto}" x2="{W - M_DER}" y2="{M_ARR + alto}" '
             f'stroke="{AXIS}" stroke-width="1"/>')
    cada = max(1, n // 6)
    for i in range(0, n, cada):
        fecha = datetime.strptime(serie[i][0], "%Y-%m-%d")
        etiqueta = fecha.strftime("%d %b").lower()
        s.append(f'<text x="{px(i):.1f}" y="{M_ARR + alto + 20}" fill="{MUTED}" font-size="10" '
                 f'text-anchor="middle" font-family="Consolas, monospace">{etiqueta}</text>')

    total = sum(valores)
    s.append(f'<text x="{W - M_DER}" y="30" fill="{TEXT}" font-size="11" text-anchor="end" '
             f'font-family="Consolas, monospace">{total} contribuciones · pico {tope}</text>')

    s.append("</svg>")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as f:
        f.write("\n".join(s))
    print("escrito:", destino)


if __name__ == "__main__":
    login = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GITHUB_REPOSITORY_OWNER", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    destino = os.path.join(raiz, "assets", "activity-graph.svg")

    if not login or not token:
        raise SystemExit("Faltan el usuario o GITHUB_TOKEN.")

    serie = traer(login, token)
    dibujar(serie, "actividad.log · ultimos 31 dias", destino)
