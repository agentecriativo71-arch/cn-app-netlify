import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLook } from '../lib/store';
import { createUploadSession, getUploadSession, confirmUploadSession } from '../server/db';

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
});
