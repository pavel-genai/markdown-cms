import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import type { PostStore } from "../src/content.js";
import type { SearchIndex } from "../src/search.js";
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

function createMockStore(posts: Post[]): PostStore {
  const postsMap = new Map(posts.map((p) => [p.filePath, p]));
  return {
    posts: postsMap,
    loadAll: () => {},
    loadFile: () => null,
    removeFile: () => {},
    getAll: () =>
      [...posts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    getBySlug: (slug: string) => posts.find((p) => p.slug === slug),
    getByTag: (tag: string) =>
      posts.filter((p) =>
        p.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
      ),
  };
}

function createMockSearchIndex(resultPosts: Post[] = []): SearchIndex {
  return {
    rebuild: () => {},
    search: () => resultPosts,
  };
}

describe("Express App", () => {
  let posts: Post[];
  let store: PostStore;
  let searchIndex: SearchIndex;

  beforeEach(() => {
    posts = [
      makePost({
        title: "First Post",
        slug: "first-post",
        date: "2026-01-01",
        tags: ["alpha"],
        content: "First content",
      }),
      makePost({
        title: "Second Post",
        slug: "second-post",
        date: "2026-02-01",
        tags: ["beta", "alpha"],
        content: "Second content",
      }),
    ];
    store = createMockStore(posts);
    searchIndex = createMockSearchIndex();
  });

  describe("GET /", () => {
    it("redirects to /posts", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/posts");
    });
  });

  describe("GET /posts", () => {
    it("returns HTML listing all posts", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/posts");
      expect(res.status).toBe(200);
      expect(res.type).toBe("text/html");
      expect(res.text).toContain("All Posts");
      expect(res.text).toContain("First Post");
      expect(res.text).toContain("Second Post");
    });

    it("returns HTML even with no posts", async () => {
      store = createMockStore([]);
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/posts");
      expect(res.status).toBe(200);
      expect(res.text).toContain("All Posts");
    });
  });

  describe("GET /posts/:slug", () => {
    it("returns rendered post for a valid slug", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/posts/first-post");
      expect(res.status).toBe(200);
      expect(res.type).toBe("text/html");
      expect(res.text).toContain("First Post");
      expect(res.text).toContain("<!DOCTYPE html>");
    });

    it("returns 404 for unknown slug", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/posts/nonexistent");
      expect(res.status).toBe(404);
      expect(res.text).toContain("Post not found");
    });
  });

  describe("GET /search", () => {
    it("returns search results for a query", async () => {
      searchIndex = createMockSearchIndex([posts[0]]);
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/search?q=first");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Search results for");
      expect(res.text).toContain("first");
    });

    it("returns empty results for blank query", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/search?q=");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Search results for &quot;&quot;");
    });

    it("handles missing q parameter", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/search");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Search results for &quot;&quot;");
    });

    it("handles whitespace-only query", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/search?q=%20%20%20");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Search results for &quot;&quot;");
    });
  });

  describe("GET /health", () => {
    it("returns JSON health status", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.type).toBe("application/json");
      expect(res.text).toBe('{"status":"ok","service":"markdown-cms"}');
    });
  });

  describe("GET /tags/:tag", () => {
    it("returns posts filtered by tag", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/tags/alpha");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Posts tagged &quot;alpha&quot;");
      expect(res.text).toContain("First Post");
      expect(res.text).toContain("Second Post");
    });

    it("returns empty list for unknown tag", async () => {
      const app = createApp(store, searchIndex);
      const res = await request(app).get("/tags/nonexistent");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Posts tagged &quot;nonexistent&quot;");
    });
  });
});
