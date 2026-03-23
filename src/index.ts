#!/usr/bin/env node
// ============================================================================
// PBS MCP Server — Entry Point
// Proxmox Backup Server management via Model Context Protocol
// ============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { loadConfig, PbsClient } from "./services/pbs-client.js";
import { registerNodeTools } from "./tools/nodes.js";
import { registerDatastoreTools } from "./tools/datastores.js";
import { registerJobTools } from "./tools/jobs.js";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const config = loadConfig();
const client = new PbsClient(config);

const server = new McpServer({
  name: "pbs-mcp-server",
  version: "0.1.0",
});

// Register all tool modules
registerNodeTools(server, client);
registerDatastoreTools(server, client);
registerJobTools(server, client);

// ---------------------------------------------------------------------------
// Transport — stdio (default) or HTTP
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PBS MCP server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "pbs-mcp-server", version: "0.1.0" });
  });

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3100", 10);
  app.listen(port, () => {
    console.error(`PBS MCP server running on http://localhost:${port}/mcp`);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
