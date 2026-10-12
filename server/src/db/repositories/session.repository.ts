import Database from 'better-sqlite3';
import crypto from 'crypto';
import { Message, Session, ExtractedRequirements } from '../../types/index.js';
import { getDatabase } from '../database.js';

export interface ISessionRepository {
  getOrCreateSession(sessionId?: string): Session;
  addMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    recommendedProductIds?: string[];
    extractedRequirements?: ExtractedRequirements;
  }): Message;
  getMessages(sessionId: string, limit?: number): Message[];
  getLastRecommendedProducts(sessionId: string): string[];
  getLastRequirements(sessionId: string): ExtractedRequirements | null;
  clearSession(sessionId: string): void;
}

interface RawMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  recommended_product_ids: string | null;
  extracted_requirements: string | null;
  created_at: string;
}

export class SqliteSessionRepository implements ISessionRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  getOrCreateSession(sessionId?: string): Session {
    if (sessionId) {
      const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
      const existing = stmt.get(sessionId) as Session | undefined;
      if (existing) {
        return existing;
      }
    }

    const newId = sessionId || `session_${crypto.randomUUID()}`;
    const insertStmt = this.db.prepare(
      'INSERT INTO sessions (id, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    );
    insertStmt.run(newId);

    return {
      id: newId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  addMessage(params: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    recommendedProductIds?: string[];
    extractedRequirements?: ExtractedRequirements;
  }): Message {
    this.getOrCreateSession(params.sessionId);

    const messageId = `msg_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, role, content,
        recommended_product_ids, extracted_requirements, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      messageId,
      params.sessionId,
      params.role,
      params.content,
      params.recommendedProductIds ? JSON.stringify(params.recommendedProductIds) : null,
      params.extractedRequirements ? JSON.stringify(params.extractedRequirements) : null,
      now
    );

    // Update session timestamp
    this.db.prepare('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(params.sessionId);

    return {
      id: messageId,
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      recommended_product_ids: params.recommendedProductIds,
      extracted_requirements: params.extractedRequirements,
      created_at: now,
    };
  }

  getMessages(sessionId: string, limit = 20): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM (
        SELECT *, rowid as row_id FROM messages
        WHERE session_id = ?
        ORDER BY row_id DESC
        LIMIT ?
      ) ORDER BY row_id ASC
    `);

    const rows = stmt.all(sessionId, limit) as RawMessageRow[];
    return rows.map((r) => {
      let recommendedProductIds: string[] | undefined;
      try {
        if (r.recommended_product_ids) {
          recommendedProductIds = JSON.parse(r.recommended_product_ids);
        }
      } catch {
        recommendedProductIds = undefined;
      }

      let extractedRequirements: ExtractedRequirements | undefined;
      try {
        if (r.extracted_requirements) {
          extractedRequirements = JSON.parse(r.extracted_requirements);
        }
      } catch {
        extractedRequirements = undefined;
      }

      return {
        id: r.id,
        session_id: r.session_id,
        role: r.role,
        content: r.content,
        recommended_product_ids: recommendedProductIds,
        extracted_requirements: extractedRequirements,
        created_at: r.created_at,
      };
    });
  }

  getLastRecommendedProducts(sessionId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT recommended_product_ids FROM messages
      WHERE session_id = ? AND role = 'assistant' AND recommended_product_ids IS NOT NULL
      ORDER BY rowid DESC
      LIMIT 1
    `);

    const row = stmt.get(sessionId) as { recommended_product_ids: string } | undefined;
    if (!row || !row.recommended_product_ids) return [];

    try {
      return JSON.parse(row.recommended_product_ids);
    } catch {
      return [];
    }
  }

  getLastRequirements(sessionId: string): ExtractedRequirements | null {
    const stmt = this.db.prepare(`
      SELECT extracted_requirements FROM messages
      WHERE session_id = ? AND extracted_requirements IS NOT NULL
      ORDER BY rowid DESC
      LIMIT 1
    `);

    const row = stmt.get(sessionId) as { extracted_requirements: string } | undefined;
    if (!row || !row.extracted_requirements) return null;

    try {
      return JSON.parse(row.extracted_requirements);
    } catch {
      return null;
    }
  }

  clearSession(sessionId: string): void {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
}
