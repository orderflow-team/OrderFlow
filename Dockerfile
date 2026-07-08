FROM node:22-alpine AS builder
WORKDIR /app
# Puppeteer's postinstall downloads a glibc-linked Chromium build that can't
# run on Alpine (musl libc) anyway — skip it here, the runner installs
# Alpine's native chromium package instead.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY . .
RUN npm ci
RUN npx turbo run build --filter=api

FROM node:22-alpine AS runner
WORKDIR /app

# Chromium + the shared libs it needs at runtime, for Puppeteer-based PDF
# generation (packages/api/src/modules/billing/pdf.service.ts).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy root configuration
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Copy built node_modules and packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

WORKDIR /app/packages/api
CMD ["npm", "run", "start:prod"]
