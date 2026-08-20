# Privacidade do upload de referência

O fluxo de referência exige que o cliente recorte a pessoa ou a peça desejada no navegador. A imagem original permanece no aparelho e não é enviada pelo aplicativo.

Somente o recorte confirmado é enviado ao Gemini Vision pela Fal AI, no endpoint OpenRouter Vision, para análise. O recorte não é gravado no Supabase Storage, em disco, no PostgreSQL ou nos logs da aplicação. A geração recebe apenas as especificações textuais validadas pelo catálogo. A edição posterior pode receber somente o croqui já gerado.

A sessão persiste a ocasião, o tipo de peça selecionado (`reference_piece`), o estado, a análise estruturada, códigos de erro, provedor/modelo Vision, versão do prompt e timestamps. O tipo escolhido no totem é enviado como contexto do Gemini; a decisão final compara esse alvo com a peça observada.

No fluxo separado de foto realista com tecido do catálogo, a imagem pública do tecido selecionado pode ser baixada temporariamente pelo servidor, normalizada para JPEG e enviada ao Fal para gerar a referência da peça. A imagem normalizada e a referência intermediária não são persistidas no banco ou no estado do look; somente a imagem final segue o fluxo existente.

O aplicativo não envia `store:false` ao endpoint Fal porque essa opção pertence à Responses API direta da OpenAI. A chamada Fal/OpenRouter deve ser tratada como processamento externo: confirme a política de retenção aplicável à conta antes da publicação e mantenha somente o recorte temporário necessário para a análise.

As chaves privadas devem ser configuradas somente como variáveis de runtime do servidor (`FAL_KEY`, `OPENAI_API_KEY` e `SUPABASE_SERVICE_KEY`), nunca com prefixo `VITE_` e nunca como argumentos de build. A leitura legada de `VITE_SUPABASE_SERVICE_KEY` permanece apenas para compatibilidade durante a migração.

Objetos legados encontrados em `croqui-uploads/references/` são removidos após 24 horas pela rotina de limpeza. O processo não remove `croquis/`, imagens finais ou objetos de outros buckets. A exclusão usa a Storage API, conforme a orientação de [remoção de objetos do Supabase](https://supabase.com/docs/guides/storage/management/delete-objects).
