import type { CheckResult } from "@/components/RiskResultCard";

type Outcome =
  | { kind: "idle" | "loading" }
  | { kind: "risk"; result: CheckResult }
  | { kind: "meta" | "error"; message: string };
export type EmbedDraft = { text: string; revision: number; outcome: Outcome };
export const emptyEmbedDraft: EmbedDraft = { text: "", revision: 0, outcome: { kind: "idle" } };
type Event =
  | { type: "edit"; text: string }
  | { type: "start"; revision: number }
  | { type: "finish"; revision: number; outcome: Exclude<Outcome, { kind: "idle" | "loading" }> };

export function embedCheckReducer(state: EmbedDraft, event: Event): EmbedDraft {
  if (event.type === "edit") {
    return { text: event.text, revision: state.revision + 1, outcome: { kind: "idle" } };
  }
  if (event.revision !== state.revision) return state;
  if (event.type === "start") return { ...state, outcome: { kind: "loading" } };
  if (state.outcome.kind !== "loading") return state;
  return { ...state, outcome: event.outcome };
}
