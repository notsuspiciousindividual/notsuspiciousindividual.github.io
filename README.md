# ~/blog

A terminal-flavored personal blog. Write Markdown, run one script, push.

## How it works

- Posts live in `posts/<slug>/index.md` with **their images in the same folder**.
- `node build.js` renders everything into `docs/`.
- GitHub Pages serves `docs/` as-is. **GitHub never runs the build** — you run it
  locally and commit the `docs/` output.

```
posts/
  hello-world/
    index.md        <- frontmatter + Markdown
    mascot.svg      <- referenced as ![](mascot.svg)
src/
  layout.html       <- page shell
  styles.css        <- the theme
  mascot.txt        <- ASCII art for home + 404
build.js            <- the builder (~180 lines, no framework)
docs/               <- GENERATED. committed. served by Pages.
```

## First-time setup

```bash
npm install
```

Then on GitHub: **Settings → Pages → Source → Deploy from a branch → `main` / `docs`**.

## Writing a post

```bash
mkdir posts/my-cool-writeup
```

Create `posts/my-cool-writeup/index.md`:

```markdown
---
title: my cool writeup
date: 10-09-2026
tags: [ctf, rev]
---

Body text. Drop images in this folder and link them by name:

![screenshot](step1.png)
```

- `date` is **DD-MM-YYYY**. Missing/bad date → shows `undated`, sorts last.
- `tags` is optional. Each tag gets a page at `/tags/<tag>/`.
- The slug (URL) is the folder name: `/posts/my-cool-writeup/`.

## Build & preview

```bash
node build.js          # writes docs/
npx serve docs          # preview at http://localhost:3000
```

## Publish

```bash
node build.js
git add -A
git commit -m "post: my cool writeup"
git push
```

Live a minute later at `https://notsuspiciousindividual.github.io/`.

## Later, if you want

Add a GitHub Action that runs `node build.js` on push so `docs/` never needs
committing. Left out on purpose — right now what you push is exactly what ships.
