#!/usr/bin/env node
/**
 * build-archive.mjs — regenerates the issue list in archive.html from issues.json
 *
 * issues.json is the single source of truth. To publish an issue, add one entry:
 *   { "date": "2026-08-25", "docId": "<google-doc-id>" }
 * ...then run `node scripts/build-archive.mjs` (or just push — CI does it for you).
 *
 * Everything between the ARCHIVE:START / ARCHIVE:END markers in archive.html is
 * generated. Don't hand-edit that block; edit issues.json instead.
 *
 * Set GROUP_BY_MONTH = true to break the list into labelled month sections
 * (your CSS already has .month-label styling waiting for it).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://sophiastafford.github.io/disequilibrium';
const GROUP_BY_MONTH = false;

const START = '<!-- ARCHIVE:START -->';
const END = '<!-- ARCHIVE:END -->';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const fail = (msg) => { console.error(`\n  build-archive failed: ${msg}\n`); process.exit(1); };

// ---------- load + validate ----------

let issues;
try {
  issues = JSON.parse(readFileSync(join(ROOT, 'issues.json'), 'utf8'));
} catch (e) {
  fail(`could not read issues.json — ${e.message}`);
}
if (!Array.isArray(issues)) fail('issues.json must be a JSON array.');
if (issues.length === 0) fail('issues.json is empty.');

const seen = new Map();
for (const [i, it] of issues.entries()) {
  const where = `entry ${i + 1}`;
  if (!it || typeof it !== 'object') fail(`${where} is not an object.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date ?? ''))
    fail(`${where} has date "${it.date}" — must be YYYY-MM-DD.`);
  const [y, m, d] = it.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    fail(`${where} has date "${it.date}", which isn't a real calendar date.`);
  // A Google Doc ID, not a full URL — a pasted URL is the likeliest mistake here.
  if (!/^[A-Za-z0-9_-]{20,}$/.test(it.docId ?? ''))
    fail(`${where} (${it.date}) has docId "${it.docId}".\n` +
         `  Expected just the ID, e.g. 1qtimJAUQ0So45KuOlEG1lbtRE2K23ezdCk63pRp5nck\n` +
         `  From a Drive URL, that's the part between /document/d/ and /edit.`);
  if (seen.has(it.date)) fail(`two entries share the date ${it.date} — remove one.`);
  seen.set(it.date, it);
  it._dt = dt;
}

issues.sort((a, b) => b._dt - a._dt);

// ---------- render ----------

const pretty = (dt) =>
  `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;

const issueHref = (it) =>
  `issue.html?doc=${it.docId}&date=${encodeURIComponent(pretty(it._dt))}`;

const row = (it, pad) =>
  `${pad}<a class="issue" href="${issueHref(it)}">` +
  `<span class="date serif">${pretty(it._dt)}</span>` +
  `<span class="meta"><span class="label">Read issue</span>` +
  `<span class="arrow">→</span></span></a>`;

let block;
if (GROUP_BY_MONTH) {
  const groups = [];
  for (const it of issues) {
    const key = `${it._dt.getUTCFullYear()}-${it._dt.getUTCMonth()}`;
    if (!groups.length || groups.at(-1).key !== key)
      groups.push({ key, label: `${MONTHS[it._dt.getUTCMonth()]} ${it._dt.getUTCFullYear()}`, rows: [] });
    groups.at(-1).rows.push(it);
  }
  block = groups.map(g =>
    `      <div class="month">\n` +
    `        <p class="month-label">${g.label}</p>\n` +
    g.rows.map(it => row(it, '        ')).join('\n') + '\n' +
    `      </div>`
  ).join('\n\n');
} else {
  block = `      <div class="month">\n` +
          issues.map(it => row(it, '        ')).join('\n') + '\n' +
          `      </div>`;
}

// ---------- splice into archive.html ----------

const path = join(ROOT, 'archive.html');
const html = readFileSync(path, 'utf8');
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a === -1 || b === -1 || b < a)
  fail(`archive.html is missing the ${START} / ${END} markers around the issue list.`);

const next = html.slice(0, a + START.length) + '\n' + block + '\n' + '      ' + html.slice(b);

if (next !== html) {
  writeFileSync(path, next);
  console.log(`  archive.html updated — ${issues.length} issues, newest ${issues[0].date}`);
} else {
  console.log(`  archive.html already current — ${issues.length} issues`);
}

// ---------- feed.xml ----------
// Lets feed readers follow along, and gives an RSS-to-email service
// (Buttondown, Kit, Mailchimp) something to trigger on later.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const feed =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Disequilibrium</title>
    <link>${SITE}/</link>
    <description>A weekly newsletter on how AI is changing the entry-level job market.</description>
    <language>en-us</language>
    <lastBuildDate>${issues[0]._dt.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${issues.map(it => {
  const url = `${SITE}/${esc(issueHref(it))}`;
  return `    <item>
      <title>Disequilibrium — ${pretty(it._dt)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${it._dt.toUTCString()}</pubDate>
    </item>`;
}).join('\n')}
  </channel>
</rss>
`;
writeFileSync(join(ROOT, 'feed.xml'), feed);
console.log(`  feed.xml updated`);
