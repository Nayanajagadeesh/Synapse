/**
 * Hand-written subset of the Supabase generated types. Run
 * `supabase gen types typescript --project-id <id>` to replace this file
 * with a fully generated version once you have a project linked.
 */

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      notebooks: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          emoji: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notebooks"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["notebooks"]["Row"]>;
      };
      notebook_members: {
        Row: {
          notebook_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["notebook_role"];
          invited_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notebook_members"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["notebook_members"]["Row"]>;
      };
      sources: {
        Row: {
          id: string;
          notebook_id: string;
          kind: Database["public"]["Enums"]["source_kind"];
          title: string;
          url: string | null;
          storage_path: string | null;
          status: Database["public"]["Enums"]["source_status"];
          error: string | null;
          metadata: Json;
          refresh_interval_minutes: number | null;
          last_synced_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sources"]["Row"]> & {
          notebook_id: string;
          kind: Database["public"]["Enums"]["source_kind"];
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Row"]>;
      };
      chunks: {
        Row: {
          id: string;
          source_id: string;
          notebook_id: string;
          ord: number;
          content: string;
          embedding: number[] | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chunks"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["chunks"]["Row"]>;
      };
      messages: {
        Row: {
          id: string;
          notebook_id: string;
          user_id: string | null;
          role: Database["public"]["Enums"]["message_role"];
          content: string;
          citations: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          notebook_id: string;
          role: Database["public"]["Enums"]["message_role"];
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
      notes: {
        Row: {
          id: string;
          notebook_id: string;
          source_id: string | null;
          kind: Database["public"]["Enums"]["note_kind"];
          title: string | null;
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notes"]["Row"]> & {
          notebook_id: string;
          kind: Database["public"]["Enums"]["note_kind"];
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Row"]>;
      };
      comments: {
        Row: {
          id: string;
          notebook_id: string;
          author_id: string;
          parent_id: string | null;
          chunk_id: string | null;
          note_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & {
          notebook_id: string;
          author_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
      };
      agents: {
        Row: {
          id: string;
          notebook_id: string;
          name: string;
          instructions: string;
          schedule_cron: string | null;
          status: Database["public"]["Enums"]["agent_status"];
          last_run_at: string | null;
          last_error: string | null;
          config: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agents"]["Row"]> & {
          notebook_id: string;
          name: string;
          instructions: string;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          notebook_id: string | null;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          kind: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
    };
    Views: {};
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          match_count: number;
          filter_notebook: string | null;
        };
        Returns: {
          id: string;
          source_id: string;
          notebook_id: string;
          content: string;
          ord: number;
          metadata: Json;
          similarity: number;
        }[];
      };
      notebook_role_for: {
        Args: { target: string; uid: string };
        Returns: Database["public"]["Enums"]["notebook_role"] | null;
      };
    };
    Enums: {
      notebook_role: "viewer" | "editor" | "admin";
      source_kind: "pdf" | "docx" | "txt" | "url" | "youtube" | "rss";
      source_status: "pending" | "processing" | "ready" | "error";
      message_role: "user" | "assistant" | "system";
      note_kind: "summary" | "outline" | "eli5" | "exam" | "research" | "insight";
      agent_status: "idle" | "running" | "error";
    };
  };
}
