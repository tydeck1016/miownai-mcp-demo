// mcp/mcp-server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// ---- SSE endpoint (for OpenAI's event stream)
app.get("/", (req, res) => {
  if (req.headers.accept?.includes("text/event-stream")) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const t = setInterval(() => res.write(":\n\n"), 20000);
    req.on("close", () => clearInterval(t));
  } else {
    res.status(200).send("MCP OK");
  }
});

// ---- JSON-RPC router
app.post("/", (req, res) => {
  const { jsonrpc, id, method } = req.body || {};
  console.log("[MCP]", method, "body:", req.body);

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        serverInfo: { name: "miownai-mcp", version: "0.0.1" },
        capabilities: {} // <-- instead of { tools: {} }
      }
    });
  }


  if (method === "tools/list") {
    console.log("[MCP] tools/list requested");
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "gmail.create_draft",
            description: "Create a Gmail draft email.",
            inputSchema: {
              type: "object",
              properties: {
                to: { type: "string", description: "Recipient email address" },
                subject: { type: "string", description: "Email subject" },
                body: { type: "string", description: "Email body text" }
              },
              required: ["to", "subject", "body"]
            }
          }
        ]
      }
    });
  }

  if (method === "tools/call") {
    console.log("[MCP] tools/call:", req.body);
    const args = req.body?.params?.arguments || {};
    const name = req.body?.params?.name;

    if (name === "gmail.create_draft") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `✅ Draft created for ${args.to} with subject "${args.subject}".`
            }
          ]
        }
      });
    }

    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Tool not found" }
    });
  }

  console.log("[MCP] unknown method:", method);
  return res.status(400).json({ error: "Unsupported MCP message type" });
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, version: "0.0.1" }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ MCP server listening on ${PORT}`));
