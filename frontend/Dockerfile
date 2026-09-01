# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build


# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# OpenShift runs containers as non-root
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
    && chmod -R 777 /var/cache/nginx \
    && chmod -R 777 /var/log/nginx \
    && chmod -R 777 /var/run

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]