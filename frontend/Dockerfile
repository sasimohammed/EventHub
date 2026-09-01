FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN chmod +x node_modules/.bin/vite && npx vite build


FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN sed -i 's/listen 80;/listen 8080;/' /etc/nginx/conf.d/default.conf \
    && sed -i 's/^user/#user/' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx/client_temp \
                 /var/cache/nginx/proxy_temp \
                 /var/cache/nginx/fastcgi_temp \
                 /var/cache/nginx/uwsgi_temp \
                 /var/cache/nginx/scgi_temp \
    && chmod -R 777 /var/cache/nginx /var/log/nginx /var/run

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]