import { describe, expect, it, vi } from "vitest";
import { InMemoryAnalyticsRepository, OperationalAnalytics } from "../server/operationalAnalytics";
import { processTelegramOutbox } from "../server/telegramNotifications";

describe("outbox Telegram", () => {
  it("envia uma nota crítica e marca o evento como enviado", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const now = new Date("2026-08-26T12:00:00Z");
    const analytics = new OperationalAnalytics(repository, () => now);
    const execution = await analytics.startExecution({ source: "manual" });
    const artifact = await execution.recordArtifact({ kind: "realistic", selected: true, retentionDays: 90 });
    await analytics.rateArtifact({ artifactId: artifact.artifactId, executionId: execution.executionId, score: 2 });
    const sendMessage = vi.fn(async () => undefined);

    const result = await processTelegramOutbox({
      analytics,
      telegram: { sendMessage },
      baseUrl: "https://app.example",
    });

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(sendMessage).toHaveBeenCalledWith({ text: expect.stringContaining(`/dashboard/execucoes/${execution.executionId}`) });
    expect(repository.listNotifications()[0].status).toBe("sent");
  });

  it("reagenda falhas sem duplicar o evento", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const now = new Date("2026-08-26T12:00:00Z");
    const analytics = new OperationalAnalytics(repository, () => now);
    const execution = await analytics.startExecution({ source: "manual" });
    const artifact = await execution.recordArtifact({ kind: "croqui", retentionDays: 90 });
    await analytics.rateArtifact({ artifactId: artifact.artifactId, score: 1 });
    const result = await processTelegramOutbox({
      analytics,
      telegram: { sendMessage: async () => { throw new Error("offline"); } },
      baseUrl: "https://app.example",
      now: () => now,
    });
    expect(result).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(repository.listNotifications()[0]).toMatchObject({ status: "failed", attempts: 1, lastErrorCode: "telegram_delivery_failed" });
    expect(repository.listNotifications()).toHaveLength(1);
  });
});
