FROM node:20-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache \
    poppler-utils \
    poppler-data

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]