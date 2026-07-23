# Etapa 1: Construcción de la aplicación
FROM node:20-alpine AS build
WORKDIR /app

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml* package-lock.json* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile || npm ci

# Copiar el resto del código
COPY . .

# Construir el proyecto
RUN pnpm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
