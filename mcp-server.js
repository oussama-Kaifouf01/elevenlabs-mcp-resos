import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  GetServerInfoRequestSchema,
  GetInstructionsRequestSchema,
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
      tools: {
        check_availability: {
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
      },
    },
  }
);

/**
 * =========================
 * SERVER INFO (REQUIRED BY CURSOR)
 * =========================
 */
server.setRequestHandler(GetServerInfoRequestSchema, async () => {
  return {
    name: "reservation-mcp",
    version: "1.0.0",
    description: "MCP server for restaurant availability via n8n",
    capabilities: {
      tools: true,
    },
  };
});

/**
 * =========================
 * INSTRUCTIONS (REQUIRED BY CURSOR)
 * =========================
 */
server.setRequestHandler(GetInstructionsRequestSchema, async () => {
  return {
    instructions: `
You are an assistant connected to a restaurant reservation system.

You have access to one tool:
- check_availability: checks if a table is available for a given date, time, and party size.

When the user asks about availability, always use the tool.
`.trim(),
  };
});

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
            date: { type: "string" },
            time: { type: "string" },
            partySize: { type: "number" },
            duration: { type: "number" },
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
  const { name, arguments: args } = req;

  if (name !== "check_availability") {
    throw new Error(`Unknown tool: ${name}`);
  }

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
    const text = await response.text();
    throw new Error(`n8n webhook failed (${response.status}): ${text}`);
  }

  const result = await response.json();

  return {
    result,
  };
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
  console.log("✅ MCP Server running");
  console.log("➡ SSE endpoint: /mcp");
  console.log("➡ Health check: /health");
});
