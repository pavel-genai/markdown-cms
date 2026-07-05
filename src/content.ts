import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface Post {
  title: string;
  date: string;
  tags: string[];
  slug: string;
  content: string;
  filePath: string;
}

export interface PostStore {
  posts: Map<string, Post>;
  loadAll(): void;
  loadFile(filePath: string): Post | null;
  removeFile(filePath: string): void;
  getAll(): Post[];
  getBySlug(slug: string): Post | undefined;
  getByTag(tag: string): Post[];
}

export function createPostStore(contentDir: string): PostStore {
  const posts = new Map<string, Post>();
  // Secondary indexes so the hot read paths avoid O(n) scans:
  //   bySlug: slug -> filePath (O(1) getBySlug)
  //   byTag:  lowercased tag -> set of filePaths (O(matches) getByTag)
  const bySlug = new Map<string, string>();
  const byTag = new Map<string, Set<string>>();

  // Remove a filePath's contributions from the secondary indexes.
  function unindex(filePath: string): void {
    const existing = posts.get(filePath);
    if (!existing) return;
    if (bySlug.get(existing.slug) === filePath) {
      bySlug.delete(existing.slug);
    }
    for (const tag of existing.tags) {
      const key = tag.toLowerCase();
      const set = byTag.get(key);
      if (set) {
        set.delete(filePath);
        if (set.size === 0) byTag.delete(key);
      }
    }
  }

  function index(post: Post): void {
    bySlug.set(post.slug, post.filePath);
    for (const tag of post.tags) {
      const key = tag.toLowerCase();
      let set = byTag.get(key);
      if (!set) {
        set = new Set();
        byTag.set(key, set);
      }
      set.add(post.filePath);
    }
  }

  function loadFile(filePath: string): Post | null {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      const post: Post = {
        title: (data.title as string) ?? path.basename(filePath, ".md"),
        date: (data.date as string) ?? new Date().toISOString(),
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        slug:
          (data.slug as string) ??
          path.basename(filePath, ".md").toLowerCase().replace(/\s+/g, "-"),
        content,
        filePath,
      };

      // Drop any prior index entries for this file before re-indexing.
      unindex(filePath);
      posts.set(filePath, post);
      index(post);
      return post;
    } catch {
      return null;
    }
  }

  function removeFile(filePath: string): void {
    unindex(filePath);
    posts.delete(filePath);
  }

  function loadAll(): void {
    posts.clear();
    bySlug.clear();
    byTag.clear();
    if (!fs.existsSync(contentDir)) return;

    const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      loadFile(path.join(contentDir, file));
    }
  }

  function getAll(): Post[] {
    return Array.from(posts.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  function getBySlug(slug: string): Post | undefined {
    const filePath = bySlug.get(slug);
    return filePath ? posts.get(filePath) : undefined;
  }

  function getByTag(tag: string): Post[] {
    const filePaths = byTag.get(tag.toLowerCase());
    if (!filePaths) return [];
    const matches: Post[] = [];
    for (const filePath of filePaths) {
      const post = posts.get(filePath);
      if (post) matches.push(post);
    }
    // Sort only the matching subset (not the whole store) newest-first.
    return matches.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return { posts, loadAll, loadFile, removeFile, getAll, getBySlug, getByTag };
}
