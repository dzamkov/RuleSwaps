FROM node:16-alpine
RUN apk add --no-cache make rsync
WORKDIR /app
COPY package.json ./
RUN yarn install
COPY . .
RUN make
CMD ["node", "output/server.js", "80"]