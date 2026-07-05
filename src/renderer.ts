import { marked } from "marked";
import type { Post } from "./content.js";

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(html);
}

// Tags that must never appear in rendered output because they can execute
// script or load active content.
const DANGEROUS_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "link",
  "meta",
  "base",
];

/**
 * Neutralize the most common stored-XSS vectors in `marked` output, which
 * passes raw inline HTML through untouched. This is a defense-in-depth pass:
 * it strips dangerous elements, inline event-handler attributes, and
 * `javascript:` URLs so that a malicious Markdown body cannot execute script
 * when served from a post page.
 */
export function sanitizeHtml(html: string): string {
  let out = html;

  // Remove dangerous elements together with their content.
  for (const tag of DANGEROUS_TAGS) {
    const withBody = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    out = out.replace(withBody, "");
    // Also drop any stray/self-closing or unclosed variants of the tag.
    const standalone = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    out = out.replace(standalone, "");
  }

  // Strip inline event-handler attributes (onclick, onerror, onload, ...).
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Neutralize javascript:/vbscript:/data: URLs in href/src attributes.
  out = out.replace(
    /\b(href|src)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'\s>]*("|')?/gi,
    '$1="#"'
  );

  return out;
}

export function renderPost(post: Post): string {
  const htmlContent = renderMarkdown(post.content);
  const tagsHtml = post.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(post.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .tag { background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <nav><a href="/posts">&larr; All Posts</a></nav>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="meta">
      <time>${escapeHtml(post.date)}</time>
      ${tagsHtml ? `<div style="margin-top:0.5rem">${tagsHtml}</div>` : ""}
    </div>
    <div class="content">${htmlContent}</div>
  </article>
</body>
</html>`;
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(heading)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    .meta { color: #666; font-size: 0.85rem; margin-left: 0.5rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${escapeHtml(heading)}</h1>
  <ul>${listItems}</ul>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
