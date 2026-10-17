FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY server.mjs start.mjs ./
ENV PORT=8787
EXPOSE 8787
CMD ["node","start.mjs"]
