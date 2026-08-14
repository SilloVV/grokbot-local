# Locked-down image the orchestrator can spawn on demand.
# Not started by compose. Network is disabled at `docker run` time.
FROM node:22-alpine
RUN adduser -S -u 65534 -H sandbox
WORKDIR /work
USER 65534:65534
