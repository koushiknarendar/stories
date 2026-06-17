import { load } from "cheerio";

const CATEGORY_FEEDS: Record<string, string[]> = {
  technology: [
    "https://hnrss.org/frontpage",
    "https://www.theverge.com/rss/index.xml",
  ],
  science: [
    "https://www.sciencedaily.com/rss/all.xml",
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  ],
  business: [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
    "https://hnrss.org/ask",
  ],
  health: [
    "https://feeds.bbci.co.uk/news/health/rss.xml",
    "https://www.medicalnewstoday.com/rss/medicalnewstoday.xml",
  ],
  design: [
    "https://www.dezeen.com/feed/",
    "https://hnrss.org/frontpage?q=design",
  ],
  world: [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  ],
  finance: [
    "https://feeds.bbci.co.uk/news/business/economy/rss.xml",
    "https://hnrss.org/frontpage?q=finance+investing",
  ],
  philosophy: [
    "https://aeon.co/feed.rss",
  ],
  culture: [
    "https://www.theguardian.com/culture/rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
  ],
  lifestyle: [
    "https://feeds.feedburner.com/lifehacker/full",
    "https://rss.nytimes.com/services/xml/rss/nyt/Well.xml",
  ],
  worldcup: [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.espn.com/espn/rss/soccer/news",
    "https://www.theguardian.com/football/rss",
  ],
};

export interface RssArticle {
  url: string;
  title: string;
}

export async function fetchRssArticles(category: string, limit = 3): Promise<RssArticle[]> {
  const feeds = CATEGORY_FEEDS[category] ?? [];
  for (const feedUrl of feeds) {
    try {
      const articles = await fetchFeed(feedUrl, limit);
      if (articles.length > 0) return articles;
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchFeed(feedUrl: string, limit: number): Promise<RssArticle[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StorisBot/1.0)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseXml(xml, limit);
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .trim();
}

function parseXml(xml: string, limit: number): RssArticle[] {
  const $ = load(xml, { xmlMode: true });
  const articles: RssArticle[] = [];

  // RSS 2.0
  $("item").each((_, el) => {
    if (articles.length >= limit) return false;
    const $el = $(el);
    const url = $el.find("link").first().text().trim()
      || $el.find("guid").first().text().trim();
    const title = decodeEntities($el.find("title").first().text());
    if (url && title && url.startsWith("http")) {
      articles.push({ url, title });
    }
  });

  // Atom
  if (!articles.length) {
    $("entry").each((_, el) => {
      if (articles.length >= limit) return false;
      const $el = $(el);
      const url = $el.find("link[rel='alternate']").attr("href")
        || $el.find("link").first().attr("href")
        || $el.find("link").first().text().trim();
      const title = decodeEntities($el.find("title").first().text());
      if (url && title && url.startsWith("http")) {
        articles.push({ url, title });
      }
    });
  }

  return articles;
}
