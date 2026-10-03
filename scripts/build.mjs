#!/usr/bin/env node
// Renders the profile SVGs (hero banner and activity card, dark and light)
// in the language of desktop-design-system: one glass material, achromatic
// chrome, colour only where content lives.
//
//   GITHUB_TOKEN=$(gh auth token) node scripts/build.mjs
//
// Without a token only the banners are rebuilt.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOGIN = process.env.GH_LOGIN ?? 'aleksandr-mazhul';
const TOKEN = process.env.GITHUB_TOKEN;

// Profile README column is ~840px, so tokens below map close to 1:1.
const WIDTH = 840;
const RADIUS_SURFACE = 30; // radius.surface

const BANNER = {
  eyebrow: 'ARCH  ·  HYPRLAND  ·  QUICKSHELL',
  name: 'Aleksandr Mazhul',
  tagline: 'Calm software and a glass-first Linux desktop.',
};

const THEMES = {
  dark: {
    fg: '255,255,255',
    primary: 0.92,
    secondary: 0.56,
    tertiary: 0.34,
    base: '#0e1016',
    frost: 'rgba(255,255,255,0.045)',
    edge: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.05)'],
    wall: ['#4044b0', '#1b5888', '#6c3fae'],
    wallOpacity: 0.42,
    grain: 0.06,
    accent: '#9da1ff',
    cellEmpty: 0.07,
  },
  light: {
    fg: '0,0,0',
    primary: 0.86,
    secondary: 0.52,
    tertiary: 0.32,
    base: '#f4f5fa',
    frost: 'rgba(255,255,255,0.5)',
    edge: ['rgba(255,255,255,0.9)', 'rgba(0,0,0,0.07)'],
    wall: ['#aeb1ff', '#9fd0f2', '#d3bdff'],
    wallOpacity: 0.75,
    grain: 0.045,
    accent: '#6b6fe6',
    cellEmpty: 0.06,
  },
};

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const LEVEL_OPACITY = [0, 0.3, 0.52, 0.76, 1];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ink = (t, alpha) => `rgba(${t.fg},${alpha})`;

async function fontFaces(names) {
  const faces = await Promise.all(
    names.map(async (name) => {
      const data = await readFile(`${ROOT}assets/fonts/${name}.woff`);
      return `@font-face{font-family:'p-${name}';src:url(data:font/woff;base64,${data.toString('base64')}) format('woff');}`;
    }),
  );
  return faces.join('');
}

const FAMILY = {
  display: "'p-display','Adwaita Sans',Inter,-apple-system,'Segoe UI',sans-serif",
  text: "'p-text','Adwaita Sans',Inter,-apple-system,'Segoe UI',sans-serif",
  mono: "'p-mono','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
};

// The shared material: wallpaper seen through frost, grain, specular edge.
function plate(t, height, { wallStrength = 1, drift = true } = {}) {
  const r = RADIUS_SURFACE;
  const blobs = [
    { cx: 0.12, cy: 0.1, r: 0.36, dx: 60, dy: 30, dur: 34 },
    { cx: 0.62, cy: 1.05, r: 0.42, dx: -70, dy: -20, dur: 41 },
    { cx: 0.98, cy: 0.2, r: 0.3, dx: -40, dy: 40, dur: 29 },
  ];
  const wall = blobs
    .map((b, i) => {
      const anim = drift
        ? `<animateTransform attributeName="transform" type="translate" values="0 0;${b.dx} ${b.dy};0 0" dur="${b.dur}s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>`
        : '';
      return `<circle cx="${b.cx * WIDTH}" cy="${b.cy * height}" r="${b.r * WIDTH}" fill="${t.wall[i]}">${anim}</circle>`;
    })
    .join('');

  return `
  <defs>
    <clipPath id="plate"><rect width="${WIDTH}" height="${height}" rx="${r}"/></clipPath>
    <filter id="frost" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1 0"/>
    </filter>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.edge[0]}"/><stop offset="1" stop-color="${t.edge[1]}"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#plate)">
    <rect width="${WIDTH}" height="${height}" fill="${t.base}"/>
    <g filter="url(#frost)" opacity="${t.wallOpacity * wallStrength}">${wall}</g>
    <rect width="${WIDTH}" height="${height}" fill="${t.frost}"/>
    <rect width="${WIDTH}" height="${height}" filter="url(#grain)" opacity="${t.grain}"/>
  </g>
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="${r - 0.5}" fill="none" stroke="url(#edge)"/>`;
}

const motion = `
  .in{opacity:0;animation:in .9s cubic-bezier(.2,.7,.2,1) forwards}
  .d1{animation-delay:.08s}.d2{animation-delay:.2s}.d3{animation-delay:.32s}
  @keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .pulse{animation:pulse 3.6s ease-in-out infinite}
  @keyframes pulse{50%{opacity:.35}}
  @media (prefers-reduced-motion:reduce){.in{animation:none;opacity:1}.pulse{animation:none}}`;

async function banner(t) {
  const h = 260;
  const x = 44;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}" viewBox="0 0 ${WIDTH} ${h}" role="img" aria-label="${esc(`${BANNER.name}. ${BANNER.tagline}`)}">
  <style>${await fontFaces(['display', 'text', 'mono'])}${motion}</style>
  ${plate(t, h)}
  <g class="in d1">
    <circle class="pulse" cx="${x + 4}" cy="${78}" r="4" fill="${t.accent}"/>
    <text x="${x + 18}" y="${82}" font-family="${FAMILY.mono}" font-size="11.5" letter-spacing="1.4" fill="${ink(t, t.tertiary)}">${esc(BANNER.eyebrow)}</text>
  </g>
  <text class="in d2" x="${x - 2}" y="${150}" font-family="${FAMILY.display}" font-size="54" letter-spacing="-1.6" fill="${ink(t, t.primary)}">${esc(BANNER.name)}</text>
  <text class="in d3" x="${x}" y="${190}" font-family="${FAMILY.text}" font-size="18" fill="${ink(t, t.secondary)}">${esc(BANNER.tagline)}</text>
</svg>
`;
}

async function fetchCalendar() {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${TOKEN}`, 'content-type': 'application/json', 'user-agent': LOGIN },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GraphQL: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data.user.contributionsCollection.contributionCalendar;
}

function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today without commits yet does not break the current streak.
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let current = 0;
  while (i >= 0 && days[i].contributionCount > 0) {
    current++;
    i--;
  }
  const busiest = days.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a), days[0]);
  return { longest, current, busiest };
}

const fmtDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function activity(t, cal) {
  const h = 256;
  const pad = 28;
  const gap = 3;
  const weeks = cal.weeks;
  const cell = Math.floor((WIDTH - 2 * pad + gap) / weeks.length) - gap;
  const gridW = weeks.length * (cell + gap) - gap;
  const gx = (WIDTH - gridW) / 2;
  const gy = 98;

  const cells = [];
  const months = [];
  let lastMonth = -1;
  weeks.forEach((week, w) => {
    const month = Number(week.contributionDays[0].date.slice(5, 7)) - 1;
    if (month !== lastMonth) months.push({ w, month });
    lastMonth = month;
    for (const day of week.contributionDays) {
      const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      const level = LEVELS[day.contributionLevel] ?? 0;
      const fill = level ? t.accent : ink(t, t.cellEmpty);
      const opacity = level ? ` fill-opacity="${LEVEL_OPACITY[level]}"` : '';
      cells.push(
        `<rect x="${gx + w * (cell + gap)}" y="${gy + row * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fill}"${opacity}><title>${day.contributionCount} on ${fmtDate(day.date)}</title></rect>`,
      );
    }
  });

  // A sliver of a month at the left edge would collide with the next label.
  if (months.length > 1 && months[1].w - months[0].w < 3) months.shift();
  const monthSvg = months
    .map(({ w, month }) => `<text x="${gx + w * (cell + gap)}" y="${gy - 12}">${MONTHS[month]}</text>`)
    .join('');

  const days = weeks.flatMap((w) => w.contributionDays);
  const s = streaks(days);
  const stats = [
    ['longest streak', plural(s.longest, 'day')],
    ['current streak', plural(s.current, 'day')],
    ['busiest day', `${s.busiest.contributionCount} · ${fmtDate(s.busiest.date)}`],
  ];
  const statY = h - 30;
  let sx = gx;
  const statSvg = stats
    .map(([label, value]) => {
      const out = `<text x="${sx}" y="${statY}"><tspan fill="${ink(t, t.tertiary)}">${label}</tspan><tspan dx="8" fill="${ink(t, t.primary)}">${esc(value)}</tspan></text>`;
      sx += (label.length + value.length + 1) * 6.6 + 36; // mono advance at 11px
      return out;
    })
    .join('');

  const total = cal.totalContributions.toLocaleString('en-US');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}" viewBox="0 0 ${WIDTH} ${h}" role="img" aria-label="${esc(`${total} contributions in the past year; longest streak ${s.longest} days`)}">
  <style>${await fontFaces(['display', 'mono'])}${motion}</style>
  ${plate(t, h, { wallStrength: 0.4, drift: false })}
  <g class="in d1">
    <text x="${gx}" y="50" font-family="${FAMILY.display}" font-size="19" letter-spacing="-0.3" fill="${ink(t, t.primary)}">Activity</text>
    <text x="${gx + gridW}" y="50" text-anchor="end" font-family="${FAMILY.mono}" font-size="11.5" fill="${ink(t, t.secondary)}">${total} contributions · past year</text>
  </g>
  <g class="in d2" font-family="${FAMILY.mono}" font-size="10.5" fill="${ink(t, t.tertiary)}">${monthSvg}</g>
  <g class="in d2">${cells.join('')}</g>
  <g class="in d3" font-family="${FAMILY.mono}" font-size="11">${statSvg}</g>
</svg>
`;
}

const cal = TOKEN ? await fetchCalendar() : null;
if (!cal) console.warn('GITHUB_TOKEN not set: skipping activity card');

for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(`${ROOT}assets/banner-${name}.svg`, await banner(theme));
  if (cal) await writeFile(`${ROOT}assets/activity-${name}.svg`, await activity(theme, cal));
}
console.log(`built ${cal ? 4 : 2} svgs${cal ? ` · ${cal.totalContributions} contributions` : ''}`);
