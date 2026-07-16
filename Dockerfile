FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose the port (Koyeb uses PORT environment variable)
EXPOSE 3000

# Start command
CMD [ "npm", "start" ]
