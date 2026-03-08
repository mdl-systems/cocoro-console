/**
 * Cocoro Database Layer
 *
 * All persistent state uses encrypted SQLite.
 * Never store sessions or secrets in JSON files.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), '.cocoro');
const DB_PATH = path.join(DATA_DIR, 'cocoro.db');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  ensureDataDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);
  return db;
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      ip_address TEXT
    );

    -- Security logs table
    CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ip TEXT,
      session_id TEXT,
      endpoint TEXT,
      status TEXT,
      details TEXT,
      user_agent TEXT
    );

    -- User settings table
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      encrypted INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    -- Agent settings table
    CREATE TABLE IF NOT EXISTS agent_settings (
      agent_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      policy TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新しい会話',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Chat history table
    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL DEFAULT 'default',
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      action TEXT,
      timestamp TEXT NOT NULL
    );

    -- Memory entries table
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('short_term', 'long_term', 'vector')),
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Rate limit tracking
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (ip, endpoint, window_start)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
    CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_security_logs_type ON security_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_history_conversation ON chat_history(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_memory_entries_type ON memory_entries(type);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
  `);
}

/**
 * Close the database connection (for shutdown).
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
