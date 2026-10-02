# The React app as a Docker image, in two stages:
#   1) "build": Node turns src/ into plain HTML/CSS/JS files in dist/
#   2) the final image: a tiny nginx web server holding only dist/ (no Node, no source code)
# Build:  docker build -t simplebank-web ./frontend

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "/api" = same address as the page. nginx (here) or CloudFront (on AWS) passes /api/* to the backend,
# so the browser never talks to a second origin and CORS isn't needed.
ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
