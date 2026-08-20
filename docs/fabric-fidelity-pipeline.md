# Pipeline de fidelidade de tecidos

O piloto é ativado somente no fluxo de manequim por meio de:

```env
REALISTA_FABRIC_PIPELINE_V1=true
```

Com a flag desligada ou sem imagem cadastrada para o tecido, o fluxo legado continua sendo usado. O fluxo de pessoa não usa este pipeline.

## Etapas

1. A imagem HTTPS do catálogo é baixada, validada e convertida temporariamente para JPEG/data URL com limite de 10 MB e dimensão mínima de 256 px.
2. Fal Seedream recebe croqui + tecido normalizado e gera uma referência limpa da peça.
3. Fal Seedream recebe manequim + referência limpa e gera três variantes, cada uma com seed reproduzível.
4. Fal Vision compara swatch, referência da peça e variantes. A seleção pondera cor/estampa (35%), material (35%), design (20%) e ausência de artefatos (10%).
5. Se a etapa intermediária, avaliação ou limiar mínimo falhar, a geração legada é usada.

URLs intermediárias não são salvas no banco ou no estado do look. O resultado final continua sendo persistido pelo fluxo existente.

## Validação visual

Executar o piloto com pelo menos dez SKUs representativos, incluindo tecidos lisos, estampados, rendados, brilhantes, texturizados, claros, escuros e translúcidos. Registrar para cada caso cor/estampa, material, design e artefatos numa escala de 0 a 5; comparar contra o fluxo legado antes de ligar a flag em produção.
