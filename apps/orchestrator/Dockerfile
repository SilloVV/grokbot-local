FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/orchestrator ./apps/orchestrator
COPY personas ./personas
RUN pnpm install --filter @grokbot/orchestrator...
ENV ORCHESTRATOR_HOST=0.0.0.0
ENV ORCHESTRATOR_PORT=8787
ENV PERSONAS_DIR=/app/personas
EXPOSE 8787
WORKDIR /app/apps/orchestrator
CMD ["pnpm", "start"]
