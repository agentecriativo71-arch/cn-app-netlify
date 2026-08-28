# Operação do rastreio

## Pré-requisitos

1. Aplicar a migration `supabase/migrations/20260826171046_app_analytics_operational.sql` no projeto Supabase alvo.
2. Configurar `ANALYTICS_DATABASE_URL` com a conexão PostgreSQL do mesmo projeto Supabase. O runtime de rastreio nunca reutiliza `DATABASE_URL`.
3. Manter `DATABASE_URL` apontando para o PostgreSQL interno do EasyPanel, usado por produtos, `looks` e `upload_sessions`.
4. Configurar `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_KEY` com credenciais do projeto operacional.
5. Configurar `CRM_SUPABASE_URL`, `CRM_SUPABASE_SERVICE_KEY` e `CN_ORGANIZATION_ID` com dados do projeto CRM.
6. Definir `app_metadata.role=admin` nos usuários autorizados e configurar `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `APP_BASE_URL`.
7. Para permitir consulta por um conector externo, definir também
   `EXECUTION_INTEGRATION_TOKEN` somente no ambiente do servidor.

Em um container persistente do EasyPanel com saída IPv4, prefira a URL do Supavisor em session mode, porta 5432, para `ANALYTICS_DATABASE_URL`.

## Migration do PostgreSQL interno

Antes do primeiro deploy desta versão, execute uma única vez:

```bash
npm run migrate:app-db
```

O comando usa somente `DATABASE_URL`, aplica migrations versionadas e registra cada versão em `app_schema_migrations`. As colunas `execution_id` e `croqui_artifact_id` são referências lógicas; não recebem foreign keys porque o analytics está em outro banco.

## Rotinas diárias

Agende no EasyPanel/cron uma execução diária de:

```bash
npm run cleanup:execution-assets
npm run telegram:outbox
```

A limpeza remove pela Storage API apenas objetos expirados (recortes após 30 dias e resultados após 90 dias), registra sucesso/falha no banco e mantém os metadados analíticos até 12 meses. O worker Telegram usa `FOR UPDATE SKIP LOCKED`, chave idempotente por artefato e backoff de até duas horas.

## Assets de renda do catálogo

O bucket público `elementos` já existente recebe somente os onze assets de renda
que faltavam. O seeder é não destrutivo: lista cada nome antes do upload,
preserva objetos já existentes e usa `upsert=false`; não executa exclusão nem
substituição.

Com a service key do projeto operacional configurada apenas no ambiente local
ou no job de implantação, execute:

```bash
npm run seed:catalog-assets
npm run verify:catalog-assets
```

O verificador deve retornar HTTP 200 e `image/*` para todos os onze objetos.
Sem `SUPABASE_SERVICE_KEY`, o seeder aborta sem alterar o Storage. As URLs
publicadas são usadas pelo servidor ao montar `image_urls` do Fal.ai; os assets
locais permanecem no repositório como fonte do upload.

## Segurança

- `app_analytics` e `execution-assets` são privados; somente o servidor com `service_role` acessa esses recursos.
- `SUPABASE_SERVICE_KEY` e `CRM_SUPABASE_SERVICE_KEY` são exclusivas do servidor e nunca usam prefixo `VITE_`.
- O dashboard exige Supabase Auth e `app_metadata.role=admin` em cada função protegida.
- Imagens no detalhe são URLs assinadas com validade de cinco minutos.
- A aplicação não persiste a foto original, base64, payload bruto, prompt integral ou segredos.

O acesso começa em `/dashboard/login`; a visão geral fica em `/dashboard` e o detalhe em `/dashboard/execucoes/:executionId`. O cliente pode avaliar croqui e foto realista com 1–5 estrelas, editando a nota enquanto o resultado estiver disponível.

## Integração por `executionId`

O endpoint somente leitura
`GET /api/integrations/execucoes/:executionId` devolve o mesmo detalhe
operacional usado pelo dashboard: seleção do usuário, etapas, tentativas,
avaliações Vision, artefatos aprovados/reprovados e estado das notificações.
Artefatos disponíveis recebem URL assinada válida por cinco minutos; a URL de
origem nunca é retornada.

Há duas formas de autenticação:

- sessão de um usuário administrativo já autenticado no dashboard;
- `Authorization: Bearer <EXECUTION_INTEGRATION_TOKEN>` para um conector
  externo.

Exemplo de consulta do conector:

```bash
curl -H "Authorization: Bearer $EXECUTION_INTEGRATION_TOKEN" \
  "$APP_BASE_URL/api/integrations/execucoes/<executionId>"
```

O token não deve ser enviado em query string, registrado em logs ou incluído
no bundle do navegador. A resposta envia `Cache-Control: no-store` e o
endpoint não altera a execução. Troque o valor da variável para revogar ou
rotacionar o acesso.

Esta camada disponibiliza o contrato HTTP; para que um assistente consulte
automaticamente apenas com o identificador, o ambiente do assistente precisa
ter um conector configurado com a URL da aplicação e esse token. Sem esse
conector, o ID sozinho não concede acesso a dados privados.

### Adaptador MCP local para Codex

O repositório inclui `scripts/execution-mcp-server.ts`, um adaptador MCP
somente leitura. Ele expõe a ferramenta `consultar_execucao` e encaminha cada
ID para o endpoint HTTP usando o Bearer token. Para registrar o adaptador no
Codex CLI, execute a partir deste repositório (com o token já definido apenas
no ambiente local):

```bash
export APP_BASE_URL="https://seu-dominio"
export EXECUTION_INTEGRATION_TOKEN="seu-token"
codex mcp add cn-execucoes \
  --env APP_BASE_URL="$APP_BASE_URL" \
  --env EXECUTION_INTEGRATION_TOKEN="$EXECUTION_INTEGRATION_TOKEN" \
  -- node --experimental-strip-types "$(pwd)/scripts/execution-mcp-server.ts"
```

Confirme com `codex mcp list` e reinicie a sessão do Codex para carregar a
ferramenta. O token fica na configuração local do MCP, não no código nem no
bundle do navegador.
