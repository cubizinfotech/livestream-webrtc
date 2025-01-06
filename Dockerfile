#Sample Dockerfile for NodeJS Apps

FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3069
CMD [ "node", "server.js" ]