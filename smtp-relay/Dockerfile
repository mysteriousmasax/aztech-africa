FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./server.js
ENV SMTP_RELAY_PORT=2525
EXPOSE 2525
CMD ["npm", "start"]