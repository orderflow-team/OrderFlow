FROM node:22-alpine AS builder
WORKDIR /app

COPY . .
RUN npm ci
# NEXT_PUBLIC_* values are inlined into the client bundle at build time
# (.env files are excluded by .dockerignore), so they must be build args.
# Both defaults are public values, not secrets.
ARG NEXT_PUBLIC_API_URL=https://obix360.com
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=17124156249-tmi744b2qhi0leamcjjj8in2ti3ktd0d.apps.googleusercontent.com
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL     NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID     NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN npm --prefix apps/web run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web

EXPOSE 3000
CMD ["npm", "--prefix", "apps/web", "run", "start"]
