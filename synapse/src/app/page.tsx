import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" /> AI research, for teams
        </div>
        <h1 className="text-5xl font-bold tracking-tight">
          Your team's <span className="text-accent">second brain</span>.
        </h1>
        <p className="text-lg text-muted-foreground">
          Drop in PDFs, articles, YouTube videos and RSS feeds. Ask questions and get cited
          answers grounded only in what you trust. Let agents keep your knowledge fresh while
          your team collaborates live.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-accent text-accent-foreground px-5 h-11 font-medium hover:bg-accent/90"
          >
            Get started
          </Link>
          <a
            href="https://github.com"
            className="inline-flex items-center justify-center rounded-md border px-5 h-11 font-medium hover:bg-muted"
          >
            Star on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
