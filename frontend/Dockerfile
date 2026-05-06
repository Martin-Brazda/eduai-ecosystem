FROM node:22-slim

WORKDIR /app

# Install expo-cli globally for convenience
RUN npm install -g expo-cli

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8081

# npx expo start --web for containerized preview
CMD ["npx", "expo", "start", "--web"]
