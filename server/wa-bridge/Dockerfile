# wa-bridge: Node-based Baileys sidecar.
#
# Why Node and not bun: Baileys depends on the `ws` library, and bun's
# implementation of `ws` is still partial (the 'upgrade' / 'unexpected-
# response' events are stubbed), which causes WhatsApp WebSocket
# handshakes to close on us. Node 20 has full ws support.
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/

RUN mkdir -p /app/auth_info
ENV WA_AUTH_ROOT=/app/auth_info
ENV NODE_ENV=production

EXPOSE 3001
CMD ["npx", "tsx", "src/index.ts"]
