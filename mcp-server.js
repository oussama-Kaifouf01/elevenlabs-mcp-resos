import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

/**
 * =========================
 * MCP SERVER SETUP
 * =========================
 */
const server = new McpServer({
  name: "reservation-mcp",
  version: "1.0.0",
});

// Define the check_availability tool
server.tool(
  "check_availability",
  "Check availability for a reservation date and time",
  {
    type: "object",
    properties: {
      date: { type: "string", description: "Reservation date (YYYY-MM-DD)" },
      time: { type: "string", description: "Reservation time (HH:MM)" },
      partySize: { type: "number", description: "Number of people" },
      duration: { type: "number", description: "Duration in minutes (optional)" },
    },
    required: ["date", "time", "partySize"],
  },
  async (args) => {
    const N8N_BASE_URL = process.env.N8N_BASE_URL;
    if (!N8N_BASE_URL) {
      throw new Error("N8N_BASE_URL is not set");
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
  }
);

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
  console.log("✅ MCP Server running (SSE)");
  console.log(`➡ SSE endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`➡ Health check: http://0.0.0.0:${PORT}/health`);
});