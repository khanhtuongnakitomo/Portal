FROM node:24-alpine AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN DIRECT_URL="postgresql://postgres:postgres@localhost:5432/tne_portal?schema=app" pnpm prisma:generate \
    && pnpm build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --global pnpm@11.25.0
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
