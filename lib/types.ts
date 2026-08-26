export interface StoryCard {
  headline: string;
  bullets: string[];
  readTime: string;
}

export interface StorySet {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  coverImageUrl?: string;
  category?: string;
  publishedAt?: string;
  cards: StoryCard[];
  savedAt: string;
}

export interface InboxItem {
  id: string;
  clerk_user_id: string;
  url: string | null;
  item_type: string;
  title: string | null;
  status: "pending" | "processing" | "done" | "error";
  error_msg: string | null;
  created_at: string;
  processed_at: string | null;
  story_set_id?: string | null;
}

export interface Note {
  id: string;
  card_index: number | null;
  content: string;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  sourceType: "gutenberg" | "ai-summary" | "upload";
  sourceRef: string | null;
  coverImageUrl: string | null;
  category: string | null;
  totalCards: number;
  status: "processing" | "ready" | "error";
  addedByUser: string;
  createdAt: string;
}

export interface BookCard {
  cardIndex: number;
  chapterLabel: string | null;
  kind: "text" | "summary";
  headline: string | null;
  excerpt?: string;
  bullets?: string[];
  readTime: string | null;
}

export interface BookWithCards extends Book {
  cards: BookCard[];
}

export interface BookProgress {
  bookId: string;
  currentCardIndex: number;
  startedAt: string;
  lastReadAt: string;
  completedAt: string | null;
}
