/** App-level types that compose database rows with derived state for the UI. */

import type { Database } from "./database";

export type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type Member = Database["public"]["Tables"]["notebook_members"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface Citation {
  chunk_id: string;
  source_id: string;
  ord: number;
  tag: number;
}

export interface ChatMessageView extends Message {
  citations: Citation[];
}
