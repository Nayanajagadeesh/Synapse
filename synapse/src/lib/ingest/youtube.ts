/**
 * YouTube transcript extraction.
 * Uses the `youtube-transcript` package, which scrapes the timed-text track
 * the YouTube player uses (no API key required). If a video has no captions,
 * the call throws and we surface that error to the user.
 */

import { YoutubeTranscript } from "youtube-transcript";

function videoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/embed\/([^/?]+)/);
    if (m) return m[1];
  } catch {}
  return null;
}

export async function extractFromYouTube(url: string): Promise<{
  text: string;
  metadata: Record<string, unknown>;
}> {
  const id = videoIdFromUrl(url);
  if (!id) throw new Error("Could not parse a YouTube video id from the URL");

  const items = await YoutubeTranscript.fetchTranscript(id);
  if (!items.length) throw new Error("No transcript available for this video");

  // Stitch the segments into running text and keep timestamps for citation.
  const text = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
  return {
    text,
    metadata: {
      videoId: id,
      sourceUrl: url,
      segments: items.length,
      durationSeconds: items.at(-1)?.offset
        ? Math.round((items.at(-1)!.offset + items.at(-1)!.duration) / 1000)
        : null,
    },
  };
}
