import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLook } from '../lib/store';
import { claimUploadSessionForGeneration, createUploadSession, getUploadSession, confirmUploadSession, updateUploadSessionStatus } from '../server/db';

describe('Upload Session & Store Integration', () => {
  beforeEach(() => {
    useLook.getState().reset();
  });

  it('deve armazenar croquiUploadSessionId no store', () => {
    const s = useLook.getState();
    expect(s.croquiUploadSessionId).toBeNull();

    useLook.getState().set({ croquiUploadSessionId: 'test-session-123' });
    expect(useLook.getState().croquiUploadSessionId).toBe('test-session-123');

    useLook.getState().reset();
    expect(useLook.getState().croquiUploadSessionId).toBeNull();
  });

  it('deve manipular sessões de upload no DB/Supabase', async () => {
    // Test createUploadSession, getUploadSession, confirmUploadSession
    const session = await createUploadSession('Maria Silva');
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.status).toBe('pending');
    expect(session.nome_cliente).toBe('Maria Silva');

    const fetched = await getUploadSession(session.id);
    expect(fetched).toBeDefined();
    expect(fetched?.status).toBe('pending');

    await confirmUploadSession(session.id, 'https://example.com/croqui.jpg');

    const updated = await getUploadSession(session.id);
    expect(updated?.status).toBe('uploaded');
    expect(updated?.croqui_url).toBe('https://example.com/croqui.jpg');
  });

  it('deve persistir ocasião e impedir duas confirmações concorrentes', async () => {
    const session = await createUploadSession('Joana', 'Festa', 'Vestido');
    expect(session.ocasiao).toBe('Festa');
    expect(session.reference_piece).toBe('Vestido');

    await updateUploadSessionStatus(session.id, 'analysis_ready');
    expect(await claimUploadSessionForGeneration(session.id)).toBe(true);
    expect(await claimUploadSessionForGeneration(session.id)).toBe(false);
    expect((await getUploadSession(session.id))?.status).toBe('generating');
  });

  it('deve calcular a expiração da sessão em quinze minutos', async () => {
    const before = Date.now();
    const session = await createUploadSession('Expiração');
    const after = Date.now();
    const expiresAt = new Date(session.expires_at as string).getTime();

    expect(expiresAt - new Date(session.created_at as string).getTime()).toBe(15 * 60 * 1000);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 15 * 60 * 1000);
  });
});
