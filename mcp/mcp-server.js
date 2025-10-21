// mcp-server.js
import express from "express";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Logging middleware
app.use((req, _res, next) => {
  // Don’t log secrets
  const headers = { ...req.headers };
  if (headers.authorization) headers.authorization = "<redacted>";
  console.log(`[MCP] ${req.method} ${req.url}`, headers);
  next();
});

app.use(express.json({
  // log body parse errors
  verify: (req, _res, buf) => { req.rawBody = buf?.toString(); }
}));

// Log parsed body (and raw if JSON parse fails upstream)
app.use((req, _res, next) => {
  if (req.method === "POST") {
    try {
      console.log("[MCP] body:", JSON.stringify(req.body));
    } catch {
      console.log("[MCP] raw body:", req.rawBody);
    }
  }
  next();
});

app.use(cors());

function ok(res, payload) {
  console.log("[MCP] RESPONSE:", JSON.stringify(payload));
  return res.json(payload);
}
function err(res, code, message, extra = {}) {
  console.error(`[MCP] ERROR ${code}: ${message}`, extra);
  return res.status(code).json({ error: message, ...extra });
}

// Optional shared-secret auth
function checkAuth(req, res) {
  const expected = process.env.MCP_SHARED_SECRET;
  if (!expected) return true;
  const got = req.headers.authorization || "";
  if (got === `Bearer ${expected}`) return true;
  err(res, 401, "Unauthorized");
  return false;
}

app.get("/health", (_req, res) => ok(res, { ok: true, version: "0.0.1" }));

// Load tools (from ./connectors/*.yml) or inline fallback
const connectorsDir = path.join(__dirname, "connectors");
let tools = [];

if (fs.existsSync(connectorsDir)) {
  for (const file of fs.readdirSync(connectorsDir)) {
    if (file.endsWith(".yaml") || file.endsWith(".yml")) {
      const data = yaml.load(fs.readFileSync(path.join(connectorsDir, file), "utf8"));
      if (data?.tools?.length) tools.push(...data.tools);
    }
  }
}

if (tools.length === 0) {
  tools.push({
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
  });
}

// Single endpoint that speaks the Remote MCP protocol
app.post("/", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const body = req.body || {};

  switch (body.type) {
    case "mcp/handshake":
      return ok(res, { ok: true, server: { name: "miownai-mcp", version: "0.0.1" } });

    case "mcp/list_tools":
      return ok(res, { tools });

    case "mcp/call_tool": {
      const { tool_name, arguments: args } = body;
      if (tool_name === "gmail.create_draft") {
        return ok(res, {
          ok: true,
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
      return err(res, 404, `Tool not found: ${tool_name}`, { available: tools.map(t => t.name) });
    }

    default:
      return err(res, 400, "Unsupported MCP message type", { got: body?.type });
  }
});

// Helpful catch-alls to see unexpected routes/methods
app.all("*", (req, res) => {
  console.warn("[MCP] Unmatched route:", req.method, req.url);
  return err(res, 404, "Not Found");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ MCP server listening on ${PORT}`));
