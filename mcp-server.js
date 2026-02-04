import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

/**
 * =========================
 * SERVER FACTORY
 * =========================
 * Creates a new MCP server instance per request (stateless)
 */
const getServer = () => {
  const server = new McpServer(
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

  // Register the check_availability tool
  server.registerTool(
    "check_availability",
    {
      description: "Check availability for a reservation date and time",
      inputSchema: {
        date: z.string().describe("Reservation date (YYYY-MM-DD format)"),
        time: z.string().describe("Reservation time (HH:MM format, 24-hour)"),
        partySize: z.number().describe("Number of people in the party"),
        duration: z.number().optional().describe("Duration in minutes (optional, defaults to 120)"),
      },
    },
    async (args) => {
      console.log("[check_availability] Called with:", args);

      const N8N_BASE_URL = process.env.N8N_BASE_URL;
      if (!N8N_BASE_URL) {
        console.error("[check_availability] N8N_BASE_URL not set");
        return {
          content: [{ type: "text", text: "Error: N8N_BASE_URL environment variable is not set" }],
          isError: true,
        };
      }

      try {
        console.log("[check_availability] Calling n8n at:", N8N_BASE_URL);
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
          console.error("[check_availability] n8n error:", response.status, text);
          return {
            content: [{ type: "text", text: `n8n webhook failed (${response.status}): ${text}` }],
            isError: true,
          };
        }

        const result = await response.json();
        console.log("[check_availability] Success:", result);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        console.error("[check_availability] Exception:", error.message);
        return {
          content: [{ type: "text", text: `Error checking availability: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  // Register the create_booking tool
  server.registerTool(
    "create_booking",
    {
      description: "Create a new restaurant booking/reservation",
      inputSchema: {
        full_name: z.string().describe("Customer's full name"),
        table: z.string().describe("Table ID"),
        phone_number: z.string().describe("Customer's phone number (e.g. +353861234567)"),
        people: z.number().describe("Number of people in the party"),
        date: z.string().describe("Reservation date (YYYY-MM-DD format)"),
        time: z.string().describe("Reservation time (HH:MM format, 24-hour)"),
        comment: z.string().optional().describe("Special requests or comments (optional)"),
      },
    },
    async (args) => {
      console.log("[create_booking] Called with:", args);

      const N8N_BASE_URL = process.env.N8N_BASE_URL;
      if (!N8N_BASE_URL) {
        console.error("[create_booking] N8N_BASE_URL not set");
        return {
          content: [{ type: "text", text: "Error: N8N_BASE_URL environment variable is not set" }],
          isError: true,
        };
      }

      try {
        console.log("[create_booking] Calling n8n at:", N8N_BASE_URL);
        const response = await fetch(
          `${N8N_BASE_URL}/webhook/impasto48/createBooking`,
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
          console.error("[create_booking] n8n error:", response.status, text);
          return {
            content: [{ type: "text", text: `n8n webhook failed (${response.status}): ${text}` }],
            isError: true,
          };
        }

        const result = await response.json();
        console.log("[create_booking] Success:", result);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        console.error("[create_booking] Exception:", error.message);
        return {
          content: [{ type: "text", text: `Error creating booking: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
};

/**
 * =========================
 * EXPRESS APP SETUP
 * =========================
 */
const app = express();
app.use(cors());
app.use(express.json());

/**
 * =========================
 * MCP ENDPOINT (POST) - Streamable HTTP
 * =========================
 */
app.post("/mcp", async (req, res) => {
  console.log("[MCP-POST] Request received from:", req.ip);

  const server = getServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless: no session management
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      console.log("[MCP-POST] Request closed");
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("[MCP-POST] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

/**
 * =========================
 * MCP ENDPOINT (GET/DELETE) - Method Not Allowed
 * =========================
 */
app.get("/mcp", (req, res) => {
  console.log("[MCP-GET] Method not allowed");
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

app.delete("/mcp", (req, res) => {
  console.log("[MCP-DELETE] Method not allowed");
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
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
  console.log("✅ MCP Stateless Streamable HTTP Server");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
  console.log(`❤️  Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`📄 Root: http://0.0.0.0:${PORT}/`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

/**
 * =========================
 * SHUTDOWN HANDLER
 * =========================
 */
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});