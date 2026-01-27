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

console.log("✅ Server instance created");

/**
 * =========================
 * TOOLS: LIST
 * =========================
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.log("[ListTools] Request received");
  const tools = [
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
  ];
  console.log("[ListTools] Returning", tools.length, "tools");
  return { tools };
});

/**
 * =========================
 * TOOLS: CALL
 * =========================
 */
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  console.log("[CallTool] Request received:", req.params);
  const { name, arguments: args } = req.params;

  if (name !== "check_availability") {
    console.error("[CallTool] Unknown tool:", name);
    throw new Error(`Unknown tool: ${name}`);
  }

  const N8N_BASE_URL = process.env.N8N_BASE_URL;
  if (!N8N_BASE_URL) {
    console.error("[CallTool] N8N_BASE_URL not set");
    throw new Error("N8N_BASE_URL environment variable is not set");
  }

  try {
    console.log("[CallTool] Calling n8n at:", N8N_BASE_URL);
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
      console.error("[CallTool] n8n error:", response.status, text);
      throw new Error(`n8n webhook failed (${response.status}): ${text}`);
    }

    const result = await response.json();
    console.log("[CallTool] Success:", result);

    return {
      type: "text",
      text: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    console.error("[CallTool] Exception:", error.message);
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
  console.log("[SSE] New connection attempt from:", req.ip);
  console.log("[SSE] User-Agent:", req.get("user-agent"));

  try {
    const transport = new SSEServerTransport("/mcp", res);
    console.log("[SSE] Transport created");
    
    await server.connect(transport);
    console.log("[SSE] Server connected to transport");

    req.on("close", () => {
      console.log("[SSE] Connection closed");
      transport.close();
    });

    req.on("error", (err) => {
      console.error("[SSE] Connection error:", err.message);
      transport.close();
    });
  } catch (err) {
    console.error("[SSE] Connection error:", err);
    res.status(500).end();
  }
});

/**
 * =========================
 * HEALTH CHECK
 * =========================
 */
app.get("/health", (_, res) => {
  console.log("[Health] Check requested");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * =========================
 * ROOT ENDPOINT
 * =========================
 */
app.get("/", (_, res) => {
  console.log("[Root] Index requested");
  res.json({
    name: "reservation-mcp",
    version: "1.0.0",
    endpoints: {
      mcp: "/mcp",
      health: "/health",
    },
  });
});

/**
 * =========================
 * START SERVER
 * =========================
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ MCP Server running (with debug logging)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 SSE endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`❤️  Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📄 Root: http://0.0.0.0:${PORT}/`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});