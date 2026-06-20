// Single source of truth for the "Is This Seat Taken?"-style conference puzzle.
// Framework-agnostic: consumed by the Phaser scene AND any React fallback.
// To re-theme per paper, an AI pipeline edits ONLY this file.

export type Room = "A" | "B" | "C";
export type SessionId = "Keynote" | "RAG" | "Agents" | "Robotics" | "Safety" | "Multimodal";
export type Cell = { room: Room; slot: number };
export type Assignment = Partial<Record<SessionId, Cell>>;
export type Mood = "idle" | "waiting" | "sad" | "happy";
export type WishState = "pending" | "ok" | "bad";
export interface WishStatus { text: string; short: string; state: WishState; }

export interface SessionDef {
  id: SessionId;
  name: string;
  emoji: string;
  tag: string;
  color: number;   // body color (hex int for Phaser)
  accent: number;  // darker shade for outline/details
}

export interface RoomDef { id: Room; name: string; }

export interface Puzzle {
  venueName: string;
  rooms: RoomDef[];
  slots: string[];
  sessions: SessionDef[];
  closed: Cell[];
}

export const ROOMS: RoomDef[] = [
  { id: "A", name: "Auditorium" },
  { id: "B", name: "GPU Lab" },
  { id: "C", name: "Classroom" },
];

export const SLOTS = ["10 AM", "11 AM", "1 PM", "2 PM"];

export const SESSIONS: SessionDef[] = [
  { id: "Keynote",    name: "Keynote",    emoji: "\u{1F3A4}", tag: "VIP",      color: 0xf4c04a, accent: 0xcf9a2c },
  { id: "RAG",        name: "RAG",        emoji: "\u{1F4DA}", tag: "Workshop", color: 0x6cb6e4, accent: 0x4690bf },
  { id: "Agents",     name: "Agents",     emoji: "\u{1F916}", tag: "Workshop", color: 0xae9bf0, accent: 0x8a73d8 },
  { id: "Robotics",   name: "Robotics",   emoji: "\u{1F9BE}", tag: "Lab",      color: 0x59cf9e, accent: 0x36a87b },
  { id: "Safety",     name: "Safety",     emoji: "\u{1F6E1}\uFE0F", tag: "Workshop", color: 0xf096a3, accent: 0xd16d7d },
  { id: "Multimodal", name: "Multimodal", emoji: "\u{1F5BC}\uFE0F", tag: "Workshop", color: 0xe888c9, accent: 0xc560a4 },
];

export const CLOSED: Cell[] = [{ room: "B", slot: 3 }]; // GPU Lab closes after 1 PM

export const defaultPuzzle: Puzzle = {
  venueName: "AI SUMMIT",
  rooms: ROOMS,
  slots: SLOTS,
  sessions: SESSIONS,
  closed: CLOSED,
};

export function sessionById(id: SessionId): SessionDef {
  return SESSIONS.find((s) => s.id === id) as SessionDef;
}

export function isClosed(room: Room, slot: number): boolean {
  return CLOSED.some((c) => c.room === room && c.slot === slot);
}

function ids(a: Assignment): SessionId[] {
  return Object.keys(a) as SessionId[];
}

export function occupantAt(a: Assignment, room: Room, slot: number): SessionId | undefined {
  return ids(a).find((k) => a[k]!.room === room && a[k]!.slot === slot);
}

function clashCount(a: Assignment, id: SessionId): number {
  const c = a[id];
  if (!c) return 0;
  return ids(a).filter((k) => a[k]!.room === c.room && a[k]!.slot === c.slot).length;
}

// Per-session wishes (the 8 constraints, expressed as each guest's wishes).
export function wishStatus(a: Assignment, id: SessionId): WishStatus[] {
  const c = a[id];
  const out: WishStatus[] = [];
  const add = (text: string, short: string, ready: boolean, ok: boolean) =>
    out.push({ text, short, state: !ready ? "pending" : ok ? "ok" : "bad" });
  switch (id) {
    case "Keynote":
      add("I open the day \u2014 seat me at 10 AM", "I wanted to open!", !!c, !!c && c.slot === 0);
      break;
    case "RAG": {
      const ag = a["Agents"];
      add("Don't put me at the same time as Agents", "We clash with Agents!", !!c && !!ag, !!c && !!ag && c.slot !== ag.slot);
      break;
    }
    case "Robotics": {
      add("I need the GPU Lab (Room B)", "I need the GPU Lab!", !!c, !!c && c.room === "B");
      const mm = a["Multimodal"];
      add("Seat me after Multimodal", "Put me after Multimodal!", !!c && !!mm, !!c && !!mm && c.slot > mm.slot);
      break;
    }
    case "Safety": {
      const ag = a["Agents"];
      add("Seat me after Agents", "I go after Agents!", !!c && !!ag, !!c && !!ag && c.slot > ag.slot);
      break;
    }
    case "Multimodal":
      add("Anywhere but the Classroom (Room C)", "Not the Classroom...", !!c, !!c && c.room !== "C");
      break;
    case "Agents":
      add("Easy-going \u2014 just give me a seat", "Find me a seat!", !!c, !!c);
      break;
  }
  return out;
}

export function mood(a: Assignment, id: SessionId): Mood {
  const c = a[id];
  if (!c) return "idle";
  if (clashCount(a, id) > 1) return "sad";
  if (isClosed(c.room, c.slot)) return "sad";
  const ws = wishStatus(a, id);
  if (ws.some((w) => w.state === "bad")) return "sad";
  if (ws.some((w) => w.state === "pending")) return "waiting";
  return "happy";
}

export function happyCount(a: Assignment): number {
  return SESSIONS.filter((s) => mood(a, s.id) === "happy").length;
}

export function isWin(a: Assignment): boolean {
  return happyCount(a) === SESSIONS.length;
}
