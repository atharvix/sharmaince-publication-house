# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The API is reverse-proxied by nginx on the same origin, so the default is a relative path.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# The rolling deploy waits for this before sending traffic to a new container.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --start-interval=1s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
