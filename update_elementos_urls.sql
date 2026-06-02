-- ==============================================================================
-- Query de Migração de URLs do Supabase (imrpadvhfykrrmcrwbmb -> szbptnoviikflyzulhhs)
-- ==============================================================================

-- OPÇÃO 1 (Recomendada): Atualização global por substituição de texto (REPLACE)
-- Esta query substitui o domínio antigo pelo novo em qualquer linha, sem depender do ID ou nome exato da coluna.
UPDATE elementos_vestuario
SET image_url = REPLACE(image_url, 'https://imrpadvhfykrrmcrwbmb.supabase.co', 'https://szbptnoviikflyzulhhs.supabase.co')
WHERE image_url LIKE '%https://imrpadvhfykrrmcrwbmb.supabase.co%';


-- OPÇÃO 2: Atualização individual por nome (caso prefira atualizar item por item)
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-curta.png' WHERE nome = 'Curta (Short Sleeve)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-longa.png' WHERE nome = 'Longa (Long Sleeve)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-3-4.png' WHERE nome = '3/4 (Three-Quarter)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-raglan.png' WHERE nome = 'Raglan';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-flutuante.png' WHERE nome = 'Flutuante (Flutter)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-bufante.png' WHERE nome = 'Bufante / Puff';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-sino.png' WHERE nome = 'Sino (Bell Sleeve)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-morcego.png' WHERE nome = 'Morcego (Batwing)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-cigana.png' WHERE nome = 'Cigana';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manga-japonesa.png' WHERE nome = 'Japonesa';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-evase.png' WHERE nome = 'Evasê';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-reta.png' WHERE nome = 'Reta (Straight)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-plissada.png' WHERE nome = 'Plissada';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-gode.png' WHERE nome = 'Godê Simples';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-lapis.png' WHERE nome = 'Lápis (Pencil)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-envelope.png' WHERE nome = 'Envelope';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/saia-assimetrica.png' WHERE nome = 'Assimétrica';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-redondo.png' WHERE nome = 'Redondo (Crew Neck)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-quadrado.png' WHERE nome = 'Quadrado (Square)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-v.png' WHERE nome = 'V (V-Neck)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-frente-unica.png' WHERE nome = 'Frente Única';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-canoa.png' WHERE nome = 'Canoa';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-coracao.png' WHERE nome = 'Coração (Sweetheart)';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/tomara-que-caia.png' WHERE nome = 'Tomara que Caia';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/decote-ombro-a-ombro.png' WHERE nome = 'Ombro a Ombro';
UPDATE elementos_vestuario SET image_url = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/gola-alta.png' WHERE nome = 'Gola Alta';
