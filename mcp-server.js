import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
app.use(express.json());

/**
 * =========================
 * MCP SERVER SETUP
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
 * TOOLS: LIST
 * =========================
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_availability",
        description: "Check availability for a reservation date and time",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Reservation date (YYYY-MM-DD format)",
            },
            time: {
              type: "string",
              description: "Reservation time (HH:MM format, 24-hour)",
            },
            partySize: {
              type: "number",
              description: "Number of people in the party",
            },
            duration: {
              type: "number",
              description: "Duration in minutes (optional, defaults to 120)",
            },
          },
          required: ["date", "time", "partySize"],
        },
      },
    ],
  };
});

/**
 * =========================
 * TOOLS: CALL
 * =========================
 */
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name !== "check_availability") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const N8N_BASE_URL = process.env.N8N_BASE_URL;
  if (!N8N_BASE_URL) {
    throw new Error("N8N_BASE_URL environment variable is not set");
  }

  try {
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
      const text = await response.text();
      throw new Error(`n8n webhook failed (${response.status}): ${text}`);
    }

    const result = await response.json();

    return {
      type: "text",
      text: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      type: "text",
      text: `Error checking availability: ${error.message}`,
      isError: true,
    };
  }
});

/**
 * =========================
 * MCP SSE ENDPOINT
 * =========================
 */
app.get("/mcp", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/mcp", res);
    await server.connect(transport);

    req.on("close", () => {
      transport.close();
    });
  } catch (err) {
    console.error("MCP connection error:", err);
    res.end();
  }
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
  console.log("✅ MCP Server running (Cursor compatible)");
  console.log(`➡ SSE endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`➡ Health check: http://0.0.0.0:${PORT}/health`);
});