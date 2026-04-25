"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const supa = createSupabaseBrowserClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fn =
        mode === "sign-in"
          ? supa.auth.signInWithPassword({ email, password })
          : supa.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${location.origin}/auth/callback` },
            });
      const { error } = await fn;
      if (error) throw error;
      if (mode === "sign-up") {
        toast.success("Check your email to confirm your account.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    await supa.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="text-xl font-semibold">Synapse</Link>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-in" ? "Welcome back." : "Create your account."}
          </p>
        </div>
        <button
          onClick={handleGoogle}
          className="w-full h-10 rounded-md border bg-background hover:bg-muted text-sm font-medium"
        >
          Continue with Google
        </button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>
        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@team.com"
            className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="••••••••"
            className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            disabled={busy}
            className="w-full h-10 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {busy ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          {mode === "sign-in" ? "Don't have an account?" : "Already have one?"}{" "}
          <button
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
