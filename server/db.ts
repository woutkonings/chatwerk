// The SQLite store: song versions (append-only), chat, reactions and a log of
// every agent turn. A restore makes a new version, so the history stays linear.
import Database from 'better-sqlite3';
import type { ChatEntry, ChatKind, Reaction, ReactionCounts, VersionInfo } from '../shared/protocol.ts';
import type { Song } from '../shared/schema.ts';

const SCHEMA = `
create table if not exists song_versions (
  room_id text not null,
  n integer not null,
  created_at integer not null,
  author text not null,
  summary text not null,
  song_json text not null,
  primary key (room_id, n)
);
create table if not exists chat (
  id integer primary key autoincrement,
  room_id text not null,
  created_at integer not null,
  author text not null,
  kind text not null,
  text text not null,
  to_band integer not null default 0
);
create index if not exists chat_room on chat (room_id, id);
create table if not exists reactions (
  room_id text not null,
  version integer not null,
  client_id text not null,
  reaction text not null,
  primary key (room_id, version, client_id, reaction)
);
create table if not exists turns (
  id integer primary key autoincrement,
  room_id text not null,
  created_at integer not null,
  messages_json text not null,
  outcome_json text not null,
  cost_usd real not null,
  latency_ms integer not null
);
create index if not exists turns_time on turns (created_at);
create table if not exists rooms (
  room_id text primary key,
  state_json text not null,
  updated_at integer not null
);
`;

export type TurnLog = { messages: unknown; outcome: unknown; costUsd: number; latencyMs: number };

export class Store {
  private db: Database.Database;

  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  latestSong(roomId: string): Song | undefined {
    const row = this.db.prepare('select song_json from song_versions where room_id = ? order by n desc limit 1').get(roomId) as { song_json: string } | undefined;
    return row ? (JSON.parse(row.song_json) as Song) : undefined;
  }

  song(roomId: string, n: number): Song | undefined {
    const row = this.db.prepare('select song_json from song_versions where room_id = ? and n = ?').get(roomId, n) as { song_json: string } | undefined;
    return row ? (JSON.parse(row.song_json) as Song) : undefined;
  }

  addVersion(roomId: string, song: Song, author: string, summary: string, at = Date.now()): VersionInfo {
    this.db.prepare('insert into song_versions (room_id, n, created_at, author, summary, song_json) values (?, ?, ?, ?, ?, ?)')
      .run(roomId, song.version, at, author, summary, JSON.stringify(song));
    return { n: song.version, at, author, summary };
  }

  versions(roomId: string, limit = 100): VersionInfo[] {
    const rows = this.db.prepare('select n, created_at as at, author, summary from song_versions where room_id = ? order by n desc limit ?').all(roomId, limit) as VersionInfo[];
    return rows.reverse();
  }

  addChat(roomId: string, author: string, kind: ChatKind, text: string, toBand: boolean, at = Date.now()): ChatEntry {
    const result = this.db.prepare('insert into chat (room_id, created_at, author, kind, text, to_band) values (?, ?, ?, ?, ?, ?)')
      .run(roomId, at, author, kind, text, toBand ? 1 : 0);
    return { id: Number(result.lastInsertRowid), at, author, kind, text, toBand };
  }

  chat(roomId: string, limit = 50): ChatEntry[] {
    const rows = this.db.prepare('select id, created_at as at, author, kind, text, to_band from chat where room_id = ? order by id desc limit ?').all(roomId, limit) as (Omit<ChatEntry, 'toBand'> & { to_band: number })[];
    return rows.reverse().map(({ to_band, ...entry }) => ({ ...entry, toBand: to_band === 1 }));
  }

  // Sets or clears one reaction of one client, and returns the new counts for the version.
  react(roomId: string, version: number, clientId: string, reaction: Reaction, on: boolean): Partial<Record<Reaction, number>> {
    if (on) this.db.prepare('insert or ignore into reactions (room_id, version, client_id, reaction) values (?, ?, ?, ?)').run(roomId, version, clientId, reaction);
    else this.db.prepare('delete from reactions where room_id = ? and version = ? and client_id = ? and reaction = ?').run(roomId, version, clientId, reaction);
    return this.reactions(roomId)[version] ?? {};
  }

  reactions(roomId: string): ReactionCounts {
    const rows = this.db.prepare('select version, reaction, count(*) as count from reactions where room_id = ? group by version, reaction').all(roomId) as { version: number; reaction: Reaction; count: number }[];
    const counts: ReactionCounts = {};
    for (const row of rows) (counts[row.version] ??= {})[row.reaction] = row.count;
    return counts;
  }

  reactionsOf(roomId: string, clientId: string): { version: number; reaction: Reaction }[] {
    return this.db.prepare('select version, reaction from reactions where room_id = ? and client_id = ?').all(roomId, clientId) as { version: number; reaction: Reaction }[];
  }

  logTurn(roomId: string, log: TurnLog, at = Date.now()) {
    this.db.prepare('insert into turns (room_id, created_at, messages_json, outcome_json, cost_usd, latency_ms) values (?, ?, ?, ?, ?, ?)')
      .run(roomId, at, JSON.stringify(log.messages), JSON.stringify(log.outcome), log.costUsd, log.latencyMs);
  }

  // The room state that must survive a restart: the clock, the live set, the autopilot.
  roomState<T>(roomId: string): T | undefined {
    const row = this.db.prepare('select state_json from rooms where room_id = ?').get(roomId) as { state_json: string } | undefined;
    return row ? (JSON.parse(row.state_json) as T) : undefined;
  }

  saveRoomState(roomId: string, state: unknown, at = Date.now()) {
    this.db.prepare('insert into rooms (room_id, state_json, updated_at) values (?, ?, ?) on conflict (room_id) do update set state_json = excluded.state_json, updated_at = excluded.updated_at')
      .run(roomId, JSON.stringify(state), at);
  }

  // The model cost of all rooms since a moment, for the daily budget.
  costSince(since: number): number {
    const row = this.db.prepare('select coalesce(sum(cost_usd), 0) as total from turns where created_at >= ?').get(since) as { total: number };
    return row.total;
  }
}
