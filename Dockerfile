FROM node:lts-bullseye
WORKDIR /srv
COPY . .
RUN set -x \
    && npm ci

CMD ["npm", "run", "start"]