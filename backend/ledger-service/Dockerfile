FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm i --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
CMD ["npm","start"]
