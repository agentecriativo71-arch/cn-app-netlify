import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseFallback = createClient(supabaseUrl, supabaseKey);

let pool: pg.Pool | null = null;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log('[DB] Connecting to internal PostgreSQL via DATABASE_URL...');
  pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
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
  `).catch(err => {
    console.error('[DB] Error verifying/creating looks table:', err);
  });
} else {
  console.log('[DB] DATABASE_URL not set. Falling back to Supabase for looks database...');
}

export async function saveLook(data: any): Promise<string> {
  if (pool) {
    const query = `
      INSERT INTO looks (ocasiao, tipo_cerimonia, renda_decisao, biotipo, peca, comprimento, decote, manga, cor, croqui_url, foto_usuario_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
