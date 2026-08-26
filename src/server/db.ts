import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import type { ReferenceAnalysis, ReferencePiece } from '../lib/referenceUtils';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseFallback = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

let pool: pg.Pool | null = null;
const dbUrl = process.env.DATABASE_URL;
let dbReady: Promise<unknown> = Promise.resolve();

function shouldUseSsl(url: string): boolean {
  // Desabilita SSL se explicitamente indicado na URL
  if (url.includes('sslmode=disable') || url.includes('ssl=false')) return false;
  // Desabilita SSL para hosts internos (localhost, db, nomes sem ponto = rede Docker)
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || !host.includes('.')) return false;
  } catch { /* ignora erro de parse */ }
  return true;
}

if (dbUrl) {
  const useSsl = shouldUseSsl(dbUrl);
  console.log(`[DB] Connecting to PostgreSQL via DATABASE_URL... (SSL: ${useSsl})`);
  pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });
  
  dbReady = pool.query(`
    CREATE TABLE IF NOT EXISTS looks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ocasiao VARCHAR(255),
      biotipo VARCHAR(255),
      peca VARCHAR(255),
      comprimento VARCHAR(255),
      decote VARCHAR(255),
      manga VARCHAR(255),
      cor VARCHAR(255),
      foto_usuario_url TEXT,
      croqui_url TEXT,
      realista_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS nome_cliente VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS telefone_cliente VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS tipo_cerimonia VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS renda_decisao BOOLEAN;
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS tecido_sku VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS possui_manga BOOLEAN;
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS saia VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS renda VARCHAR(255);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS comentario TEXT;
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS generation_provider VARCHAR(50);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS generation_model VARCHAR(100);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS generation_prompt_version VARCHAR(100);
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS generation_candidates JSONB;
    ALTER TABLE looks ADD COLUMN IF NOT EXISTS specification JSONB;

    CREATE TABLE IF NOT EXISTS upload_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome_cliente VARCHAR(255),
      ocasiao VARCHAR(255),
      reference_piece VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      croqui_url TEXT,
      reference_analysis JSONB,
      analysis_error_code VARCHAR(100),
      vision_provider VARCHAR(50),
      vision_model VARCHAR(100),
      prompt_version VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '15 minutes'
    );
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS ocasiao VARCHAR(255);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS reference_piece VARCHAR(50);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS reference_analysis JSONB;
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS analysis_error_code VARCHAR(100);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS vision_provider VARCHAR(50);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS vision_model VARCHAR(100);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(100);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS generation_provider VARCHAR(50);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS generation_model VARCHAR(100);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS generation_prompt_version VARCHAR(100);
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS generation_candidates JSONB;
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS specification JSONB;
    ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  `).catch(err => {
    console.error('[DB] Error verifying/creating tables:', err);
  });
} else {
  console.log('[DB] DATABASE_URL not set. Falling back to Supabase for looks database...');
}

export type ProductSearchResult = {
  id: number;
  name: string;
  sku: string;
  image_url: string | null;
  pantone: string | null;
  tag: string | null;
};

export async function searchProducts(term: string): Promise<ProductSearchResult[]> {
  const cleanTerm = term.trim();
  if (!cleanTerm) return [];

  if (pool) {
    const query = `
      SELECT id, name, sku, image_url, pantone, tag
      FROM products
      WHERE sku ILIKE $1 OR name ILIKE $1
      ORDER BY id DESC
      LIMIT 10;
    `;
    const res = await pool.query(query, [`%${cleanTerm}%`]);
    return res.rows;
  } else {
    if (!supabaseFallback) return [];
    const { data, error } = await supabaseFallback
      .from('products')
      .select('id, name, sku, image_url, pantone, tag')
      .or(`sku.ilike.%${cleanTerm}%,name.ilike.%${cleanTerm}%`)
      .limit(10);

    if (error) {
      console.warn('[DB] Error searching products on Supabase:', error);
      return [];
    }
    return data || [];
  }
}

export async function saveLook(data: any): Promise<string> {
  if (pool) {
    const query = `
      INSERT INTO looks (ocasiao, tipo_cerimonia, renda_decisao, biotipo, peca, comprimento, decote, manga, possui_manga, saia, renda, comentario, cor, tecido_sku, croqui_url, foto_usuario_url, generation_provider, generation_model, generation_prompt_version, generation_candidates, specification)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id;
    `;
    const values = [
      data.ocasiao,
      data.tipo_cerimonia,
      data.renda_decisao,
      data.biotipo,
      data.peca,
      data.comprimento,
      data.decote,
      data.manga,
      data.possui_manga,
      data.saia,
      data.renda,
      data.comentario,
      data.cor,
      data.tecido_sku,
      data.croqui_url,
      data.foto_usuario_url,
      data.generation_provider,
      data.generation_model,
      data.generation_prompt_version,
      data.generation_candidates ? JSON.stringify(data.generation_candidates) : null,
      data.specification ? JSON.stringify(data.specification) : null,
    ];
    const res = await pool.query(query, values);
    return res.rows[0].id;
  } else {
    if (!supabaseFallback) throw new Error('DATABASE_URL não configurado e Supabase fallback indisponível.');
    const { data: dbData, error } = await supabaseFallback
      .from('looks')
      .insert([data])
      .select('id')
      .single();
    if (error) throw error;
    return dbData.id;
  }
}

export async function updateLook(id: string, update: any): Promise<void> {
  if (pool) {
    const setClause = Object.keys(update)
      .map((key, idx) => `"${key}" = $${idx + 2}`)
      .join(', ');
    const query = `
      UPDATE looks
      SET ${setClause}
      WHERE id = $1;
    `;
    const values = [id, ...Object.values(update)];
    await pool.query(query, values);
  } else {
    if (!supabaseFallback) throw new Error('DATABASE_URL não configurado e Supabase fallback indisponível.');
    const { error } = await supabaseFallback
      .from('looks')
      .update(update)
      .eq('id', id);
    if (error) throw error;
  }
}

export type UploadSession = {
  id: string;
  nome_cliente: string | null;
  ocasiao?: string | null;
  reference_piece?: ReferencePiece | null;
  status: string;
  croqui_url: string | null;
  specs?: any;
  reference_analysis?: ReferenceAnalysis | null;
  analysis_error_code?: string | null;
  vision_provider?: string | null;
  vision_model?: string | null;
  prompt_version?: string | null;
  generation_provider?: string | null;
  generation_model?: string | null;
  generation_prompt_version?: string | null;
  generation_candidates?: Array<{ url: string; seed: number; score: number; rejected: boolean; rejectionReasons: string[] }> | null;
  specification?: JsonObject | null;
  updated_at?: string;
  created_at?: string;
  expires_at?: string;
};

const memoryUploadSessions = new Map<string, UploadSession>();

export async function createUploadSession(nomeCliente: string, ocasiao?: string, referencePiece?: ReferencePiece | null): Promise<UploadSession> {
  const sessionId = randomUUID();
  const createdAt = new Date();
  const session: UploadSession = {
    id: sessionId,
    nome_cliente: nomeCliente,
    ocasiao: ocasiao || null,
    reference_piece: referencePiece || null,
    status: 'pending',
    croqui_url: null,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    expires_at: new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString(),
  };

  if (process.env.NODE_ENV === 'test') {
    memoryUploadSessions.set(sessionId, session);
    return session;
  }

  if (pool) {
    await dbReady;
    const query = `
      INSERT INTO upload_sessions (id, nome_cliente, ocasiao, reference_piece, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, nome_cliente, ocasiao, reference_piece, status, croqui_url, reference_analysis, analysis_error_code, vision_provider, vision_model, prompt_version, created_at, updated_at, expires_at;
    `;
    const res = await pool.query(query, [sessionId, nomeCliente, ocasiao || null, referencePiece || null]);
    return res.rows[0];
  } else {
    memoryUploadSessions.set(sessionId, session);
    return session;
  }
}

function isExpired(session: UploadSession): boolean {
  if (!session.expires_at || ['uploaded', 'expired'].includes(session.status)) return false;
  return new Date(session.expires_at).getTime() <= Date.now();
}

async function markSessionExpired(session: UploadSession): Promise<UploadSession> {
  if (!isExpired(session)) return session;
  await updateUploadSessionStatus(session.id, 'expired');
  return { ...session, status: 'expired' };
}

export async function getUploadSession(id: string): Promise<UploadSession | null> {
  if (process.env.NODE_ENV === 'test') {
    return memoryUploadSessions.get(id) || null;
  }

  if (pool) {
    await dbReady;
    const query = `
      SELECT id, nome_cliente, ocasiao, reference_piece, status, croqui_url, reference_analysis, analysis_error_code, vision_provider, vision_model, prompt_version, generation_provider, generation_model, generation_prompt_version, generation_candidates, specification, created_at, updated_at, expires_at
      FROM upload_sessions
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] ? markSessionExpired(res.rows[0]) : null;
  } else {
    const session = memoryUploadSessions.get(id);
    return session ? markSessionExpired(session) : null;
  }
}

export type UploadSessionPatch = {
  status?: string;
  croquiUrl?: string | null;
  referenceAnalysis?: ReferenceAnalysis | null;
  analysisErrorCode?: string | null;
  visionProvider?: string | null;
  visionModel?: string | null;
  promptVersion?: string | null;
  generationProvider?: string | null;
  generationModel?: string | null;
  generationPromptVersion?: string | null;
  generationCandidates?: Array<{ url: string; seed: number; score: number; rejected: boolean; rejectionReasons: string[] }> | null;
  specification?: JsonObject | null;
};

export async function updateUploadSession(id: string, patch: UploadSessionPatch): Promise<void> {
  const sess = memoryUploadSessions.get(id);
  if (sess) {
    if (patch.status) sess.status = patch.status;
    if (patch.croquiUrl !== undefined) sess.croqui_url = patch.croquiUrl;
    if (patch.referenceAnalysis !== undefined) {
      sess.reference_analysis = patch.referenceAnalysis;
      sess.specs = patch.referenceAnalysis;
    }
    if (patch.analysisErrorCode !== undefined) sess.analysis_error_code = patch.analysisErrorCode;
    if (patch.visionProvider !== undefined) sess.vision_provider = patch.visionProvider;
    if (patch.visionModel !== undefined) sess.vision_model = patch.visionModel;
    if (patch.promptVersion !== undefined) sess.prompt_version = patch.promptVersion;
    if (patch.generationProvider !== undefined) sess.generation_provider = patch.generationProvider;
    if (patch.generationModel !== undefined) sess.generation_model = patch.generationModel;
    if (patch.generationPromptVersion !== undefined) sess.generation_prompt_version = patch.generationPromptVersion;
    if (patch.generationCandidates !== undefined) sess.generation_candidates = patch.generationCandidates;
    if (patch.specification !== undefined) sess.specification = patch.specification;
    sess.updated_at = new Date().toISOString();
  }

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (pool) {
    await dbReady;
    const values: unknown[] = [id];
    const assignments: string[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.croquiUrl !== undefined) add('croqui_url', patch.croquiUrl);
    if (patch.referenceAnalysis !== undefined) add('reference_analysis', patch.referenceAnalysis ? JSON.stringify(patch.referenceAnalysis) : null);
    if (patch.analysisErrorCode !== undefined) add('analysis_error_code', patch.analysisErrorCode);
    if (patch.visionProvider !== undefined) add('vision_provider', patch.visionProvider);
    if (patch.visionModel !== undefined) add('vision_model', patch.visionModel);
    if (patch.promptVersion !== undefined) add('prompt_version', patch.promptVersion);
    if (patch.generationProvider !== undefined) add('generation_provider', patch.generationProvider);
    if (patch.generationModel !== undefined) add('generation_model', patch.generationModel);
    if (patch.generationPromptVersion !== undefined) add('generation_prompt_version', patch.generationPromptVersion);
    if (patch.generationCandidates !== undefined) add('generation_candidates', patch.generationCandidates ? JSON.stringify(patch.generationCandidates) : null);
    if (patch.specification !== undefined) add('specification', patch.specification ? JSON.stringify(patch.specification) : null);
    if (assignments.length === 0) return;
    assignments.push('updated_at = CURRENT_TIMESTAMP');
    try {
      await pool.query(`UPDATE upload_sessions SET ${assignments.join(', ')} WHERE id = $1;`, values);
    } catch (err) {
      console.warn('[DB] Error updating upload_sessions status:', err);
    }
  } else {
    // O projeto Supabase real não possui upload_sessions. Sem DATABASE_URL usamos apenas a memória local.
  }
}

export async function updateUploadSessionStatus(id: string, status: string, croquiUrl?: string | null, specs?: ReferenceAnalysis): Promise<void> {
  await updateUploadSession(id, { status, croquiUrl, referenceAnalysis: specs });
}

export async function confirmUploadSession(id: string, croquiUrl: string, specs?: ReferenceAnalysis): Promise<void> {
  await updateUploadSession(id, { status: 'uploaded', croquiUrl, referenceAnalysis: specs });
}

export async function claimUploadSessionForGeneration(id: string): Promise<boolean> {
  const session = await getUploadSession(id);
  if (!session || session.status !== 'analysis_ready') return false;
  if (process.env.NODE_ENV === 'test' || !pool) {
    const memorySession = memoryUploadSessions.get(id);
    if (!memorySession || memorySession.status !== 'analysis_ready') return false;
    memorySession.status = 'generating';
    return true;
  }
  await dbReady;
  const result = await pool.query(
    `UPDATE upload_sessions SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'analysis_ready' AND expires_at > CURRENT_TIMESTAMP;`,
    [id],
  );
  return result.rowCount === 1;
}
