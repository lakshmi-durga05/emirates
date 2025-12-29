FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm i --legacy-peer-deps
COPY tsconfig.json ./
COPY proto ./proto
COPY src ./src
RUN npm run build
EXPOSE 4000
CMD ["npm","start"]
