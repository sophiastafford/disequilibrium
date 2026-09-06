# disequilibrium

The site for Disequilibrium, a weekly newsletter about AI and the entry-level job
market. Static HTML on GitHub Pages. No framework, no dependencies.

https://sophiastafford.github.io/disequilibrium/

## Publishing an issue

Add a file called `issues/YYYY-MM-DD.md` and push it.

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

Pushing kicks off the Build archive action, which renders
`issue-YYYY-MM-DD.html`, updates the list on the archive page, and rewrites
`feed.xml`. The page is usually live inside a minute.

`title` and `dek` are both optional and neither shows up on the page, which uses
the Disequilibrium masthead and the issue date instead. They set the browser tab,
the preview card when someone shares the link, and the item title in the feed.

## Editing an issue that's already up

Open `issues/YYYY-MM-DD.md` on GitHub, click the pencil, change it, commit. The
page rebuilds itself.

## Taking an issue down

Put `draft: true` in its front matter and push. The page, the archive row and the
feed item all disappear. Delete the line to bring it back.

## Which files to edit

Edit `issues/*.md`, `templates/issue.template.html`, `index.html`, and any part of
`archive.html` outside the `ARCHIVE:START` / `ARCHIVE:END` markers.

Leave `issue-YYYY-MM-DD.html`, `feed.xml` and everything between those markers
alone. They get rewritten on every push.

## Weekly run

A scheduled task fires Monday at 7pm Eastern. It researches the past week, drafts
the issue, and commits it here dated Tuesday. It only works if the laptop holding
the AI Newsletter folder is awake, since the whole pipeline reads and writes there.
A second task checks the site on Tuesday morning and says something if the issue
never arrived.

## Older issues

Everything before 25 August 2026 lives in a Google Doc. Those are listed in
`issues.json` as `{"date", "docId"}` pairs and render through `issue.html`, which
embeds the Doc in an iframe. Old links still work. Don't add new entries there.

They do depend on each Doc staying shared publicly. If one gets unshared it turns
into a sign-in wall and nothing warns you, so they're worth converting to markdown
eventually.

## Running it locally

```bash
node scripts/build-archive.mjs   # rebuild everything
node scripts/test.mjs            # check the markdown renderer
```

Node 20 or later. There's no `npm install` because there's nothing to install.
`scripts/markdown.mjs` is a small markdown renderer covering what the issues
actually use. Swap it for `marked` if an issue ever needs tables or images.

The build stops and changes nothing if an issue file has a bad name, an impossible
date, no content, or a date some other issue already has.

## Subscribers

The form on the home page posts to a Google Form.
