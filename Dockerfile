FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite substitutes public configuration at build time, not at Cloud Run startup.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SPOTIFY_CLIENT_ID
ARG VITE_SPOTIFY_REDIRECT_URI
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_WALLETCONNECT_PROJECT_ID
ARG VITE_BTCPAY_RELEASE_ID
ARG VITE_BTCPAY_CHECKOUT_URL
ARG VITE_BTCPAY_PRICE_LABEL
ARG VITE_BTCPAY_SUPPORT_EMAIL
RUN npm run check

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
