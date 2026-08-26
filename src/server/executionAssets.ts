import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const EXECUTION_ASSETS_BUCKET = "execution-assets";
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export interface PrivateStorageBoundary {
  upload(path: string, data: Uint8Array, contentType: string): Promise<void>;
  download(path: string): Promise<{ data: Uint8Array; contentType: string }>;
  remove(paths: string[]): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

function parseImageDataUrl(dataUrl: string): { data: Uint8Array; contentType: string; extension: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Recorte anonimizado inválido.");
  const data = new Uint8Array(Buffer.from(match[2], "base64"));
  if (!data.byteLength || data.byteLength > MAX_ASSET_BYTES) throw new Error("Recorte anonimizado fora do limite permitido.");
  const contentType = match[1];
  return {
    data,
    contentType,
    extension: contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1],
  };
}

export class ExecutionAssetStore {
  constructor(
    private readonly storage: PrivateStorageBoundary,
    private readonly fetchImage: (url: string) => Promise<Response> = (url) => fetch(url),
  ) {}

  async saveReferenceCrop(input: {
    executionId: string;
    role: "single" | "top" | "bottom";
    dataUrl: string;
  }): Promise<{ storageBucket: string; storagePath: string; mimeType: string }> {
    const parsed = parseImageDataUrl(input.dataUrl);
    const storagePath = `reference/${input.executionId}/${input.role}-${randomUUID()}.${parsed.extension}`;
    await this.storage.upload(storagePath, parsed.data, parsed.contentType);
    return {
      storageBucket: EXECUTION_ASSETS_BUCKET,
      storagePath,
      mimeType: parsed.contentType,
    };
  }

  async loadReferenceCrop(storagePath: string): Promise<string> {
    const object = await this.storage.download(storagePath);
    if (!object.contentType.startsWith("image/")) throw new Error("Objeto retido não é uma imagem.");
    return `data:${object.contentType};base64,${Buffer.from(object.data).toString("base64")}`;
  }

  async saveGeneratedImage(input: {
    executionId: string;
    kind: "croqui_candidate" | "croqui" | "realistic";
    sourceUrl: string;
  }): Promise<{ storageBucket: string; storagePath: string; mimeType: string }> {
    const url = new URL(input.sourceUrl);
    if (url.protocol !== "https:") throw new Error("URL do resultado precisa usar HTTPS.");
    const response = await this.fetchImage(url.toString());
    if (!response.ok) throw new Error(`Download do resultado falhou: HTTP ${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";")[0] || "";
    if (!/^image\/(jpeg|png|webp)$/.test(contentType)) throw new Error("Resultado remoto não é uma imagem permitida.");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_ASSET_BYTES) throw new Error("Resultado remoto excede 10 MB.");
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.byteLength || data.byteLength > MAX_ASSET_BYTES) throw new Error("Resultado remoto fora do limite permitido.");
    const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
    const storagePath = `generated/${input.executionId}/${input.kind}-${randomUUID()}.${extension}`;
    await this.storage.upload(storagePath, data, contentType);
    return { storageBucket: EXECUTION_ASSETS_BUCKET, storagePath, mimeType: contentType };
  }

  createSignedUrl(storagePath: string, expiresInSeconds: number): Promise<string> {
    return this.storage.createSignedUrl(storagePath, expiresInSeconds);
  }
}

export class SupabasePrivateStorageBoundary implements PrivateStorageBoundary {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket = EXECUTION_ASSETS_BUCKET,
  ) {}

  async upload(path: string, data: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(path, data, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });
    if (error) throw new Error(`Storage upload falhou: ${error.name}`);
  }

  async download(path: string): Promise<{ data: Uint8Array; contentType: string }> {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error || !data) throw new Error(`Storage download falhou: ${error?.name || "not_found"}`);
    return {
      data: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || "image/jpeg",
    };
  }

  async remove(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.client.storage.from(this.bucket).remove(paths);
    if (error) throw new Error(`Storage delete falhou: ${error.name}`);
  }

  async createSignedUrl(path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) throw new Error(`Storage signed URL falhou: ${error?.name || "missing_url"}`);
    return data.signedUrl;
  }
}

export function createExecutionAssetStoreFromEnvironment(): ExecutionAssetStore | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !serviceKey) return null;
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new ExecutionAssetStore(new SupabasePrivateStorageBoundary(client));
}

export async function deriveGarmentDetailDataUrls(dataUrl: string): Promise<string[]> {
  const parsed = parseImageDataUrl(dataUrl);
  const image = sharp(parsed.data, { failOn: "error" });
  const metadata = await image.metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const segments = [
    { top: 0.12, bottom: 0.42 },
    { top: 0.30, bottom: 0.62 },
    { top: 0.48, bottom: 1 },
  ];
  return Promise.all(segments.map(async (segment) => {
    const top = Math.min(height - 1, Math.max(0, Math.floor(height * segment.top)));
    const segmentHeight = Math.max(1, Math.min(height - top, Math.ceil(height * (segment.bottom - segment.top))));
    const buffer = await sharp(parsed.data)
      .extract({ left: 0, top, width, height: segmentHeight })
      .resize({ width: Math.min(width, 1536), withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  }));
}
