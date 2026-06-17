export const CATEGORIES = [
  { key: "worldcup",  label: "World Cup",  emoji: "⚽" },
  { key: "technology", label: "Technology", emoji: "🤖" },
  { key: "science",    label: "Science",    emoji: "🧬" },
  { key: "business",  label: "Business",   emoji: "💼" },
  { key: "health",    label: "Health",     emoji: "💪" },
  { key: "design",    label: "Design",     emoji: "🎨" },
  { key: "world",     label: "World",      emoji: "🌍" },
  { key: "finance",   label: "Finance",    emoji: "💰" },
  { key: "philosophy",label: "Philosophy", emoji: "🧠" },
  { key: "culture",   label: "Culture",    emoji: "🎬" },
  { key: "lifestyle", label: "Lifestyle",  emoji: "🏃" },
] as const;

export type CategoryKey = typeof CATEGORIES[number]["key"];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key).join("|");
