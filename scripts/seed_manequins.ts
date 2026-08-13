import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://szbptnoviikflyzulhhs.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || '';

if (!supabaseKey) {
  console.error('VITE_SUPABASE_SERVICE_KEY não definida. Rode: VITE_SUPABASE_SERVICE_KEY=<key> npx tsx scripts/seed_manequins.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'elementos';

const manequins = [
  { file: 'public/manequins/ampulheta.jpg',           path: 'manequins/ampulheta.jpg',           contentType: 'image/jpeg' },
  { file: 'public/manequins/triangulo.jpg',           path: 'manequins/triangulo.jpg',           contentType: 'image/jpeg' },
  { file: 'public/manequins/triangulo_invertido.jpg', path: 'manequins/triangulo_invertido.jpg', contentType: 'image/jpeg' },
  { file: 'public/manequins/retangulo.jpg',           path: 'manequins/retangulo.jpg',           contentType: 'image/jpeg' },
];

async function main() {
  for (const m of manequins) {
    const filePath = path.resolve(process.cwd(), m.file);
    const buffer = fs.readFileSync(filePath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(m.path, buffer, { contentType: m.contentType, upsert: true });

    if (error) {
      console.error(`[ERRO] ${m.path}:`, error.message);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(m.path);
    console.log(`✅ ${m.path} → ${data.publicUrl}`);
  }
}

main();
