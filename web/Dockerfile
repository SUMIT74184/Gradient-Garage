FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The home page is prerendered from the API, so the build needs to reach it
ARG API_URL
ENV API_URL=$API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S gg && adduser -S gg -G gg
COPY --from=build --chown=gg:gg /app/.next/standalone ./
COPY --from=build --chown=gg:gg /app/.next/static ./.next/static
COPY --from=build --chown=gg:gg /app/public ./public
USER gg
EXPOSE 3000
CMD ["node", "server.js"]
