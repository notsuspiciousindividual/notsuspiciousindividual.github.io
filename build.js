/* Tiny static-site builder.
 *
 * Reads posts/<slug>/index.md  ->  writes docs/
 *
 * - Each post folder owns its images. Every non-.md file in posts/<slug>/
 *   is copied verbatim to docs/posts/<slug>/, so `![](pic.png)` just works.
 * - Dates are DD-MM-YYYY in frontmatter and in the output.
 *
 * GitHub Pages only serves the files in docs/. It never runs this script.
 * Run `node build.js` yourself, then commit docs/.
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const hljs = require("highlight.js");
const MarkdownIt = require("markdown-it");

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, "posts");
const SRC_DIR = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "docs");

const SITE_TITLE = "~/blog";
const FOOTER = "compiled by a not-so-suspicious individual · no cookies, no tracking, no idea what i'm doing";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          "</code></pre>";
      } catch (_) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + "</code></pre>";
  },
});

// ---------- helpers ----------

const read = (p) => fs.readFileSync(p, "utf8");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDirFiltered(from, to, skip) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirFiltered(src, dst, skip);
    else if (!skip(entry.name)) fs.copyFileSync(src, dst);
  }
}

// DD-MM-YYYY -> Date (or null). Accepts a real Date too (gray-matter may parse it).
function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(v || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d) ? null : d;
}

function fmtDate(d) {
  if (!d) return "undated";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function slugifyTag(t) {
  return String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------- template ----------

const LAYOUT = read(path.join(SRC_DIR, "layout.html"));

function page({ title, prompt, body, depth, base }) {
  base = base || "../".repeat(depth) || "./";
  return LAYOUT
    .replace(/{{base}}/g, base)
    .replace(/{{title}}/g, esc(title))
    .replace(/{{site_title}}/g, esc(SITE_TITLE))
    .replace(/{{prompt}}/g, esc(prompt))
    .replace(/{{footer}}/g, esc(FOOTER))
    .replace(/{{content}}/, body);
}

function tagChips(tags, depth) {
  if (!tags.length) return "";
  const base = "../".repeat(depth) || "./";
  return '<span class="tags">' + tags.map((t) =>
    `<a class="tag" href="${base}tags/${slugifyTag(t)}/">--${esc(t)}</a>`
  ).join(" ") + "</span>";
}

function postList(posts, depth) {
  if (!posts.length) {
    return '<p class="empty">no posts yet — the void stares back.</p>';
  }
  const base = "../".repeat(depth) || "./";
  const rows = posts.map((p) => `  <li>
    <a class="post-link" href="${base}posts/${esc(p.slug)}/">${esc(p.title)}</a>
    <span class="meta">${esc(fmtDate(p.date))}</span>
    ${tagChips(p.tags, depth)}
  </li>`).join("\n");
  return `<ul class="post-list">\n${rows}\n</ul>`;
}

// ---------- build ----------

const MASCOT = fs.existsSync(path.join(SRC_DIR, "mascot.txt"))
  ? read(path.join(SRC_DIR, "mascot.txt")).replace(/\s+$/, "")
  : "";

function mascotBlock() {
  return MASCOT ? `<pre class="mascot" aria-hidden="true">${esc(MASCOT)}</pre>` : "";
}

rmrf(OUT_DIR);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.copyFileSync(path.join(SRC_DIR, "styles.css"), path.join(OUT_DIR, "styles.css"));
if (fs.existsSync(path.join(SRC_DIR, "CNAME"))) {
  fs.copyFileSync(path.join(SRC_DIR, "CNAME"), path.join(OUT_DIR, "CNAME"));
}

const postDirs = fs.existsSync(POSTS_DIR)
  ? fs.readdirSync(POSTS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())
  : [];

const posts = [];

for (const dir of postDirs) {
  const slug = dir.name;
  const folder = path.join(POSTS_DIR, slug);
  const mdPath = path.join(folder, "index.md");
  if (!fs.existsSync(mdPath)) {
    console.warn(`  skip  posts/${slug} (no index.md)`);
    continue;
  }

  const { data, content } = matter(read(mdPath));
  const title = data.title || slug;
  const date = parseDate(data.date);
  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : data.tags ? [String(data.tags)] : [];

  const html = md.render(content);
  const outFolder = path.join(OUT_DIR, "posts", slug);

  // copy the post's own assets (everything except the markdown source)
  copyDirFiltered(folder, outFolder, (name) => name.toLowerCase() === "index.md");

  const body = `<article class="post">
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(fmtDate(date))}${tags.length ? " · " + tagChips(tags, 2) : ""}</p>
  ${html}
  <p class="backlink"><a href="../../">cd ..</a></p>
</article>`;

  fs.writeFileSync(path.join(outFolder, "index.html"), page({
    title: `${title} · ${SITE_TITLE}`,
    prompt: `cat posts/${slug}/index.md`,
    body,
    depth: 2,
  }));

  posts.push({ slug, title, date, tags });
}

// newest first; undated sinks to the bottom
posts.sort((a, b) => (b.date?.getTime() || -Infinity) - (a.date?.getTime() || -Infinity));

// home
fs.writeFileSync(path.join(OUT_DIR, "index.html"), page({
  title: SITE_TITLE,
  prompt: "ls posts/",
  body: `${mascotBlock()}\n<p class="tagline">thoughts, writeups, and half-finished projects.</p>\n${postList(posts, 0)}`,
  depth: 0,
}));

// tag pages
const tagMap = new Map();
for (const p of posts) {
  for (const t of p.tags) {
    const s = slugifyTag(t);
    if (!s) continue;
    if (!tagMap.has(s)) tagMap.set(s, { label: t, posts: [] });
    tagMap.get(s).posts.push(p);
  }
}
for (const [s, { label, posts: tagged }] of tagMap) {
  const dir = path.join(OUT_DIR, "tags", s);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page({
    title: `--${label} · ${SITE_TITLE}`,
    prompt: `grep -rl --tags=${label} posts/`,
    body: `<p class="tagline">posts tagged <span class="tag">--${esc(label)}</span></p>\n${postList(tagged, 2)}\n<p class="backlink"><a href="../../">cd ..</a></p>`,
    depth: 2,
  }));
}

// 404
fs.writeFileSync(path.join(OUT_DIR, "404.html"), page({
  title: `404 · ${SITE_TITLE}`,
  prompt: "cd /dev/null",
  body: `${mascotBlock()}\n<h1>404</h1>\n<p class="tagline">this page compiled successfully in an alternate universe. not this one.</p>\n<p class="backlink"><a href="/">cd ~</a></p>`,
  base: "/",
}));

console.log(`built ${posts.length} post(s), ${tagMap.size} tag(s) -> docs/`);
