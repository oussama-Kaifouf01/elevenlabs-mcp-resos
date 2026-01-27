import express from "express";
import fetch from "node-fetch";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  Server,
  Tool,
} from "@modelcontextprotocol/sdk/server/index.js";

const app = express();
app.use(express.json());

/**
 * =========================
 * MCP SERVER DEFINITION
 * =========================
 */

const server = new Server(
  {
    name: "reservation-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * =========================
 * TOOL DEFINITION
 * =========================
 */

server.tool(
  "check_availability",
  {
    description: "Check availability for a reservation date and time",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string" },
        time: { type: "string" },
        partySize: { type: "number" },
        duration: { type: "number" },
      },
      required: ["date", "time", "partySize"],
    },
  },
  async (args) => {
    const N8N_BASE_URL = process.env.N8N_BASE_URL;
    if (!N8N_BASE_URL) {
      throw new Error("N8N_BASE_URL is not set");
    }

    const response = await fetch(
      `${N8N_BASE_URL}/webhook/impasto48/checkAvailablity`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-from-mcp": "true",
        },
        body: JSON.stringify(args),
      }
    );

    if (!response.ok) {
      throw new Error(`n8n webhook failed (${response.status})`);
    }

    return await response.json();
  }
);

/**
 * =========================
 * MCP SSE ENDPOINT
 * =========================
 */

app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp", res);
  await server.connect(transport);
});

/**
 * =========================
 * HEALTH CHECK
 * =========================
 */

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

/**
 * =========================
 * START SERVER
 * =========================
 */

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ MCP Server running`);
  console.log(`➡ SSE endpoint: /mcp`);
  console.log(`➡ Health check: /health`);
});
