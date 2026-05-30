FROM oven/bun:alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 80
CMD ["bun", "src/server.ts"]
