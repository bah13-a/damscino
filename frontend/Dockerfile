FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# URL of the API gateway, baked into the /api rewrite at build time
ARG API_URL=http://gateway:8080
ARG NEXT_PUBLIC_ANDROID_APP_URL=
ARG NEXT_PUBLIC_IOS_APP_URL=
ENV API_URL=${API_URL} NEXT_OUTPUT=standalone NEXT_PUBLIC_ANDROID_APP_URL=${NEXT_PUBLIC_ANDROID_APP_URL} NEXT_PUBLIC_IOS_APP_URL=${NEXT_PUBLIC_IOS_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
