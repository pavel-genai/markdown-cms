import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createPostStore } from "../src/content.js";

describe("PostStore - additional coverage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cms-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("derives slug from filename when slug is missing in frontmatter", () => {
    const filePath = path.join(tmpDir, "My Test Post.md");
    fs.writeFileSync(
      filePath,
      `---
title: My Title
date: "2026-01-01"
tags:
  - test
---

Content here.
`
    );
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    expect(post!.slug).toBe("my-test-post");
  });

  it("derives title from filename when title is missing in frontmatter", () => {
    const filePath = path.join(tmpDir, "my-derived-title.md");
    fs.writeFileSync(
      filePath,
      `---
date: "2026-01-01"
slug: my-slug
---

No title in frontmatter.
`
    );
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    expect(post!.title).toBe("my-derived-title");
  });

  it("uses current date when date is missing in frontmatter", () => {
    const filePath = path.join(tmpDir, "no-date.md");
    fs.writeFileSync(
      filePath,
      `---
title: No Date Post
slug: no-date
---

No date field.
`
    );
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    // Date should be an ISO string from today
    expect(post!.date).toBeTruthy();
    expect(new Date(post!.date).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("handles tags that are not an array", () => {
    const filePath = path.join(tmpDir, "bad-tags.md");
    fs.writeFileSync(
      filePath,
      `---
title: Bad Tags Post
date: "2026-01-01"
slug: bad-tags
tags: "not-an-array"
---

Content.
`
    );
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    expect(post!.tags).toEqual([]);
  });

  it("returns null for non-existent file", () => {
    const store = createPostStore(tmpDir);
    const post = store.loadFile(path.join(tmpDir, "nonexistent.md"));
    expect(post).toBeNull();
  });

  it("returns null for unreadable file path", () => {
    const store = createPostStore(tmpDir);
    const post = store.loadFile("/totally/fake/path/file.md");
    expect(post).toBeNull();
  });

  it("removeFile removes a previously loaded post", () => {
    const filePath = path.join(tmpDir, "to-remove.md");
    fs.writeFileSync(
      filePath,
      `---
title: To Remove
date: "2026-01-01"
slug: to-remove
tags: []
---

Will be removed.
`
    );
    const store = createPostStore(tmpDir);
    store.loadFile(filePath);
    expect(store.getAll().length).toBe(1);
    store.removeFile(filePath);
    expect(store.getAll().length).toBe(0);
  });

  it("removeFile is safe for non-existent key", () => {
    const store = createPostStore(tmpDir);
    store.removeFile("/does/not/exist.md");
    expect(store.getAll().length).toBe(0);
  });

  it("loadAll clears existing posts before reloading", () => {
    const filePath = path.join(tmpDir, "post1.md");
    fs.writeFileSync(
      filePath,
      `---
title: Post One
date: "2026-01-01"
slug: post-one
tags: []
---

Content.
`
    );
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getAll().length).toBe(1);

    // Delete file and reload
    fs.unlinkSync(filePath);
    store.loadAll();
    expect(store.getAll().length).toBe(0);
  });

  it("loadAll ignores non-markdown files", () => {
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "not markdown");
    fs.writeFileSync(path.join(tmpDir, "data.json"), '{"key":"val"}');
    fs.writeFileSync(
      path.join(tmpDir, "real.md"),
      `---
title: Real
date: "2026-01-01"
slug: real
tags: []
---

Markdown.
`
    );
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getAll().length).toBe(1);
    expect(store.getAll()[0].slug).toBe("real");
  });

  it("getBySlug returns undefined for non-existent slug", () => {
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getBySlug("nope")).toBeUndefined();
  });

  it("getByTag is case-insensitive", () => {
    const filePath = path.join(tmpDir, "tagged.md");
    fs.writeFileSync(
      filePath,
      `---
title: Tagged Post
date: "2026-01-01"
slug: tagged
tags:
  - JavaScript
---

Content.
`
    );
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getByTag("javascript").length).toBe(1);
    expect(store.getByTag("JAVASCRIPT").length).toBe(1);
    expect(store.getByTag("JavaScript").length).toBe(1);
  });

  it("getByTag returns empty array for unknown tag", () => {
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getByTag("unknown")).toEqual([]);
  });

  it("getBySlug reflects removeFile (slug index is kept in sync)", () => {
    const filePath = path.join(tmpDir, "removable.md");
    fs.writeFileSync(
      filePath,
      `---
title: Removable
date: "2026-01-01"
slug: removable
tags:
  - temp
---
Body.
`
    );
    const store = createPostStore(tmpDir);
    store.loadAll();
    expect(store.getBySlug("removable")).toBeDefined();
    expect(store.getByTag("temp").length).toBe(1);

    store.removeFile(filePath);
    expect(store.getBySlug("removable")).toBeUndefined();
    expect(store.getByTag("temp")).toEqual([]);
  });

  it("getBySlug reflects a reload that changes slug and tags", () => {
    const filePath = path.join(tmpDir, "mutable.md");
    fs.writeFileSync(
      filePath,
      `---
title: Mutable
date: "2026-01-01"
slug: old-slug
tags:
  - old
---
Body.
`
    );
    const store = createPostStore(tmpDir);
    store.loadFile(filePath);
    expect(store.getBySlug("old-slug")).toBeDefined();
    expect(store.getByTag("old").length).toBe(1);

    // Rewrite the file with a new slug and tag, then reload the same path.
    fs.writeFileSync(
      filePath,
      `---
title: Mutable
date: "2026-01-01"
slug: new-slug
tags:
  - new
---
Body.
`
    );
    store.loadFile(filePath);
    expect(store.getBySlug("old-slug")).toBeUndefined();
    expect(store.getBySlug("new-slug")).toBeDefined();
    expect(store.getByTag("old")).toEqual([]);
    expect(store.getByTag("new").length).toBe(1);
  });

  it("handles frontmatter-only file with no content body", () => {
    const filePath = path.join(tmpDir, "empty-body.md");
    fs.writeFileSync(
      filePath,
      `---
title: Empty Body
date: "2026-01-01"
slug: empty-body
tags: []
---
`
    );
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    expect(post!.content.trim()).toBe("");
  });

  it("handles completely empty file", () => {
    const filePath = path.join(tmpDir, "empty.md");
    fs.writeFileSync(filePath, "");
    const store = createPostStore(tmpDir);
    const post = store.loadFile(filePath);
    expect(post).not.toBeNull();
    // gray-matter handles empty files with defaults
    expect(post!.title).toBe("empty");
    expect(post!.tags).toEqual([]);
  });
});
