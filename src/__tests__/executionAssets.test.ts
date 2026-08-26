import { describe, expect, it } from "vitest";
import {
  ExecutionAssetStore,
  deriveGarmentDetailDataUrls,
  type PrivateStorageBoundary,
} from "../server/executionAssets";

class MemoryPrivateStorage implements PrivateStorageBoundary {
  readonly objects = new Map<string, { data: Uint8Array; contentType: string }>();

  async upload(path: string, data: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(path, { data, contentType });
  }

  async download(path: string): Promise<{ data: Uint8Array; contentType: string }> {
    const object = this.objects.get(path);
    if (!object) throw new Error("not found");
    return object;
  }

  async remove(paths: string[]): Promise<void> {
    paths.forEach((path) => this.objects.delete(path));
  }

  async createSignedUrl(path: string): Promise<string> {
    return `https://storage.test/signed/${path}`;
  }
}

const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("retenção privada de artefatos", () => {
  it("salva somente o recorte anonimizado principal e permite reconstruir detalhes no retry", async () => {
    const boundary = new MemoryPrivateStorage();
    const assets = new ExecutionAssetStore(boundary);

    const stored = await assets.saveReferenceCrop({
      executionId: "execution-id",
      role: "single",
      dataUrl: onePixelPng,
    });
    const restored = await assets.loadReferenceCrop(stored.storagePath);
    const details = await deriveGarmentDetailDataUrls(restored);

    expect([...boundary.objects.keys()]).toEqual([stored.storagePath]);
    expect(stored).toMatchObject({
      storageBucket: "execution-assets",
      mimeType: "image/png",
    });
    expect(restored).toBe(onePixelPng);
    expect(details).toHaveLength(3);
    expect(details.every((detail) => detail.startsWith("data:image/jpeg;base64,"))).toBe(true);
  });

  it("copia resultado remoto para o bucket privado em vez de depender da URL do provedor", async () => {
    const boundary = new MemoryPrivateStorage();
    const assets = new ExecutionAssetStore(boundary, async () => new Response(
      Buffer.from(onePixelPng.split(",")[1], "base64"),
      { status: 200, headers: { "content-type": "image/png", "content-length": "68" } },
    ));

    const stored = await assets.saveGeneratedImage({
      executionId: "execution-id",
      kind: "croqui",
      sourceUrl: "https://fal.test/generated.png",
    });

    expect(stored.storagePath).toMatch(/^generated\/execution-id\/croqui-/);
    expect(boundary.objects.get(stored.storagePath)?.contentType).toBe("image/png");
  });
});
