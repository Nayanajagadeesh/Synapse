"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props { profile?: { display_name: string | null; email: string | null; avatar_url: string | null } }

export function TopBar({ profile }: Props) {
  const router = useRouter();
  const initials = (profile?.display_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase();
  async function signOut() {
    const supa = createSupabaseBrowserClient();
    await supa.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="h-14 flex items-center justify-between px-5">
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground px-2">
          Sign out
        </button>
        <Avatar>
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
