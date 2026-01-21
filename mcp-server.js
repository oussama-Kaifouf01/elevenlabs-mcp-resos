import express from "express";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

// Store active MCP server instances
const mcpServers = new Map();

// Start an MCP server instance
function startMCPServer() {
  const serverProcess = spawn("node", ["mcp-server.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      N8N_BASE_URL: process.env.N8N_BASE_URL
    }
  });

  return serverProcess;
}

// Initialize MCP server on startup
let mcpProcess = startMCPServer();

// List available tools
app.post("/tools/list", (req, res) => {
  // Return the tools your MCP server exposes
  res.json({
    tools: [
      {
        name: "check_availability",
        description: "Check availability for a reservation date and time",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format" },
            time: { type: "string", description: "Time in HH:MM format" },
            partySize: { type: "number", description: "Number of people" },
            duration: { type: "number", description: "Duration in minutes (optional)" }
          },
          required: ["date", "time", "partySize"]
        }
      }
    ]
  });
});

// Call a tool
app.post("/tools/call", async (req, res) => {
  const { name, arguments: args } = req.body;

  try {
    const N8N_BASE_URL = process.env.N8N_BASE_URL;

    const webhookMap = {
      check_availability: "/webhook/impasto48/checkAvailablity"
    };

    const webhookPath = webhookMap[name];
    if (!webhookPath) {
      return res.status(400).json({ error: `Unknown tool: ${name}` });
    }

    const response = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `N8N webhook failed` });
    }

    const result = await response.json();
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP HTTP Wrapper running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  POST /tools/list - List available tools`);
  console.log(`  POST /tools/call - Call a tool`);
  console.log(`  GET /health - Health check`);
});