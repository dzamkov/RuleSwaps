FROM node:16-alpine AS dev
RUN apk add --no-cache make rsync
RUN npm install -g nodemon
WORKDIR /app
COPY package.json ./
RUN yarn install
COPY Makefile ./
COPY source source
RUN make
CMD ["node", "output/server.js"]

FROM dev as builder
RUN yarn install --production=true --modules-folder prod_node_modules
RUN rm -rf output
ARG MODE=RELEASE
RUN make

FROM node:16-slim
WORKDIR /app
COPY --from=builder /app/prod_node_modules node_modules
COPY --from=builder /app/output output
CMD ["node", "output/server.js"]