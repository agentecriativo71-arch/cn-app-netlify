import { describe, expect, it, vi } from "vitest";

// O script é compartilhado pelo CLI e pelo servidor Node.
// @ts-expect-error O script operacional é JavaScript ESM executado pelo runtime.
import { cleanupExpiredReferenceImages, findExpiredReferenceImages, REFERENCE_BUCKET } from "../../scripts/reference-image-cleanup.mjs";

describe("limpeza de referências legadas", () => {
  function makeStorage() {
    const remove = vi.fn().mockResolvedValue({ data: ["references/old.jpg"], error: null });
    const list = vi.fn().mockImplementation((prefix: string) => Promise.resolve({ data: prefix === "references" ? [
      { id: "old", name: "old.jpg", created_at: "2026-08-16T10:00:00.000Z" },
      { id: "new", name: "new.jpg", created_at: "2026-08-18T10:00:00.000Z" },
      { id: null, name: "nested" },
    ] : [], error: null }));
    return { client: { storage: { from: vi.fn(() => ({ list, remove })) } }, list, remove };
  }

  it("seleciona somente arquivos expirados dentro de references", async () => {
    const { client } = makeStorage();
    const paths = await findExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z") });
    expect(paths).toEqual(["references/old.jpg"]);
  });

  it("dry-run não remove objetos", async () => {
    const { client, remove } = makeStorage();
    const result = await cleanupExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z"), dryRun: true, logger: { log: vi.fn() } });
    expect(result.paths).toEqual(["references/old.jpg"]);
    expect(remove).not.toHaveBeenCalled();
  });

  it("remove pelo Storage API, em lote, sem tocar croquis", async () => {
    const { client, remove } = makeStorage();
    await cleanupExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z"), dryRun: false, logger: { log: vi.fn() } });
    expect(remove).toHaveBeenCalledWith(["references/old.jpg"]);
    expect(remove.mock.calls.flat().join(" ")).not.toContain("croquis/");
    expect(REFERENCE_BUCKET).toBe("croqui-uploads");
  });

  it("remove também arquivos expirados em subpastas do prefixo permitido", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const list = vi.fn().mockImplementation((prefix: string) => Promise.resolve({
      data: prefix === "references"
        ? [{ id: null, name: "nested" }]
        : [{ id: "nested-old", name: "old.jpg", created_at: "2026-08-16T10:00:00.000Z" }],
      error: null,
    }));
    const client = { storage: { from: vi.fn(() => ({ list, remove })) } };

    const paths = await findExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z") });
    await cleanupExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z"), dryRun: false, logger: { log: vi.fn() } });

    expect(paths).toEqual(["references/nested/old.jpg"]);
    expect(remove).toHaveBeenCalledWith(["references/nested/old.jpg"]);
  });

  it("pagina a listagem sem ampliar o alvo para croquis", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const list = vi.fn().mockImplementation((_prefix: string, options: { offset: number }) => Promise.resolve({
      data: options.offset === 0
        ? Array.from({ length: 1000 }, (_, index) => ({ id: `old-${index}`, name: `old-${index}.jpg`, created_at: "2026-08-16T10:00:00.000Z" }))
        : [{ id: "old-last", name: "old-last.jpg", created_at: "2026-08-16T10:00:00.000Z" }],
      error: null,
    }));
    const client = { storage: { from: vi.fn(() => ({ list, remove })) } };

    const paths = await findExpiredReferenceImages({ storage: client, now: new Date("2026-08-18T12:00:00.000Z") });

    expect(paths).toHaveLength(1001);
    expect(list).toHaveBeenCalledTimes(2);
    expect(paths.every((path: string) => path.startsWith("references/"))).toBe(true);
  });

  it("ignora execução concorrente no mesmo processo", async () => {
    let release!: () => void;
    const list = vi.fn().mockImplementation(() => new Promise((resolve) => { release = () => resolve({ data: [], error: null }); }));
    const client = { storage: { from: vi.fn(() => ({ list, remove: vi.fn() })) } };

    const first = cleanupExpiredReferenceImages({ storage: client, dryRun: true, logger: { log: vi.fn() } });
    const second = await cleanupExpiredReferenceImages({ storage: client, dryRun: true, logger: { log: vi.fn() } });
    release();
    await first;

    expect(second.skipped).toBe(true);
  });

  it("libera o lock depois de uma falha para permitir a próxima execução", async () => {
    const failingClient = { storage: { from: vi.fn(() => ({ list: vi.fn().mockRejectedValue(new Error("storage indisponível")), remove: vi.fn() })) } };
    await expect(cleanupExpiredReferenceImages({ storage: failingClient, dryRun: true, logger: { log: vi.fn() } })).rejects.toThrow("storage indisponível");

    const healthyClient = { storage: { from: vi.fn(() => ({ list: vi.fn().mockResolvedValue({ data: [], error: null }), remove: vi.fn() })) } };
    const result = await cleanupExpiredReferenceImages({ storage: healthyClient, dryRun: true, logger: { log: vi.fn() } });
    expect(result.skipped).not.toBe(true);
  });
});
