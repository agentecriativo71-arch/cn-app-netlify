import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseFallback = createClient(supabaseUrl, supabaseKey);

let pool: pg.Pool | null = null;
const dbUrl = process.env.DATABASE_URL;

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
  
  pool.query(`
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
  `).catch(err => {
    console.error('[DB] Error verifying/creating looks table:', err);
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
      INSERT INTO looks (ocasiao, tipo_cerimonia, renda_decisao, biotipo, peca, comprimento, decote, manga, cor, tecido_sku, croqui_url, foto_usuario_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      data.cor,
      data.tecido_sku,
      data.croqui_url,
      data.foto_usuario_url
    ];
    const res = await pool.query(query, values);
    return res.rows[0].id;
  } else {
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
    const { error } = await supabaseFallback
      .from('looks')
      .update(update)
      .eq('id', id);
    if (error) throw error;
  }
}
