import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.GITHUB_USERNAME || 'Jermy061';
const token = process.env.GH_ACTIVITY_TOKEN;
if (!token) throw new Error('Falta GH_ACTIVITY_TOKEN. Configúralo como secreto del repositorio.');

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection(includePrivateContributions: true) {
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
    'User-Agent': `${username}-GitHub-Activity-Chart`
  },
  body: JSON.stringify({ query, variables: { login: username } })
});

if (!response.ok) throw new Error(`GitHub API respondió HTTP ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
if (!calendar?.weeks?.length) {
  throw new Error('GitHub no devolvió semanas del calendario.');
}

const weeks = calendar.weeks.map((week) => {
  const total = week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0);
  return {
    start: week.contributionDays[0]?.date,
    end: week.contributionDays.at(-1)?.date,
    total
  };
});

if (!weeks.some(w => w.total > 0)) {
  throw new Error('El calendario llegó sin contribuciones. Se cancela para evitar publicar un gráfico falso.');
}

const total = Number(calendar.totalContributions);
const first = weeks[0].start;
const last = weeks.at(-1).end;

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const width = 1120;
const height = 320;
const left = 60;
const right = 24;
const top = 92;
const bottom = 58;
const chartW = width - left - right;
const chartH = height - top - bottom;
const barGap = 4;
const barCount = weeks.length;
const barWidth = Math.max(5, Math.floor((chartW - barGap * (barCount - 1)) / barCount));
const plotW = barCount * barWidth + (barCount - 1) * barGap;
const offsetX = left + Math.max(0, Math.floor((chartW - plotW) / 2));
const maxWeekly = Math.max(...weeks.map(w => w.total), 1);
const maxY = Math.ceil(maxWeekly / 5) * 5;
const ticks = 4;
const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const grid = [];
for (let i = 0; i <= ticks; i++) {
  const value = Math.round((maxY / ticks) * i);
  const y = top + chartH - (chartH / ticks) * i;
  grid.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#1d2a3b" stroke-width="1"/>`);
  grid.push(`<text x="${left - 10}" y="${y + 4}" text-anchor="end" class="muted">${value}</text>`);
}

const monthLabels = [];
let prevMonth = -1;
weeks.forEach((week, index) => {
  const d = new Date(`${week.start}T00:00:00Z`);
  const month = d.getUTCMonth();
  if (month !== prevMonth) {
    const x = offsetX + index * (barWidth + barGap);
    monthLabels.push(`<text x="${x}" y="76" class="month">${monthNames[month]}</text>`);
    prevMonth = month;
  }
});

const bars = weeks.map((week, index) => {
  const x = offsetX + index * (barWidth + barGap);
  const barH = Math.max(2, Math.round((week.total / maxY) * chartH));
  const y = top + chartH - barH;
  const label = `${week.start} → ${week.end}: ${week.total} contribuciones`;
  return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="url(#bar)" opacity="${week.total === 0 ? '0.35' : '1'}"><title>${esc(label)}</title></rect>`;
}).join('\n');

const peak = Math.max(...weeks.map(w => w.total));
const peakWeek = weeks.find(w => w.total === peak);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${total} contribuciones de ${esc(username)} en el último año</title>
<desc id="desc">Gráfico de barras semanales generado con GitHub GraphQL, desde ${first} hasta ${last}. Cada barra representa el total real de contribuciones de esa semana.</desc>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#101522"/>
    <stop offset="1" stop-color="#090d16"/>
  </linearGradient>
  <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#0ea95f"/>
    <stop offset="1" stop-color="#45f882"/>
  </linearGradient>
</defs>
<style>
  .mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  .month{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#9fb1cc}
  .muted{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#7f8ca3}
</style>
<rect width="${width}" height="${height}" rx="16" fill="url(#bg)" stroke="#303b50"/>
<path d="M16 42H1104" stroke="#28344a"/>
<text x="28" y="29" class="mono" font-size="13" fill="#70e1d2">$ analytics --contributions</text>
<text x="1090" y="29" text-anchor="end" class="mono" font-size="12" fill="#a78bfa">REAL GITHUB DATA</text>
<text x="28" y="70" class="mono" font-size="30" font-weight="700" fill="#39d98a">${total}</text>
<text x="102" y="70" class="mono" font-size="18" fill="#e6edf3">contribuciones en el último año</text>
<text x="860" y="70" class="muted">pico semanal: ${peak} · ${esc(peakWeek?.start || '')}</text>
${monthLabels.join('\n')}
${grid.join('\n')}
${bars}
<text x="28" y="292" class="muted">${esc(first)} → ${esc(last)} · barras semanales · incluye contribuciones privadas anonimizadas</text>
</svg>`;

await mkdir('assets', { recursive: true });
await writeFile('assets/activity-graph.svg', svg, 'utf8');
console.log(`SVG actualizado: ${total} contribuciones (${first} a ${last}).`);