FROM node:22-slim

WORKDIR /app

# Instalar dependências
COPY package.json package-lock.json ./
RUN npm ci

# Copiar código-fonte
COPY . .

# Fazer o build (TanStack Router/SSR)
RUN npm run build

# Expor a porta 3000
EXPOSE 3000

# Rodar o servidor de produção
# Nota: Nixpacks/Easypanel injetará as variáveis de ambiente diretamente no contêiner,
# não precisamos da flag --env-file
CMD ["node", "server.mjs"]
