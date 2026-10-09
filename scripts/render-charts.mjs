#!/usr/bin/env node
// 渲染 Profile 图表：语言分布 + 提交日历热力图
// 零第三方依赖，纯手写 SVG，保证在国内网络下也能直接显示
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , langsPath, calendarPath, outDir] = process.argv;
const here = dirname(fileURLToPath(import.meta.url));
const out = outDir ?? join(here, "..", "charts");

const COLORS = {
  bg: "transparent",
  text: "#E2E8F0",
  dim: "#94A3B8",
  accent: "#22D3EE",
  accent2: "#A78BFA",
  bar: ["#22D3EE", "#38BDF8", "#818CF8", "#A78BFA", "#C084FC", "#E879F9", "#F472B6", "#FB7185"],
  // GitHub contributions heatmap 四级配色
  cal0: "#1E293B",
  cal1: "#0E7490",
  cal2: "#06B6D4",
  cal3: "#67E8F9",
  cal4: "#CFFAFE",
};
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------------------------- languages --------------------------------- */
function renderLangs(data) {
  const W = 448;
  const rowH = 30;
  const H = 40 + data.langs.length * rowH + 20;
  const barX = 130;
  const barW = W - barX - 70;

  let rows = "";
  data.langs.forEach((l, i) => {
    const w = Math.max(2, (l.pct / 100) * barW);
    const y = 34 + i * rowH;
    const color = COLORS.bar[i % COLORS.bar.length];
    rows += `
      <g transform="translate(0,${y})">
        <text x="0" y="18" fill="${COLORS.text}" font-family="${FONT}" font-size="13" font-weight="600">${esc(l.lang)}</text>
        <rect x="${barX}" y="7" width="${barW}" height="14" rx="7" fill="rgba(30,41,59,0.7)"/>
        <rect x="${barX}" y="7" width="${w}" height="14" rx="7" fill="${color}">
          <animate attributeName="width" from="0" to="${w}" dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1"/>
        </rect>
        <text x="${W - 2}" y="18" text-anchor="end" fill="${COLORS.dim}" font-family="${FONT}" font-size="12">${l.pct.toFixed(1)}%</text>
      </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Language distribution">
  <style>@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}</style>
  <title>Language distribution</title>
  <text x="0" y="14" fill="${COLORS.accent}" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="0.6">MOST USED LANGUAGES</text>
  ${rows}
</svg>`;
}

/* --------------------------------- calendar --------------------------------- */
function renderCalendar(data) {
  const days = data.days;
  const W = 448;
  const cell = 11;
  const gap = 3;
  const labelW = 28;
  const weeks = Math.ceil(days.length / 7);
  const cols = Math.min(weeks, 22); // 只显示最近 22 周，避免太宽
  const start = Math.max(0, days.length - cols * 7);
  const shown = days.slice(start);

  const gridW = cols * (cell + gap);
  const H = labelW + Math.ceil(shown.length / cols) * (cell + gap) + 34;

  let cells = "";
  shown.forEach((d, i) => {
    // 直接用 weekday 排布，GitHub 的 weeks 数组本身按周组织
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = labelW + c * (cell + gap);
    const y = labelW + r * (cell + gap);
    const lvl = Number(d.contributionLevel) || 0;
    const color = [COLORS.cal0, COLORS.cal1, COLORS.cal2, COLORS.cal3, COLORS.cal4][Math.min(lvl, 4)];
    const cnt = d.contributionCount || 0;
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${color}"><title>${esc(d.date)}: ${cnt} contribution${cnt === 1 ? "" : "s"}</title></rect>`;
  });

  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const seen = new Set();
  let labels = "";
  shown.forEach((d, i) => {
    const dt = new Date(d.date + "T00:00:00Z");
    const m = dt.getUTCMonth();
    if (dt.getUTCDate() <= 7 && !seen.has(m)) {
      seen.add(m);
      const c = i % cols;
      const x = labelW + c * (cell + gap);
      labels += `<text x="${x}" y="12" fill="${COLORS.dim}" font-family="${FONT}" font-size="10">${monthLabels[m]}</text>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution graph">
  <title>Contribution graph</title>
  <text x="0" y="12" fill="${COLORS.accent}" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="0.6">${cols} WEEKS OF CONTRIBUTIONS</text>
  <g>${labels}</g>
  <g>${cells}</g>
  <g font-family="${FONT}" font-size="10" fill="${COLORS.dim}">
    <text x="${W - 78}" y="${H - 10}">Less</text>
    ${[0, 1, 2, 3, 4].map((l, i) => `<rect x="${W - 46 + i * 10}" y="${H - 19}" width="9" height="9" rx="2" fill="${[COLORS.cal0, COLORS.cal1, COLORS.cal2, COLORS.cal3, COLORS.cal4][l]}"/>`).join("")}
    <text x="${W - 2}" y="${H - 10}">More</text>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
mkdirSync(out, { recursive: true });
const langsData = JSON.parse(readFileSync(langsPath, "utf8"));
const calData = JSON.parse(readFileSync(calendarPath, "utf8"));
writeFileSync(join(out, "langs.svg"), renderLangs(langsData));
writeFileSync(join(out, "calendar.svg"), renderCalendar(calData));
console.log(`wrote charts/lang.svg (${langsData.langs.length} langs) and charts/calendar.svg (${calData.days.length} days)`);