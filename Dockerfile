FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Image nginx tự envsubst file trong /etc/nginx/templates khi khởi động.
ENV ADMIN_API_UPSTREAM=http://zalo-oa:8081
ENV WIKI_API_UPSTREAM=http://host.docker.internal:5055
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
