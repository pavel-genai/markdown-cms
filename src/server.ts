import express from "express";
import type { PostStore } from "./content.js";
import type { SearchIndex } from "./search.js";
import { renderPost, renderPostList } from "./renderer.js";

export function createApp(store: PostStore, searchIndex: SearchIndex) {
  const app = express();

  // List all posts
  app.get("/posts", (_req, res) => {
    const posts = store.getAll();
    res.type("html").send(renderPostList(posts, "All Posts"));
  });

  // Search posts
  app.get("/search", (req, res) => {
    const q = (req.query.q as string) ?? "";
    if (!q.trim()) {
      res.type("html").send(renderPostList([], `Search results for ""`));
      return;
    }
    const results = searchIndex.search(q);
    res.type("html").send(renderPostList(results, `Search results for "${q}"`));
  });

  // Posts by tag
  app.get("/tags/:tag", (req, res) => {
    const tag = req.params.tag;
    const posts = store.getByTag(tag);
    res
      .type("html")
      .send(renderPostList(posts, `Posts tagged "${tag}"`));
  });

  // Single post by slug
  app.get("/posts/:slug", (req, res) => {
    const post = store.getBySlug(req.params.slug);
    if (!post) {
      res.status(404).type("html").send("<h1>Post not found</h1>");
      return;
    }
    res.type("html").send(renderPost(post));
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "markdown-cms" });
  });

  // Root redirect
  app.get("/", (_req, res) => {
    res.redirect("/posts");
  });

  return app;
}
