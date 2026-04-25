/**
 * Web page extraction. For an MVP we use a `fetch` + light HTML cleanup;
 * for production-grade extraction (JS-rendered pages, paywalls, etc.) swap
 * in Playwright by uncommenting the `extractFromUrlPlaywright` variant.
 */

const REMOVE_TAGS = /<(script|style|noscript|svg|nav|footer|header|aside|form)[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;
const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

function htmlToText(html: string): string {
  return html
    .replace(REMOVE_TAGS, " ")
    .replace(TAG, " ")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractFromUrl(url: string): Promise<{
  text: string;
  metadata: Record<string, unknown>;
}> {
  const r = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SynapseBot/1.0; +https://example.com/bot)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    // Some servers stall — bail after 20s
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
  const html = await r.text();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
  );

  return {
    text: htmlToText(html),
    metadata: {
      sourceUrl: url,
      pageTitle: titleMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim(),
      fetchedAt: new Date().toISOString(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Optional: Playwright-powered extractor for JS-heavy pages.          */
/* Enable by installing `playwright` and switching the call site.      */
/* ------------------------------------------------------------------ */
// import { chromium } from "playwright";
// export async function extractFromUrlPlaywright(url: string) {
//   const browser = await chromium.launch();
//   try {
//     const page = await browser.newPage();
//     await page.goto(url, { waitUntil: "networkidle" });
//     const text = await page.evaluate(() => document.body.innerText);
//     return { text, metadata: { sourceUrl: url } };
//   } finally {
//     await browser.close();
//   }
// }
