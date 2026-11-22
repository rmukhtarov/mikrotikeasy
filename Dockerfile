# MikrotikEasy: step-by-step RouterOS configurator + optional AI assistant. No npm dependencies.
FROM node:22-alpine
ARG VERSION=1.0.0
LABEL org.opencontainers.image.title="MikrotikEasy" \
      org.opencontainers.image.description="Step-by-step MikroTik RouterOS v6/v7 configurator with a live network diagram and an optional LLM assistant" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/rmukhtarov/mikrotikeasy"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3090 MISTAKES_FILE=/data/mistakes.json TZ=Asia/Baku
WORKDIR /app
COPY package.json server.mjs prompts.mjs schema.mjs settings.mjs ./
COPY data/ros-schema.json data/mistakes.json ./data/
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3090/healthz >/dev/null || exit 1
CMD ["node", "server.mjs"]
