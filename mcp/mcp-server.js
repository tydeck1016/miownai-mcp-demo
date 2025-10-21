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
  const { id, method, params } = req.body || {};
  const auth = req.headers.authorization || "";

  if (process.env.MCP_SHARED_SECRET) {
    if (auth !== `Bearer ${process.env.MCP_SHARED_SECRET}`) {
      return res.json({ jsonrpc: "2.0", id, error: { code: 401, message: "Unauthorized" } });
    }
  }

  const ok = (result) => res.json({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => res.json({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return ok({
        serverInfo: { name: "miownai-mcp", version: "0.0.1" },
        capabilities: { tools: {} }
      });

    case "tools/list":
      return ok({
        tools: [
          {
            name: "gmail.create_draft",
            description: "Create a Gmail draft",
            input_schema: {
              type: "object",
              properties: {
                to: { type: "string" },
                subject: { type: "string" },
                body: { type: "string" }
              },
              required: ["to", "subject", "body"]
            }
          }
        ]
      });

    case "tools/call": {
      const { name, arguments: args } = params || {};
      if (name !== "gmail.create_draft") {
        return fail(404, `Unknown tool: ${name}`);
      }
      // stub “execution”
      return ok({
        content: [
          {
            type: "json",
            data: {
              ok: true,
              draftId: "dr_" + Math.random().toString(36).slice(2, 10),
              to: args?.to,
              subject: args?.subject,
              body: args?.body
            }
          }
        ]
      });
    }

    default:
      return fail(-32601, `Unsupported method: ${method}`);
  }
});

// health
app.get("/health", (_req, res) => res.json({ ok: true, version: "0.0.1" }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ MCP server listening on ${PORT}`));
