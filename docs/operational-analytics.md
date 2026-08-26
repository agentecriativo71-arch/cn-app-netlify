# Operação do rastreio

## Pré-requisitos

1. Aplicar a migration `supabase/migrations/20260826171046_app_analytics_operational.sql` no projeto Supabase alvo.
2. Configurar `DATABASE_URL` para o pool PostgreSQL do servidor e `SUPABASE_SERVICE_KEY` para o bucket privado.
3. Configurar `VITE_SUPABASE_ANON_KEY` para login SSR do dashboard, e definir `app_metadata.role=admin` nos usuários autorizados.
4. Configurar `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `APP_BASE_URL`.

## Rotinas diárias

Agende no EasyPanel/cron uma execução diária de:

```bash
npm run cleanup:execution-assets
npm run telegram:outbox
```

A limpeza remove pela Storage API apenas objetos expirados (recortes após 30 dias e resultados após 90 dias), registra sucesso/falha no banco e mantém os metadados analíticos até 12 meses. O worker Telegram usa `FOR UPDATE SKIP LOCKED`, chave idempotente por artefato e backoff de até duas horas.

## Segurança

- `app_analytics` e `execution-assets` são privados; somente o servidor com `service_role` acessa esses recursos.
- O dashboard exige Supabase Auth e `app_metadata.role=admin` em cada função protegida.
- Imagens no detalhe são URLs assinadas com validade de cinco minutos.
- A aplicação não persiste a foto original, base64, payload bruto, prompt integral ou segredos.

O acesso começa em `/dashboard/login`; a visão geral fica em `/dashboard` e o detalhe em `/dashboard/execucoes/:executionId`. O cliente pode avaliar croqui e foto realista com 1–5 estrelas, editando a nota enquanto o resultado estiver disponível.
