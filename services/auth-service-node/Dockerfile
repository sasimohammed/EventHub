FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8082

CMD ["npm", "start"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 CMD node -e "require('http').get('http://127.0.0.1:8082/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"