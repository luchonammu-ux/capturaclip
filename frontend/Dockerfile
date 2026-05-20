# Etapa 1: Construcción
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Pasamos la URL final del subdominio para las llamadas del frontend
ENV NEXT_PUBLIC_BACKEND_URL=https://capturaclip.nammu.com.ar
RUN npm run build

# Etapa 2: Servidor de producción liviano
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm install --production

EXPOSE 3000
CMD ["npm", "run", "start"]