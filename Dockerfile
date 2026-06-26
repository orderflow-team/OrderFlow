FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npx turbo run build --filter=api

FROM node:22-alpine AS runner
WORKDIR /app

# Copy root configuration
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Copy built node_modules and packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

WORKDIR /app/packages/api
CMD ["npm", "run", "start:prod"]
