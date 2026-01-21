FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Run the MCP server
CMD ["node", "mcp-server.js"]
```

**Step 2: Create a .dockerignore file**
```
node_modules
.env
.git