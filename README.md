# disequilibrium

The website for **Disequilibrium**, a weekly newsletter on how AI is changing the
entry-level job market. Static HTML on GitHub Pages, no framework, no dependencies.

Live at <https://sophiastafford.github.io/disequilibrium/>

## Publishing an issue

Add one file — `issues/YYYY-MM-DD.md` — and push:

```markdown
---
title: The jobs coming back are the ones that check AI's work
dek: One line of standfirst. Optional.
---

## What Changed This Week

Opening section...

## Finance & Consulting

**Bold lead sentence.** Then the paragraph, with sources at the end.
([Bloomberg](https://example.com) | [NPR](https://example.com))
```

That's the whole publishing step. On push, the `Build archive` Action runs
`scripts/build-archive.mjs`, which:

- renders `issue-YYYY-MM-DD.html` from `templates/issue.template.html`
- rebuilds the issue list in `archive.html`
- regenerates `feed.xml`, including the full text of each issue

The page is live roughly thirty seconds later.

`title` and `dek` are both optional. Without a title, the issue is headed by its
date, the way every issue before the markdown switch read.

## Editing an issue after it's published

Open `issues/YYYY-MM-DD.md` in GitHub's web editor (press `.` in the repo, or click
the pencil), make the change, and commit. The page rebuilds itself.

## Unpublishing

Add `draft: true` to that issue's front matter and push. The page, the archive row
and the feed item all disappear. Delete the line to put it back.

## What's generated and what isn't

**Edit these:**

| File | What it is |
| --- | --- |
| `issues/*.md` | The issues themselves. The only thing you add each week. |
| `templates/issue.template.html` | The shell every issue page is poured into. |
| `index.html` | Home page. |
| `archive.html` | Archive page *outside* the `ARCHIVE:START/END` markers. |

**Don't hand-edit these — they're rebuilt on every push:**

`issue-YYYY-MM-DD.html` · `feed.xml` · the block between the `ARCHIVE:START` and
`ARCHIVE:END` markers in `archive.html`

## Legacy Google Doc issues

Issues before 25 August 2026 live in Google Docs and are listed in `issues.json` as
`{ "date", "docId" }` entries. They render through `issue.html`, which iframes the
Doc's preview, and their links still work. Don't add new entries there — write a
markdown file instead.

Those issues depend on their Docs staying link-shared publicly. If one is ever
un-shared it becomes a sign-in wall with no warning, so they're worth back-filling
into markdown eventually.

## Local development

```bash
node scripts/build-archive.mjs   # rebuild everything
node scripts/test.mjs            # check the markdown renderer
```

Node 20+. No `npm install` — there are no dependencies. `scripts/markdown.mjs` is a
small in-repo Markdown renderer covering what an issue actually uses. If an issue
ever needs tables, images or footnotes, that's the moment to swap it for `marked`.

The build fails loudly and refuses to write anything if an issue file is misnamed,
dated impossibly, empty, or collides with an existing date.

## Subscribers

The form on the home page posts to a Google Form. Nothing currently emails the list —
`feed.xml` carries each issue's full text so an RSS-to-email service (Buttondown, Kit,
Mailchimp) can be pointed at it when that's wanted.
