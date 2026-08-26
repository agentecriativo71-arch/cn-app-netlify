import type { OperationalAnalytics, NotificationDelivery } from "./operationalAnalytics";

export interface TelegramBoundary {
  sendMessage(message: { text: string }): Promise<void>;
}

export class TelegramBotBoundary implements TelegramBoundary {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async sendMessage(message: { text: string }): Promise<void> {
    const response = await this.fetcher(`https://api.telegram.org/bot${encodeURIComponent(this.token)}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text: message.text, disable_web_page_preview: true }),
    });
    if (!response.ok) throw new Error(`telegram_http_${response.status}`);
    const payload = await response.json() as { ok?: boolean };
    if (!payload.ok) throw new Error("telegram_api_rejected");
  }
}

export function createTelegramBoundaryFromEnvironment(fetcher: typeof fetch = fetch): TelegramBoundary | null {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  return token && chatId ? new TelegramBotBoundary(token, chatId, fetcher) : null;
}

function retryDelayMs(attempts: number): number {
  return Math.min(2 * 60 * 60 * 1000, [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000][Math.max(0, attempts - 1)] || 2 * 60 * 60_000);
}

export function buildTelegramMessage(notification: NotificationDelivery, baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return [
    "⚠️ Avaliação crítica na C&N Tecidos",
    `Execução: ${notification.executionId}`,
    `Resultado: ${notification.artifactKind}`,
    `Nota: ${notification.score}/5`,
    `Acessar: ${normalizedBaseUrl}/dashboard/execucoes/${notification.executionId}`,
  ].join("\n");
}

export async function processTelegramOutbox(input: {
  analytics: OperationalAnalytics;
  telegram: TelegramBoundary;
  baseUrl: string;
  now?: () => Date;
  limit?: number;
}): Promise<{ claimed: number; sent: number; failed: number }> {
  const now = input.now || (() => new Date());
  const claimed = await input.analytics.claimDueNotifications(now().toISOString(), input.limit || 20);
  let sent = 0;
  let failed = 0;
  for (const notification of claimed) {
    try {
      await input.telegram.sendMessage({ text: buildTelegramMessage(notification, input.baseUrl) });
      await input.analytics.markNotificationSent(notification.id, now().toISOString());
      sent += 1;
    } catch {
      failed += 1;
      const nextAttemptAt = new Date(now().getTime() + retryDelayMs(notification.attempts)).toISOString();
      await input.analytics.markNotificationFailed(notification.id, "telegram_delivery_failed", nextAttemptAt);
    }
  }
  return { claimed: claimed.length, sent, failed };
}
