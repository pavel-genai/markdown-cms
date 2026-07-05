import { marked } from "marked";
import type { Post } from "./content.js";

export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

// Base styles shared by every page. Page-specific rules are appended via the
// `extraStyles` argument to `layout`.
const BASE_STYLES = `
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .tag { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
    a { color: #2563eb; }`;

/**
 * Emit the shared HTML document shell: doctype, head with meta tags and
 * styles, and body wrapper. `bodyHtml` is inserted verbatim inside <body>.
 */
export function layout(
  title: string,
  bodyHtml: string,
  extraStyles = ""
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${BASE_STYLES}${extraStyles}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function renderPost(post: Post): string {
  const htmlContent = renderMarkdown(post.content);
  const tagsHtml = post.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join(" ");

  const body = `  <nav><a href="/posts">&larr; All Posts</a></nav>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="meta">
      <time>${escapeHtml(post.date)}</time>
      ${tagsHtml ? `<div style="margin-top:0.5rem">${tagsHtml}</div>` : ""}
    </div>
    <div class="content">${htmlContent}</div>
  </article>`;

  return layout(post.title, body);
}

export function renderPostList(posts: Post[], heading: string): string {
  const listItems = posts
    .map(
      (p) =>
        `<li>
      <a href="/posts/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a>
      <span class="meta">${escapeHtml(p.date)}</span>
    </li>`
    )
    .join("\n");

  const extraStyles = `
    .meta { color: #666; font-size: 0.85rem; margin-left: 0.5rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    a { text-decoration: none; }
    a:hover { text-decoration: underline; }`;

  const body = `  <h1>${escapeHtml(heading)}</h1>
  <ul>${listItems}</ul>`;

  return layout(heading, body, extraStyles);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
