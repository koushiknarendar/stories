import postgres from "postgres";
import type { StorySet, StoryCard, InboxItem, Note, Book, BookCard, BookWithCards, BookProgress } from "./types";

let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL, {
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
      max: 3,
      idle_timeout: 20,
    });
  }
  return _sql;
}

export async function runMigration() {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL is not set");

  await sql`
    CREATE TABLE IF NOT EXISTS devices (
      id         TEXT        PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interactions (
      id           SERIAL      PRIMARY KEY,
      device_id    TEXT        NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
      story_id     TEXT        NOT NULL,
      story_title  TEXT,
      story_source TEXT,
      action       TEXT        NOT NULL CHECK (action IN ('like', 'dislike')),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (device_id, story_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS inbox_items (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT        NOT NULL,
      url           TEXT,
      item_type     TEXT        NOT NULL DEFAULT 'url',
      title         TEXT,
      status        TEXT        NOT NULL DEFAULT 'pending',
      error_msg     TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      processed_at  TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS inbox_items_user_idx ON inbox_items(clerk_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS story_sets (
      id              TEXT        PRIMARY KEY,
      clerk_user_id   TEXT        NOT NULL,
      inbox_item_id   UUID        REFERENCES inbox_items(id),
      title           TEXT        NOT NULL,
      source          TEXT        NOT NULL,
      source_url      TEXT,
      saved_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS story_sets_user_idx ON story_sets(clerk_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS story_cards (
      id            SERIAL      PRIMARY KEY,
      story_set_id  TEXT        REFERENCES story_sets(id) ON DELETE CASCADE,
      card_index    INT         NOT NULL,
      headline      TEXT        NOT NULL,
      bullets       JSONB       NOT NULL,
      read_time     TEXT        NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT        NOT NULL,
      story_set_id  TEXT        REFERENCES story_sets(id) ON DELETE CASCADE,
      card_index    INT,
      content       TEXT        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS notes_set_idx ON notes(story_set_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS starred_bullets (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT        NOT NULL,
      story_set_id  TEXT        REFERENCES story_sets(id) ON DELETE CASCADE,
      story_title   TEXT        NOT NULL,
      card_index    INT         NOT NULL,
      bullet_index  INT         NOT NULL,
      bullet_text   TEXT        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(clerk_user_id, story_set_id, card_index, bullet_index)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS starred_bullets_user_idx ON starred_bullets(clerk_user_id)`;

  // Add cover_image_url to existing story_sets tables (idempotent)
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS cover_image_url TEXT`;
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS category TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_interests (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT        NOT NULL,
      category      TEXT        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(clerk_user_id, category)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS user_interests_user_idx ON user_interests(clerk_user_id)`;

  // Discover / generated stories columns
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS is_generated BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS generated_category TEXT`;
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ`;
  await sql`ALTER TABLE story_sets ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_read_stories (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT        NOT NULL,
      story_set_id  TEXT        NOT NULL,
      read_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(clerk_user_id, story_set_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS user_read_stories_user_idx ON user_read_stories(clerk_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_streaks (
      clerk_user_id  TEXT PRIMARY KEY,
      current_streak INT  DEFAULT 0,
      last_read_date DATE,
      longest_streak INT  DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      clerk_user_id TEXT        NOT NULL,
      name          TEXT        NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS collections_user_idx ON collections(clerk_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id TEXT        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      story_set_id  TEXT        NOT NULL REFERENCES story_sets(id) ON DELETE CASCADE,
      added_at      TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY   (collection_id, story_set_id)
    )
  `;

  // ─── Books ──────────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS books (
      id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title           TEXT        NOT NULL,
      author          TEXT,
      source_type     TEXT        NOT NULL CHECK (source_type IN ('gutenberg','ai-summary','upload')),
      source_ref      TEXT,
      cover_image_url TEXT,
      category        TEXT,
      total_cards     INT         NOT NULL DEFAULT 0,
      status          TEXT        NOT NULL DEFAULT 'ready',
      added_by_user   TEXT        NOT NULL DEFAULT '__catalog__',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS books_catalog_idx ON books(added_by_user, status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS book_cards (
      id            SERIAL      PRIMARY KEY,
      book_id       TEXT        REFERENCES books(id) ON DELETE CASCADE,
      card_index    INT         NOT NULL,
      chapter_label TEXT,
      kind          TEXT        NOT NULL CHECK (kind IN ('text','summary')),
      headline      TEXT,
      content       JSONB       NOT NULL,
      read_time     TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS book_cards_book_idx ON book_cards(book_id, card_index)`;

  await sql`
    CREATE TABLE IF NOT EXISTS user_book_progress (
      clerk_user_id       TEXT        NOT NULL,
      book_id             TEXT        REFERENCES books(id) ON DELETE CASCADE,
      current_card_index  INT         NOT NULL DEFAULT 0,
      started_at          TIMESTAMPTZ DEFAULT NOW(),
      last_read_at        TIMESTAMPTZ DEFAULT NOW(),
      completed_at        TIMESTAMPTZ,
      PRIMARY KEY (clerk_user_id, book_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS user_book_progress_user_idx ON user_book_progress(clerk_user_id)`;
}

// ─── Inbox helpers ────────────────────────────────────────────────────────────

export async function createInboxItem(
  clerkUserId: string,
  url: string | null,
  itemType = "url"
): Promise<InboxItem> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [item] = await sql<[InboxItem]>`
    INSERT INTO inbox_items (clerk_user_id, url, item_type, status)
    VALUES (${clerkUserId}, ${url}, ${itemType}, 'processing')
    RETURNING *
  `;
  return item;
}

export async function markInboxItemDone(id: string, title: string) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`
    UPDATE inbox_items
    SET status = 'done', title = ${title}, processed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markInboxItemError(id: string, errorMsg: string) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`
    UPDATE inbox_items
    SET status = 'error', error_msg = ${errorMsg}
    WHERE id = ${id}
  `;
}

export async function listInboxItems(clerkUserId: string): Promise<InboxItem[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<InboxItem[]>`
    SELECT i.*, s.id AS story_set_id
    FROM inbox_items i
    LEFT JOIN story_sets s ON s.inbox_item_id = i.id
    WHERE i.clerk_user_id = ${clerkUserId}
    ORDER BY i.created_at DESC
  `;
}

export async function deleteInboxItem(id: string, clerkUserId: string) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`DELETE FROM inbox_items WHERE id = ${id} AND clerk_user_id = ${clerkUserId}`;
}

// ─── Story set helpers ────────────────────────────────────────────────────────

// Anyone converting the same URL (any owner) lands on the same shareable story.
export async function saveStorySetAnon(set: StorySet, cards: StoryCard[]): Promise<string> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");

  if (set.sourceUrl) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM story_sets WHERE source_url = ${set.sourceUrl} LIMIT 1
    `;
    if (existing) return existing.id;
  }

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO story_sets (id, clerk_user_id, title, source, source_url, cover_image_url, category, published_at)
    VALUES (${set.id}, 'anon', ${set.title}, ${set.source}, ${set.sourceUrl ?? null}, ${set.coverImageUrl ?? null}, ${set.category ?? null}, ${set.publishedAt ?? null})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  if (inserted.length > 0) {
    for (const [i, card] of cards.entries()) {
      await sql`
        INSERT INTO story_cards (story_set_id, card_index, headline, bullets, read_time)
        VALUES (${set.id}, ${i}, ${card.headline}, ${JSON.stringify(card.bullets ?? [])}::jsonb, ${card.readTime})
      `;
    }
  }
  return set.id;
}

// Re-converting a URL already in this user's library returns the existing story
// instead of duplicating it.
export async function saveStorySet(
  clerkUserId: string,
  inboxItemId: string,
  set: StorySet,
  cards: StoryCard[]
): Promise<string> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");

  if (set.sourceUrl) {
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM story_sets WHERE clerk_user_id = ${clerkUserId} AND source_url = ${set.sourceUrl} LIMIT 1
    `;
    if (existing) return existing.id;
  }

  await sql`
    INSERT INTO story_sets (id, clerk_user_id, inbox_item_id, title, source, source_url, cover_image_url, category, published_at)
    VALUES (${set.id}, ${clerkUserId}, ${inboxItemId}, ${set.title}, ${set.source}, ${set.sourceUrl ?? null}, ${set.coverImageUrl ?? null}, ${set.category ?? null}, ${set.publishedAt ?? null})
    ON CONFLICT (id) DO NOTHING
  `;

  for (const [i, card] of cards.entries()) {
    await sql`
      INSERT INTO story_cards (story_set_id, card_index, headline, bullets, read_time)
      VALUES (${set.id}, ${i}, ${card.headline}, ${JSON.stringify(card.bullets ?? [])}::jsonb, ${card.readTime})
    `;
  }
  return set.id;
}

export async function loadStorySet(id: string): Promise<StorySet | null> {
  const sql = getDb();
  if (!sql) return null;

  // Load by ID only — UUID is 122 bits of entropy, effectively unguessable.
  const rows = await sql<{ id: string; title: string; source: string; source_url: string | null; cover_image_url: string | null; saved_at: string; published_at: string | null }[]>`
    SELECT id, title, source, source_url, cover_image_url, saved_at, published_at
    FROM story_sets
    WHERE id = ${id}
  `;
  if (!rows.length) return null;
  const set = rows[0];

  const cards = await sql<{ headline: string; bullets: unknown; read_time: string }[]>`
    SELECT headline, bullets, read_time
    FROM story_cards
    WHERE story_set_id = ${id}
    ORDER BY card_index
  `;

  return {
    id: set.id,
    title: set.title,
    source: set.source,
    sourceUrl: set.source_url ?? undefined,
    coverImageUrl: set.cover_image_url ?? undefined,
    publishedAt: set.published_at ?? undefined,
    savedAt: set.saved_at,
    cards: cards.map((c) => {
      // bullets stored as JSONB — might come back as array, string, or null
      let bullets: string[] = [];
      if (Array.isArray(c.bullets)) {
        bullets = c.bullets as string[];
      } else if (typeof c.bullets === "string") {
        try { bullets = JSON.parse(c.bullets); } catch { bullets = [c.bullets]; }
      }
      return { headline: c.headline, bullets, readTime: c.read_time };
    }),
  };
}

export async function deleteStorySet(id: string, clerkUserId: string) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`DELETE FROM story_sets WHERE id = ${id} AND clerk_user_id = ${clerkUserId}`;
}

export async function listStorySets(clerkUserId: string) {
  const sql = getDb();
  if (!sql) return [];
  return sql<{ id: string; title: string; source: string; source_url: string | null; cover_image_url: string | null; category: string | null; saved_at: string; published_at: string | null }[]>`
    SELECT id, title, source, source_url, cover_image_url, category, saved_at, published_at
    FROM story_sets
    WHERE clerk_user_id = ${clerkUserId}
    ORDER BY saved_at DESC
  `;
}

// ─── Notes helpers ────────────────────────────────────────────────────────────

export async function addNote(
  clerkUserId: string,
  storySetId: string,
  cardIndex: number | null,
  content: string
): Promise<Note> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [note] = await sql<[Note]>`
    INSERT INTO notes (clerk_user_id, story_set_id, card_index, content)
    VALUES (${clerkUserId}, ${storySetId}, ${cardIndex}, ${content})
    RETURNING id, card_index, content, created_at
  `;
  return note;
}

export async function listNotes(clerkUserId: string, storySetId: string): Promise<Note[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<Note[]>`
    SELECT id, card_index, content, created_at
    FROM notes
    WHERE clerk_user_id = ${clerkUserId} AND story_set_id = ${storySetId}
    ORDER BY created_at
  `;
}

export async function deleteNote(id: string, clerkUserId: string) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`DELETE FROM notes WHERE id = ${id} AND clerk_user_id = ${clerkUserId}`;
}

// ─── User interests helpers ───────────────────────────────────────────────────

export async function getUserInterests(clerkUserId: string): Promise<string[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql<{ category: string }[]>`
    SELECT category FROM user_interests WHERE clerk_user_id = ${clerkUserId} ORDER BY created_at
  `;
  return rows.map((r) => r.category);
}

export async function setUserInterests(clerkUserId: string, categories: string[]): Promise<void> {
  const sql = getDb();
  if (!sql) return;
  await sql`DELETE FROM user_interests WHERE clerk_user_id = ${clerkUserId}`;
  for (const cat of categories) {
    await sql`
      INSERT INTO user_interests (clerk_user_id, category) VALUES (${clerkUserId}, ${cat})
      ON CONFLICT DO NOTHING
    `;
  }
}

// ─── Starred bullets helpers ──────────────────────────────────────────────────

export interface StarredBullet {
  id: string;
  story_set_id: string;
  story_title: string;
  card_index: number;
  bullet_index: number;
  bullet_text: string;
  created_at: string;
}

export async function starBullet(
  clerkUserId: string,
  storySetId: string,
  storyTitle: string,
  cardIndex: number,
  bulletIndex: number,
  bulletText: string
): Promise<StarredBullet> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [row] = await sql<[StarredBullet]>`
    INSERT INTO starred_bullets (clerk_user_id, story_set_id, story_title, card_index, bullet_index, bullet_text)
    VALUES (${clerkUserId}, ${storySetId}, ${storyTitle}, ${cardIndex}, ${bulletIndex}, ${bulletText})
    ON CONFLICT (clerk_user_id, story_set_id, card_index, bullet_index) DO NOTHING
    RETURNING id, story_set_id, story_title, card_index, bullet_index, bullet_text, created_at
  `;
  return row;
}

export async function unstarBullet(
  clerkUserId: string,
  storySetId: string,
  cardIndex: number,
  bulletIndex: number
) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`
    DELETE FROM starred_bullets
    WHERE clerk_user_id = ${clerkUserId}
      AND story_set_id  = ${storySetId}
      AND card_index    = ${cardIndex}
      AND bullet_index  = ${bulletIndex}
  `;
}

export async function listStarredBullets(clerkUserId: string): Promise<StarredBullet[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<StarredBullet[]>`
    SELECT id, story_set_id, story_title, card_index, bullet_index, bullet_text, created_at
    FROM starred_bullets
    WHERE clerk_user_id = ${clerkUserId}
    ORDER BY created_at DESC
  `;
}

export async function listStarredForStory(clerkUserId: string, storySetId: string): Promise<StarredBullet[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<StarredBullet[]>`
    SELECT id, story_set_id, story_title, card_index, bullet_index, bullet_text, created_at
    FROM starred_bullets
    WHERE clerk_user_id = ${clerkUserId} AND story_set_id = ${storySetId}
  `;
}

// ─── Daily card helper ────────────────────────────────────────────────────────

export async function getDailyCard(clerkUserId: string): Promise<{
  storySetId: string;
  storyTitle: string;
  cardIndex: number;
  headline: string;
  bullet: string;
} | null> {
  const sql = getDb();
  if (!sql) return null;

  // Pick a card seeded by today's date so it's consistent within the day
  const rows = await sql<{ story_set_id: string; title: string; card_index: number; headline: string; bullets: unknown }[]>`
    SELECT sc.story_set_id, ss.title, sc.card_index, sc.headline, sc.bullets
    FROM story_cards sc
    JOIN story_sets ss ON ss.id = sc.story_set_id
    WHERE ss.clerk_user_id = ${clerkUserId}
    ORDER BY md5(ss.id || sc.card_index::text || current_date::text)
    LIMIT 1
  `;
  if (!rows.length) return null;

  const row = rows[0];
  let bullets: string[] = [];
  if (Array.isArray(row.bullets)) bullets = row.bullets as string[];
  else if (typeof row.bullets === "string") { try { bullets = JSON.parse(row.bullets); } catch { bullets = []; } }

  return {
    storySetId: row.story_set_id,
    storyTitle: row.title,
    cardIndex: row.card_index,
    headline: row.headline,
    bullet: bullets[0] ?? "",
  };
}

// ─── Discover / generated stories helpers ────────────────────────────────────

export async function searchStorySets(query: string): Promise<{
  id: string; title: string; source: string; source_url: string | null;
  cover_image_url: string | null; category: string | null; saved_at: string; published_at: string | null;
}[]> {
  const sql = getDb();
  if (!sql) return [];
  const pattern = `%${query}%`;
  return sql`
    SELECT id, title, source, source_url, cover_image_url, category, saved_at, published_at
    FROM story_sets
    WHERE is_generated = true
      AND title ILIKE ${pattern}
    ORDER BY generated_at DESC
    LIMIT 15
  `;
}

export async function getGeneratedStories(categories: string[]): Promise<{
  id: string; title: string; source: string; source_url: string | null;
  cover_image_url: string | null; category: string | null; saved_at: string;
  published_at: string | null; is_generated: boolean;
}[]> {
  const sql = getDb();
  if (!sql || !categories.length) return [];
  return sql`
    SELECT DISTINCT ON (COALESCE(source_url, id)) id, title, source, source_url, cover_image_url, category, saved_at, published_at, is_generated
    FROM story_sets
    WHERE is_generated = true
      AND generated_category = ANY(${categories})
      AND generated_at > NOW() - INTERVAL '24 hours'
    ORDER BY COALESCE(source_url, id), generated_at DESC
  `;
}

export async function saveGeneratedStorySet(
  set: import("./types").StorySet,
  category: string
) {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`
    INSERT INTO story_sets (id, clerk_user_id, title, source, source_url, cover_image_url, category, is_generated, generated_category, generated_at, published_at)
    VALUES (${set.id}, '__generated__', ${set.title}, ${set.source}, ${set.sourceUrl ?? null}, ${set.coverImageUrl ?? null}, ${category}, true, ${category}, NOW(), ${set.publishedAt ?? null})
    ON CONFLICT (id) DO NOTHING
  `;
  for (const [i, card] of set.cards.entries()) {
    await sql`
      INSERT INTO story_cards (story_set_id, card_index, headline, bullets, read_time)
      VALUES (${set.id}, ${i}, ${card.headline}, ${JSON.stringify(card.bullets ?? [])}::jsonb, ${card.readTime})
    `;
  }
}

export async function markStoryRead(clerkUserId: string, storySetId: string) {
  const sql = getDb();
  if (!sql) return;
  await sql`
    INSERT INTO user_read_stories (clerk_user_id, story_set_id)
    VALUES (${clerkUserId}, ${storySetId})
    ON CONFLICT (clerk_user_id, story_set_id) DO NOTHING
  `;
}

export async function getUserStreak(clerkUserId: string): Promise<{
  currentStreak: number; longestStreak: number; lastReadDate: string | null; todayCount: number; totalReads: number;
}> {
  const sql = getDb();
  if (!sql) return { currentStreak: 0, longestStreak: 0, lastReadDate: null, todayCount: 0, totalReads: 0 };

  const [streakRow] = await sql<{ current_streak: number; longest_streak: number; last_read_date: string | null }[]>`
    SELECT current_streak, longest_streak, last_read_date::text FROM user_streaks WHERE clerk_user_id = ${clerkUserId}
  `;
  const [countRow] = await sql<{ today: string; total: string }[]>`
    SELECT
      COUNT(*) FILTER (WHERE read_at >= current_date)::text AS today,
      COUNT(*)::text AS total
    FROM user_read_stories
    WHERE clerk_user_id = ${clerkUserId}
  `;

  return {
    currentStreak: streakRow?.current_streak ?? 0,
    longestStreak: streakRow?.longest_streak ?? 0,
    lastReadDate: streakRow?.last_read_date ?? null,
    todayCount: parseInt(countRow?.today ?? "0", 10),
    totalReads: parseInt(countRow?.total ?? "0", 10),
  };
}

export async function updateUserStreak(clerkUserId: string) {
  const sql = getDb();
  if (!sql) return;

  const [existing] = await sql<{ current_streak: number; longest_streak: number; last_read_date: string | null }[]>`
    SELECT current_streak, longest_streak, last_read_date::text FROM user_streaks WHERE clerk_user_id = ${clerkUserId}
  `;

  if (!existing) {
    await sql`
      INSERT INTO user_streaks (clerk_user_id, current_streak, longest_streak, last_read_date)
      VALUES (${clerkUserId}, 1, 1, current_date)
    `;
    return;
  }

  // Compare last_read_date to today in SQL to avoid timezone issues
  const [dateCheck] = await sql<{ is_today: boolean; is_yesterday: boolean }[]>`
    SELECT
      last_read_date = current_date AS is_today,
      last_read_date = current_date - 1 AS is_yesterday
    FROM user_streaks WHERE clerk_user_id = ${clerkUserId}
  `;

  if (dateCheck.is_today) return; // already counted today

  const newStreak = dateCheck.is_yesterday ? existing.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, existing.longest_streak);

  await sql`
    UPDATE user_streaks
    SET current_streak = ${newStreak}, longest_streak = ${newLongest}, last_read_date = current_date
    WHERE clerk_user_id = ${clerkUserId}
  `;
}

// ─── Library cards for Ask ────────────────────────────────────────────────────

export async function getAllCardsForUser(clerkUserId: string): Promise<{
  storyTitle: string;
  storySetId: string;
  sourceUrl: string | null;
  headline: string;
  bullets: string[];
}[]> {
  const sql = getDb();
  if (!sql) return [];

  const rows = await sql<{ story_set_id: string; title: string; source_url: string | null; headline: string; bullets: unknown }[]>`
    SELECT sc.story_set_id, ss.title, ss.source_url, sc.headline, sc.bullets
    FROM story_cards sc
    JOIN story_sets ss ON ss.id = sc.story_set_id
    WHERE ss.clerk_user_id = ${clerkUserId}
    ORDER BY ss.saved_at DESC, sc.card_index
    LIMIT 300
  `;

  return rows.map((r) => {
    let bullets: string[] = [];
    if (Array.isArray(r.bullets)) bullets = r.bullets as string[];
    else if (typeof r.bullets === "string") { try { bullets = JSON.parse(r.bullets); } catch { bullets = []; } }
    return { storySetId: r.story_set_id, storyTitle: r.title, sourceUrl: r.source_url, headline: r.headline, bullets };
  });
}

// ─── Read history ─────────────────────────────────────────────────────────────

export async function getReadHistory(clerkUserId: string): Promise<{
  id: string; title: string; source: string; source_url: string | null; read_at: string;
}[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<{ id: string; title: string; source: string; source_url: string | null; read_at: string }[]>`
    SELECT ss.id, ss.title, ss.source, ss.source_url, rs.read_at::text
    FROM user_read_stories rs
    JOIN story_sets ss ON ss.id = rs.story_set_id
    WHERE rs.clerk_user_id = ${clerkUserId}
    ORDER BY rs.read_at DESC
    LIMIT 60
  `;
}

// ─── Collections helpers ──────────────────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  item_count: number;
  cover_images: string[];
  created_at: string;
}

export async function listCollections(clerkUserId: string): Promise<Collection[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql<{ id: string; name: string; created_at: string; item_count: string; cover_images: string[] }[]>`
    SELECT
      c.id,
      c.name,
      c.created_at::text,
      COUNT(ci.story_set_id)::text AS item_count,
      ARRAY(
        SELECT ss.cover_image_url
        FROM collection_items ci2
        JOIN story_sets ss ON ss.id = ci2.story_set_id
        WHERE ci2.collection_id = c.id AND ss.cover_image_url IS NOT NULL
        ORDER BY ci2.added_at DESC
        LIMIT 4
      ) AS cover_images
    FROM collections c
    LEFT JOIN collection_items ci ON ci.collection_id = c.id
    WHERE c.clerk_user_id = ${clerkUserId}
    GROUP BY c.id, c.name, c.created_at
    ORDER BY c.created_at DESC
  `;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    item_count: parseInt(r.item_count, 10),
    cover_images: Array.isArray(r.cover_images) ? r.cover_images.filter(Boolean) : [],
  }));
}

export async function createCollection(clerkUserId: string, name: string): Promise<{ id: string; name: string; created_at: string }> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [row] = await sql<[{ id: string; name: string; created_at: string }]>`
    INSERT INTO collections (clerk_user_id, name)
    VALUES (${clerkUserId}, ${name})
    RETURNING id, name, created_at::text
  `;
  return row;
}

export async function addToCollection(clerkUserId: string, collectionId: string, storySetId: string): Promise<void> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [col] = await sql`SELECT id FROM collections WHERE id = ${collectionId} AND clerk_user_id = ${clerkUserId}`;
  if (!col) throw new Error("Collection not found");
  await sql`
    INSERT INTO collection_items (collection_id, story_set_id)
    VALUES (${collectionId}, ${storySetId})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeFromCollection(collectionId: string, storySetId: string, clerkUserId: string): Promise<void> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`
    DELETE FROM collection_items
    WHERE collection_id = ${collectionId}
      AND story_set_id = ${storySetId}
      AND EXISTS (SELECT 1 FROM collections WHERE id = ${collectionId} AND clerk_user_id = ${clerkUserId})
  `;
}

export async function deleteCollection(id: string, clerkUserId: string): Promise<void> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  await sql`DELETE FROM collections WHERE id = ${id} AND clerk_user_id = ${clerkUserId}`;
}

export interface CollectionItem {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  cover_image_url: string | null;
  category: string | null;
  saved_at: string;
}

export async function getCollectionItems(id: string, clerkUserId: string): Promise<CollectionItem[]> {
  const sql = getDb();
  if (!sql) return [];
  return sql<CollectionItem[]>`
    SELECT ss.id, ss.title, ss.source, ss.source_url, ss.cover_image_url, ss.category, ss.saved_at::text
    FROM collection_items ci
    JOIN story_sets ss ON ss.id = ci.story_set_id
    WHERE ci.collection_id = ${id}
      AND EXISTS (SELECT 1 FROM collections WHERE id = ${id} AND clerk_user_id = ${clerkUserId})
    ORDER BY ci.added_at DESC
  `;
}

// ─── Books ────────────────────────────────────────────────────────────────

type BookRow = {
  id: string; title: string; author: string | null; source_type: string; source_ref: string | null;
  cover_image_url: string | null; category: string | null; total_cards: number; status: string;
  added_by_user: string; created_at: string;
};

function rowToBook(r: BookRow): Book {
  return {
    id: r.id, title: r.title, author: r.author,
    sourceType: r.source_type as Book["sourceType"], sourceRef: r.source_ref,
    coverImageUrl: r.cover_image_url, category: r.category, totalCards: r.total_cards,
    status: r.status as Book["status"], addedByUser: r.added_by_user, createdAt: r.created_at,
  };
}

export async function createBook(book: {
  title: string; author?: string | null; sourceType: Book["sourceType"]; sourceRef?: string | null;
  coverImageUrl?: string | null; category?: string | null; addedByUser?: string;
}): Promise<string> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");
  const [row] = await sql<[{ id: string }]>`
    INSERT INTO books (title, author, source_type, source_ref, cover_image_url, category, status, added_by_user)
    VALUES (${book.title}, ${book.author ?? null}, ${book.sourceType}, ${book.sourceRef ?? null}, ${book.coverImageUrl ?? null}, ${book.category ?? null}, 'processing', ${book.addedByUser ?? "__catalog__"})
    RETURNING id
  `;
  return row.id;
}

export async function insertBookCards(bookId: string, cards: Omit<BookCard, "cardIndex">[]): Promise<void> {
  const sql = getDb();
  if (!sql) throw new Error("DB not configured");

  // Bulk-insert in batches — a book can produce 1000+ cards, and one round-trip
  // per row risks hitting serverless function time limits on ingest.
  const BATCH_SIZE = 200;
  for (let batchStart = 0; batchStart < cards.length; batchStart += BATCH_SIZE) {
    const batch = cards.slice(batchStart, batchStart + BATCH_SIZE).map((card, i) => ({
      book_id: bookId,
      card_index: batchStart + i,
      chapter_label: card.chapterLabel,
      kind: card.kind,
      headline: card.headline,
      content: card.kind === "text" ? { excerpt: card.excerpt ?? "" } : { bullets: card.bullets ?? [] },
      read_time: card.readTime,
    }));
    await sql`
      INSERT INTO book_cards ${sql(batch, "book_id", "card_index", "chapter_label", "kind", "headline", "content", "read_time")}
    `;
  }
  await sql`UPDATE books SET total_cards = ${cards.length}, status = 'ready' WHERE id = ${bookId}`;
}

export async function markBookError(bookId: string): Promise<void> {
  const sql = getDb();
  if (!sql) return;
  await sql`UPDATE books SET status = 'error' WHERE id = ${bookId}`;
}

export async function listBooks(category?: string): Promise<Book[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = category
    ? await sql<BookRow[]>`SELECT * FROM books WHERE added_by_user = '__catalog__' AND status = 'ready' AND category = ${category} ORDER BY created_at DESC`
    : await sql<BookRow[]>`SELECT * FROM books WHERE added_by_user = '__catalog__' AND status = 'ready' ORDER BY created_at DESC`;
  return rows.map(rowToBook);
}

export async function listUserUploadedBooks(clerkUserId: string): Promise<Book[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql<BookRow[]>`
    SELECT * FROM books WHERE added_by_user = ${clerkUserId} ORDER BY created_at DESC
  `;
  return rows.map(rowToBook);
}

export async function getBook(id: string): Promise<BookWithCards | null> {
  const sql = getDb();
  if (!sql) return null;
  const [row] = await sql<BookRow[]>`SELECT * FROM books WHERE id = ${id}`;
  if (!row) return null;

  const cardRows = await sql<{ card_index: number; chapter_label: string | null; kind: string; headline: string | null; content: unknown; read_time: string | null }[]>`
    SELECT card_index, chapter_label, kind, headline, content, read_time
    FROM book_cards WHERE book_id = ${id} ORDER BY card_index
  `;

  const cards: BookCard[] = cardRows.map((c) => {
    let content: { excerpt?: string; bullets?: string[] } = {};
    if (c.content && typeof c.content === "object") content = c.content as typeof content;
    else if (typeof c.content === "string") { try { content = JSON.parse(c.content); } catch { content = {}; } }
    return {
      cardIndex: c.card_index, chapterLabel: c.chapter_label, kind: c.kind as BookCard["kind"],
      headline: c.headline, excerpt: content.excerpt, bullets: content.bullets, readTime: c.read_time,
    };
  });

  return { ...rowToBook(row), cards };
}

export async function getBookProgress(clerkUserId: string, bookId: string): Promise<BookProgress | null> {
  const sql = getDb();
  if (!sql) return null;
  const [row] = await sql<{ book_id: string; current_card_index: number; started_at: string; last_read_at: string; completed_at: string | null }[]>`
    SELECT book_id, current_card_index, started_at::text, last_read_at::text, completed_at::text
    FROM user_book_progress WHERE clerk_user_id = ${clerkUserId} AND book_id = ${bookId}
  `;
  if (!row) return null;
  return { bookId: row.book_id, currentCardIndex: row.current_card_index, startedAt: row.started_at, lastReadAt: row.last_read_at, completedAt: row.completed_at };
}

export async function listUserBookProgress(clerkUserId: string): Promise<(BookProgress & { book: Book })[]> {
  const sql = getDb();
  if (!sql) return [];
  const rows = await sql<(BookRow & { current_card_index: number; started_at: string; last_read_at: string; completed_at: string | null })[]>`
    SELECT b.*, p.current_card_index, p.started_at::text, p.last_read_at::text, p.completed_at::text
    FROM user_book_progress p
    JOIN books b ON b.id = p.book_id
    WHERE p.clerk_user_id = ${clerkUserId}
    ORDER BY p.last_read_at DESC
  `;
  return rows.map((r) => ({
    bookId: r.id, currentCardIndex: r.current_card_index, startedAt: r.started_at,
    lastReadAt: r.last_read_at, completedAt: r.completed_at, book: rowToBook(r),
  }));
}

export async function upsertBookProgress(clerkUserId: string, bookId: string, currentCardIndex: number, completed: boolean): Promise<void> {
  const sql = getDb();
  if (!sql) return;
  await sql`
    INSERT INTO user_book_progress (clerk_user_id, book_id, current_card_index, last_read_at, completed_at)
    VALUES (${clerkUserId}, ${bookId}, ${currentCardIndex}, NOW(), ${completed ? sql`NOW()` : null})
    ON CONFLICT (clerk_user_id, book_id) DO UPDATE
    SET current_card_index = ${currentCardIndex},
        last_read_at = NOW(),
        completed_at = COALESCE(user_book_progress.completed_at, ${completed ? sql`NOW()` : null})
  `;
}
