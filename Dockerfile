# Build context attendu : parent senlabvisa/

FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /workspace

COPY sen-lab-shared-types ./sen-lab-shared-types
WORKDIR /workspace/sen-lab-shared-types
RUN pnpm install --no-frozen-lockfile
RUN pnpm build

COPY sen-lab-attempts-service /workspace/sen-lab-attempts-service
WORKDIR /workspace/sen-lab-attempts-service
RUN pnpm install --no-frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm build

FROM node:20-alpine
RUN apk add --no-cache bash openssl
RUN corepack enable
WORKDIR /workspace/sen-lab-attempts-service

COPY --from=builder /workspace/sen-lab-shared-types /workspace/sen-lab-shared-types
COPY --from=builder /workspace/sen-lab-attempts-service/dist ./dist
COPY --from=builder /workspace/sen-lab-attempts-service/node_modules ./node_modules
COPY --from=builder /workspace/sen-lab-attempts-service/prisma ./prisma
COPY --from=builder /workspace/sen-lab-attempts-service/package.json ./

COPY sen-lab-attempts-service/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3007
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
