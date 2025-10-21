// mcp/mcp-server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ---- SSE endpoint (the client opens this right after initialize)
app.get("/", (req, res) => {
  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    // heartbeat so the connection stays open
    const t = setInterval(() => res.write(":\n\n"), 20000);
    req.on("close", () => clearInterval(t));
  } else {
    res.status(200).send("MCP OK");
  }
});

// ---- JSON-RPC router (the client POSTs initialize / tools/list / tools/call here)
app.post("/", (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  console.log("[MCP] initialize body:", req.body);

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        serverInfo: { name: "miownai-mcp", version: "0.0.1" },
        capabilities: { tools: {} }
      }
    });
  }

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: { tools }
    });
  }

  if (method === "tools/call") {
    // handle tool invocation
  }

  console.log("[MCP] unknown method:", method);
  return res.status(400).json({ error: "Unsupported MCP message type" });
});


// health
app.get("/health", (_req, res) => res.json({ ok: true, version: "0.0.1" }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ MCP server listening on ${PORT}`));
