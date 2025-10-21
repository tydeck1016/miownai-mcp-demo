import express from "express";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import cors from "cors";
// import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WAS: const connectorsDir = path.join(process.cwd(), "mcp/connectors");
const connectorsDir = path.join(__dirname, "connectors");


const app = express();
app.use(express.json());
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true }));

// Load all connectors from /connectors
// const connectorsDir = path.join(process.cwd(), "mcp/connectors");
let tools = [];

fs.readdirSync(connectorsDir).forEach((file) => {
  if (file.endsWith(".yaml") || file.endsWith(".yml")) {
    const data = yaml.load(fs.readFileSync(path.join(connectorsDir, file), "utf8"));
    data.tools.forEach((tool) => tools.push(tool));
  }
});

// List tools
app.get("/tools/list", (req, res) => {
  res.json({ tools });
});

// Handle tool calls (fake execution for now)
app.post("/tools/call", (req, res) => {
  const { name, arguments: args } = req.body || {};
  if (name === "gmail.create_draft") {
    return res.json({
      content: [
        { type: "json", data: {
            ok: true,
            draftId: "dr_" + Math.random().toString(36).slice(2, 8),
            to: args?.to,
            subject: args?.subject
        } }
      ]
    });
  }
  return res.status(404).json({ error: "Tool not found" });
});


// at the bottom of mcp-server.js
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ MCP server running on port ${PORT}`));

