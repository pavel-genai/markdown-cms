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

  function normalizeDate(raw: unknown, filePath: string): string {
    if (raw == null) {
      return new Date().toISOString();
    }
    const asString = String(raw);
    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) {
      console.warn(
        `[content] invalid date ${JSON.stringify(asString)} in ${filePath}; ` +
          `falling back to current time`
      );
      return new Date().toISOString();
    }
    return asString;
  }

  function loadFile(filePath: string): Post | null {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      const post: Post = {
        title: (data.title as string) ?? path.basename(filePath, ".md"),
        date: normalizeDate(data.date, filePath),
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
        slug:
          (data.slug as string) ??
          path.basename(filePath, ".md").toLowerCase().replace(/\s+/g, "-"),
        content,
        filePath,
      };

      // Warn on duplicate slugs: two files resolving to the same slug collide
      // silently in getBySlug, and which one wins depends on Map order.
      for (const existing of posts.values()) {
        if (existing.filePath !== filePath && existing.slug === post.slug) {
          console.warn(
            `[content] duplicate slug ${JSON.stringify(post.slug)}: ` +
              `${existing.filePath} and ${filePath}`
          );
          break;
        }
      }

      posts.set(filePath, post);
      return post;
    } catch {
      return null;
    }
  }

  function removeFile(filePath: string): void {
    posts.delete(filePath);
  }

  function loadAll(): void {
    posts.clear();
    if (!fs.existsSync(contentDir)) return;

    const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      loadFile(path.join(contentDir, file));
    }
  }

  function getAll(): Post[] {
    // NaN-safe sort: treat unparseable dates as epoch 0 so a bad date can
    // never poison the ordering with NaN comparisons.
    const time = (d: string): number => {
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return Array.from(posts.values()).sort((a, b) => time(b.date) - time(a.date));
  }

  function getBySlug(slug: string): Post | undefined {
    return Array.from(posts.values()).find((p) => p.slug === slug);
  }

  function getByTag(tag: string): Post[] {
    return getAll().filter((p) =>
      p.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
    );
  }

  return { posts, loadAll, loadFile, removeFile, getAll, getBySlug, getByTag };
}
