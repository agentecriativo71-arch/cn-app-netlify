import { operationalAnalytics } from "../src/server/analyticsRuntime.ts";
import { createTelegramBoundaryFromEnvironment, processTelegramOutbox } from "../src/server/telegramNotifications.ts";

const telegram = createTelegramBoundaryFromEnvironment();
if (!telegram) {
  console.warn("[TELEGRAM OUTBOX] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados; nada enviado.");
  process.exit(0);
}

const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
const result = await processTelegramOutbox({ analytics: operationalAnalytics, telegram, baseUrl });
console.info("[TELEGRAM OUTBOX] processamento concluído", result);
