# Privacidade do upload de referência

O fluxo de referência exige que o cliente recorte a pessoa ou a peça desejada no navegador. A imagem original permanece no aparelho e não é enviada pelo aplicativo.

Somente o recorte confirmado é enviado ao GPT-5 Vision para análise. O recorte não é gravado no Supabase Storage, em disco, no PostgreSQL ou nos logs da aplicação. Também não é enviado ao Fal/Seedream. A geração recebe apenas as especificações textuais validadas pelo catálogo. A edição posterior pode receber somente o croqui já gerado.

A sessão persiste a ocasião, o tipo de peça selecionado (`reference_piece`), o estado, a análise estruturada, códigos de erro, provedor/modelo Vision, versão do prompt e timestamps. O tipo escolhido no totem é enviado como contexto do GPT-5; a decisão final compara esse alvo com a peça observada.

O aplicativo usa `store:false` na Responses API. Isso evita estado persistente intencional da resposta, mas a política do provedor pode manter logs de monitoramento pelo período aplicável à conta. Consulte os controles de dados da [OpenAI](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint) antes da publicação e documente eventual Zero Data Retention contratado.

As chaves privadas devem ser configuradas somente como variáveis de runtime do servidor (`OPENAI_API_KEY` e `SUPABASE_SERVICE_KEY`), nunca com prefixo `VITE_` e nunca como argumentos de build. A leitura legada de `VITE_SUPABASE_SERVICE_KEY` permanece apenas para compatibilidade durante a migração.

Objetos legados encontrados em `croqui-uploads/references/` são removidos após 24 horas pela rotina de limpeza. O processo não remove `croquis/`, imagens finais ou objetos de outros buckets. A exclusão usa a Storage API, conforme a orientação de [remoção de objetos do Supabase](https://supabase.com/docs/guides/storage/management/delete-objects).
