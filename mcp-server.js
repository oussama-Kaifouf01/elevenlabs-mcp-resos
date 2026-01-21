import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://n8n:5678";
console.log(N8N_BASE_URL);
const server = new Server(
  {
    name: "reservation-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define your n8n workflows as MCP tools
const tools = [
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
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls - route to n8n webhooks
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Map tool names to n8n webhook endpoints
    const webhookMap = {
      check_availability: "/webhook-test/impasto48/checkAvailablity"
    };

    const webhookPath = webhookMap[name];
    if (!webhookPath) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const response = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      throw new Error(`N8N webhook returned ${response.status}`);
    }

    const result = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error calling ${name}: ${error.message}`,
          isError: true
        }
      ]
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("N8N MCP Server started");
}

main().catch(console.error);