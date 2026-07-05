import { describe, it, expect } from "vitest";
import { renderMarkdown, renderPost, renderPostList } from "../src/renderer.js";
import type { Post } from "../src/content.js";

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    title: "Test Post",
    date: "2026-01-01",
    tags: ["test"],
    slug: "test-post",
    content: "This is test content.",
    filePath: "/tmp/test.md",
    ...overrides,
  };
}

describe("renderMarkdown - additional cases", () => {
  it("renders links", () => {
    const html = renderMarkdown("[Click here](https://example.com)");
    expect(html).toContain('<a href="https://example.com">Click here</a>');
  });

  it("renders lists", () => {
    const html = renderMarkdown("- item one\n- item two\n- item three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item one</li>");
    expect(html).toContain("<li>item two</li>");
  });

  it("renders inline code", () => {
    const html = renderMarkdown("Use `console.log` for debugging");
    expect(html).toContain("<code>console.log</code>");
  });

  it("renders empty string", () => {
    const html = renderMarkdown("");
    expect(html).toBe("");
  });

  it("renders emphasis and strong", () => {
    const html = renderMarkdown("*italic* and **bold**");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("strips <script> tags from the body (stored XSS)", () => {
    const html = renderMarkdown('Hello <script>alert("xss")</script> world');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("strips inline event handlers from the body", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toMatch(/onerror/i);
  });

  it("neutralizes javascript: URLs", () => {
    const html = renderMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(html).not.toMatch(/javascript:/i);
  });
});

describe("renderPost - edge cases", () => {
  it("escapes HTML in title to prevent XSS", () => {
    const post = makePost({ title: '<script>alert("xss")</script>' });
    const html = renderPost(post);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in date", () => {
    const post = makePost({ date: '2026-01-01<img src=x onerror="alert(1)">' });
    const html = renderPost(post);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("escapes HTML in tags", () => {
    const post = makePost({ tags: ['<b>bold</b>', 'normal'] });
    const html = renderPost(post);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("normal");
  });

  it("handles post with no tags", () => {
    const post = makePost({ tags: [] });
    const html = renderPost(post);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain('<span class="tag">');
  });

  it("renders full HTML document structure", () => {
    const post = makePost();
    const html = renderPost(post);
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
    expect(html).toContain('<nav><a href="/posts">');
  });

  it("includes post content as rendered HTML", () => {
    const post = makePost({ content: "# Heading\n\nParagraph text." });
    const html = renderPost(post);
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<p>Paragraph text.</p>");
  });
});

describe("renderPostList", () => {
  it("renders a list of posts with links", () => {
    const posts = [
      makePost({ title: "Post A", slug: "post-a", date: "2026-03-01" }),
      makePost({ title: "Post B", slug: "post-b", date: "2026-02-01" }),
    ];
    const html = renderPostList(posts, "All Posts");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<h1>All Posts</h1>");
    expect(html).toContain('<a href="/posts/post-a">Post A</a>');
    expect(html).toContain('<a href="/posts/post-b">Post B</a>');
    expect(html).toContain("2026-03-01");
    expect(html).toContain("2026-02-01");
  });

  it("renders an empty list", () => {
    const html = renderPostList([], "No Posts");
    expect(html).toContain("<h1>No Posts</h1>");
    expect(html).toContain("<ul></ul>");
  });

  it("escapes HTML in heading", () => {
    const html = renderPostList([], '<script>alert("xss")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in post titles", () => {
    const posts = [makePost({ title: '<img src=x onerror="hack">', slug: "bad" })];
    const html = renderPostList(posts, "List");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("URL-encodes slugs with special characters", () => {
    const posts = [makePost({ title: "Special Post", slug: "hello world" })];
    const html = renderPostList(posts, "Posts");
    expect(html).toContain("/posts/hello%20world");
  });

  it("escapes HTML in dates", () => {
    const posts = [makePost({ date: '<script>bad</script>' })];
    const html = renderPostList(posts, "Posts");
    expect(html).not.toContain("<script>bad</script>");
    expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
  });

  it("renders proper HTML structure", () => {
    const html = renderPostList([], "Title");
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
  });
});
