/**
 * markdown.mjs — a small, dependency-free Markdown renderer.
 *
 * Deliberately not a full CommonMark implementation. It covers exactly what a
 * Disequilibrium issue uses: headings, paragraphs, bold, italic, links, lists,
 * blockquotes, horizontal rules and inline code. Keeping it in-repo means the
 * build has zero npm dependencies — CI stays a bare `node scripts/build-archive.mjs`,
 * there's no package.json or lockfile to maintain, and nothing to audit.
 *
 * If an issue ever needs tables, images or footnotes, that's the moment to swap
 * this out for `marked` — not before.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Anything that isn't plainly a web link, a mail link or a same-site path gets
// neutered. Guards against a `javascript:` URL sneaking in through a draft.
const SAFE = /^(https?:|mailto:|#|\/|\.\/|[\w.-]+\.html)/i;
const safeHref = (url) => (SAFE.test(url.trim()) ? url.trim() : '#');
const isExternal = (url) => /^https?:/i.test(url.trim());

export const slug = (s) =>
  s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);

/** Strip markdown down to plain text — used for <meta> descriptions and feed summaries. */
export const plainText = (md) =>
  String(md)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function inline(text) {
  const code = [];
  let out = escapeHtml(text);

  // Pull code spans out first so their contents are never re-parsed as markup.
  // Escaping has already turned any real "<" into "&lt;", so an angle bracket
  // at this point can only be one we put there — the placeholder is unambiguous.
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code-span:${code.push(c) - 1}>`);

  // Opening tags are parked as placeholders too. Otherwise the emphasis pass
  // below sees the underscores in `target="_blank"` — and the ones in URLs —
  // as italic markers and shreds them.
  const tags = [];
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = safeHref(url);
    const attrs = isExternal(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a-tag:${tags.push(`<a href="${href}"${attrs}>`) - 1}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');

  // Two trailing spaces = hard line break, as in every other markdown dialect.
  out = out.replace(/ {2,}\n/g, '<br>\n');

  out = out.replace(/<a-tag:(\d+)>/g, (_, i) => tags[i]);
  return out.replace(/<code-span:(\d+)>/g, (_, i) => `<code>${code[i]}</code>`);
}

const HR = /^\s*([-*_])\s*(\1\s*){2,}$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^\s*>/;
const UL = /^\s*[-*+]\s+/;
const OL = /^\s*\d+[.)]\s+/;

const startsBlock = (line) =>
  HR.test(line) || HEADING.test(line) || QUOTE.test(line) || UL.test(line) || OL.test(line);

export function markdownToHtml(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (HR.test(line)) { out.push('<hr>'); i++; continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      const text = heading[2].replace(/\s+#+\s*$/, '');
      const level = heading[1].length;
      out.push(`<h${level} id="${slug(text)}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const buf = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>\n${markdownToHtml(buf.join('\n'))}\n</blockquote>`);
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      const ordered = OL.test(line);
      const marker = ordered ? OL : UL;
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && marker.test(lines[i])) {
        let text = lines[i].replace(marker, '');
        i++;
        // Lazy continuation: a plain line under an item belongs to that item.
        while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
          text += '\n' + lines[i].trim();
          i++;
        }
        items.push(`  <li>${inline(text)}</li>`);
      }
      out.push(`<${tag}>\n${items.join('\n')}\n</${tag}>`);
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join('\n'))}</p>`);
  }

  return out.join('\n');
}

/**
 * Splits `---`-delimited front matter off the top of a file.
 * Values are plain strings; `true`/`false` become booleans.
 * Returns { data, body }.
 */
export function frontMatter(raw) {
  const text = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text.trim() };

  const data = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^["'](.*)["']$/, '$1');
    if (value === 'true') data[key] = true;
    else if (value === 'false') data[key] = false;
    else data[key] = value;
  }
  return { data, body: text.slice(match[0].length).trim() };
}
