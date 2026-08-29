#!/usr/bin/env node
/**
 * test.mjs — checks on the markdown renderer. Run with `node scripts/test.mjs`.
 * These are the cases that have actually bitten: emphasis eating link attributes,
 * "$" being read as a regex substitution, raw HTML in a draft.
 */
import { markdownToHtml, frontMatter, plainText } from './markdown.mjs';

let failures = 0;
const check = (name, actual, predicate, expectation) => {
  const ok = typeof predicate === 'function' ? predicate(actual) : actual === predicate;
  if (ok) { console.log(`  ok    ${name}`); return; }
  failures++;
  console.log(`  FAIL  ${name}`);
  console.log(`        expected ${expectation ?? JSON.stringify(predicate)}`);
  console.log(`        actual   ${JSON.stringify(actual)}`);
};
const has = (s) => (out) => out.includes(s);
const lacks = (s) => (out) => !out.includes(s);

console.log('\nmarkdown renderer\n');

// The bug that shipped first time round: two links in one paragraph, and the
// underscores in target="_blank" get read as italic markers.
check('two links keep their attributes intact',
  markdownToHtml('See ([A](https://a.com/x) | [B](https://b.com/y)) today.'),
  (o) => (o.match(/target="_blank"/g) || []).length === 2, 'two intact target="_blank"');

check('underscores in a URL survive',
  markdownToHtml('[x](https://e.com/a_b_c_d)'),
  has('href="https://e.com/a_b_c_d"'));

check('bold renders', markdownToHtml('**lead.** rest'), has('<strong>lead.</strong>'));
check('italic renders', markdownToHtml('an *emphatic* word'), has('<em>emphatic</em>'));
check('bold inside a sentence with underscores elsewhere',
  markdownToHtml('**A** then snake_case_word here'),
  (o) => o.includes('<strong>A</strong>') && !o.includes('<em>'));

check('raw HTML in a draft is escaped, not executed',
  markdownToHtml('<script>alert(1)</script>'),
  (o) => o.includes('&lt;script&gt;') && !o.includes('<script>'));

check('javascript: URLs are neutered',
  markdownToHtml('[click](javascript:alert(1))'),
  (o) => o.includes('href="#"') && !o.toLowerCase().includes('javascript:'));

// "$" must survive verbatim — it is a substitution character in String.replace,
// so a mishandled render turns "$&" into the whole matched string.
check('dollar sequences pass through untouched',
  markdownToHtml("A salary of $85,000 and a $& and a $' and $1."),
  (o) => o.includes('$85,000') && o.includes('$&amp;') && o.includes('$&#39;') && o.includes('$1.'),
  'dollar amounts and $&, $\', $1 all intact (HTML-escaped)');

check('code spans are not re-parsed',
  markdownToHtml('use `**not bold**` here'),
  (o) => o.includes('<code>**not bold**</code>') && !o.includes('<strong>'));

check('headings get ids', markdownToHtml('## Finance & Consulting'),
  has('<h2 id="finance-consulting">Finance &amp; Consulting</h2>'));

check('unordered list', markdownToHtml('- one\n- two'),
  (o) => o.includes('<ul>') && (o.match(/<li>/g) || []).length === 2);

check('ordered list', markdownToHtml('1. one\n2. two'), has('<ol>'));

check('blockquote', markdownToHtml('> quoted line'),
  (o) => o.includes('<blockquote>') && o.includes('<p>quoted line</p>'));

check('horizontal rule', markdownToHtml('a\n\n---\n\nb'), has('<hr>'));
check('a list dash is not a rule', markdownToHtml('- item'), lacks('<hr>'));

check('paragraphs split on blank lines',
  markdownToHtml('one\n\ntwo'),
  (o) => (o.match(/<p>/g) || []).length === 2);

check('no placeholder leakage',
  markdownToHtml('`code` and [l](https://x.com) and **b**'),
  (o) => !o.includes('code-span:') && !o.includes('a-tag:'));

console.log('\nfront matter\n');

const fm = frontMatter('---\ntitle: A "quoted" headline\ndraft: true\ndek: Some line.\n---\n\nBody text.');
check('title parsed', fm.data.title, 'A "quoted" headline');
check('draft becomes a boolean', fm.data.draft, true);
check('body separated', fm.body, 'Body text.');
check('no front matter is fine', frontMatter('Just body.').body, 'Just body.');

check('plainText strips markup',
  plainText('## Head\n\n**Bold** and [link](https://x.com) and `code`.'),
  'Head Bold and link and code.');

console.log(failures ? `\n${failures} failing\n` : '\nall passing\n');
process.exit(failures ? 1 : 0);
