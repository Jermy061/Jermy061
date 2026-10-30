import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.GITHUB_USERNAME || 'Jermy061';
const token = process.env.GH_ACTIVITY_TOKEN;
if (!token) throw new Error('Falta GH_ACTIVITY_TOKEN. Configúralo como secreto del repositorio.');

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
    }
  }
}`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Jermy061-GitHub-Activity-Graph'
  },
  signal: AbortSignal.timeout(30000),
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) throw new Error(`GitHub API respondió HTTP ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));
const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length === 0) {
  throw new Error('GitHub no devolvió el calendario. No se reemplazará el SVG existente.');
}

const days = calendar.weeks.flatMap((week) => week.contributionDays);
if (!days.length || !days.some(day => day.contributionCount > 0)) {
  throw new Error('El calendario llegó vacío o sin contribuciones. Se cancela para evitar publicar un gráfico falso.');
}

const width = 1120;
const height = 280;
const left = 48;
const top = 110;
const cell = 12;
const gap = 4;
const step = cell + gap;
const palette = {
  NONE: '#171b24',
  FIRST_QUARTILE: '#0e4429',
  SECOND_QUARTILE: '#006d32',
  THIRD_QUARTILE: '#26a641',
  FOURTH_QUARTILE: '#39d353'
};
const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const firstDate = new Date(`${days[0].date}T00:00:00Z`);
const monthLabels = [];
let lastMonth = -1;
let rects = '';

for (const day of days) {
  const date = new Date(`${day.date}T00:00:00Z`);
  const weekIndex = Math.floor(((date - firstDate) / 86400000 + firstDate.getUTCDay()) / 7);
  const weekday = date.getUTCDay();
  if (date.getUTCMonth() !== lastMonth) {
    monthLabels.push(`<text x="${left + weekIndex * step}" y="96" class="month">${monthNames[date.getUTCMonth()]}</text>`);
    lastMonth = date.getUTCMonth();
  }
  const color = palette[day.contributionLevel] || palette.NONE;
  const label = `${day.date}: ${day.contributionCount} contribuciones`;
  rects += `<rect x="${left + weekIndex * step}" y="${top + weekday * step}" width="${cell}" height="${cell}" rx="3" fill="${color}"><title>${esc(label)}</title></rect>`;
}

const total = Number(calendar.totalContributions);
if (!Number.isFinite(total) || total < 0) throw new Error('El total recibido de GitHub no es válido.');
const first = days[0].date;
const last = days.at(-1).date;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${total} contribuciones de ${esc(username)} en el último año</title>
<desc id="desc">Calendario diario generado con GitHub GraphQL, desde ${first} hasta ${last}. Cada celda representa las contribuciones reales de ese día.</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101522"/><stop offset="1" stop-color="#090d16"/></linearGradient></defs>
<style>
  .mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  .month{font:13px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#aab5c8;text-transform:uppercase}
  .muted{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#8492a8}
</style>
<rect width="${width}" height="${height}" rx="16" fill="url(#bg)" stroke="#303b50"/>
<path d="M16 42H1104" stroke="#28344a"/>
<text x="28" y="29" class="mono" font-size="13" fill="#70e1d2">$ tail -f actividad.log</text>
<text x="1090" y="29" text-anchor="end" class="mono" font-size="12" fill="#a78bfa">GITHUB ACTIVITY</text>
<text x="28" y="68" class="mono" font-size="29" font-weight="700" fill="#39d98a">${total}</text>
<text x="100" y="68" class="mono" font-size="17" fill="#e6edf3">contribuciones en el último año</text>
${monthLabels.join('\n')}
${rects}
<text x="28" y="254" class="muted">${esc(first)} → ${esc(last)} · datos oficiales de GitHub</text>
<text x="870" y="254" class="muted">Menos</text>
${['#171b24','#0e4429','#006d32','#26a641','#39d353'].map((color, i) => `<rect x="${922 + i * 16}" y="241" width="13" height="13" rx="3" fill="${color}"/>`).join('')}
<text x="1002" y="254" class="muted">Más</text>
</svg>`;

await mkdir('assets', { recursive: true });
await writeFile('assets/activity-graph.svg', svg, 'utf8');
console.log(`SVG actualizado: ${total} contribuciones (${first} a ${last}).`);
