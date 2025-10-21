// server.js (your chat backend)
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

function extractReply(data) {
  const msg = Array.isArray(data.output) ? data.output.find(x => x.type === "message") : null;
  const text = msg?.content?.find?.(c => c.type === "output_text")?.text
            ?? data.output_text;
  if (text) return String(text).trim();

  const mcpCall = Array.isArray(data.output) ? data.output.find(x => x.type === "mcp_call") : null;
  if (mcpCall?.name && typeof mcpCall.output === "string") {
    try {
      const parsed = JSON.parse(mcpCall.output);
      const id = parsed?.results?.[0]?.id || parsed?.execution?.id;
      return `✅ Ran tool ${mcpCall.name}${id ? ` — result id: ${id}` : ""}.`;
    } catch { return `✅ Ran tool ${mcpCall.name}.`; }
  }
  return "(no reply)";
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = String(req.body?.message ?? "").trim();
    if (!userMessage) return res.status(400).json({ error: "Missing message" });

    const body = {
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "You are MiOwnAI. Use tools when helpful." },
        { role: "user", content: userMessage }
      ],
      tools: [
        {
          type: "mcp",
          server_label: "miownai-mcp",
          server_url: process.env.MCP_SERVER_URL, // e.g. https://miownai-mcp-demo.onrender.com/
          require_approval: "never",
          headers: {
            // include ONLY if your MCP server requires it
            ...(process.env.MCP_SHARED_SECRET ? { Authorization: `Bearer ${process.env.MCP_SHARED_SECRET}` } : {})
          },
          allowed_tools: ["gmail.create_draft"]
        }
      ]
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const textBody = await r.text(); // capture raw in case it’s not JSON
    let data;
    try { data = JSON.parse(textBody); } catch { data = { raw: textBody }; }

    console.log("[/v1/responses] status", r.status);
    console.log("[/v1/responses] body", JSON.stringify(data, null, 2));

    if (!r.ok) {
      // Bubble up the error for the frontend to show
      return res.status(502).json({
        error: "OpenAI call failed",
        openai_status: r.status,
        openai_body: data
      });
    }

    const reply = extractReply(data);
    return res.json({ reply });
  } catch (e) {
    console.error("OpenAI call failed:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/health", (_req, res) => res.send("OK"));
app.listen(3000, () => console.log("✅ Chat server running on port 3000"));


// import express from "express";
// import fetch from "node-fetch";
// import dotenv from "dotenv";

// dotenv.config();
// const app = express();
// app.use(express.json());
// app.use(express.static("public"));

// /** Pull a readable reply from /v1/responses output */
// function extractReply(data) {
//   try {
//     // 1) Prefer the assistant "message" block
//     const msg = Array.isArray(data.output)
//       ? data.output.find((x) => x.type === "message")
//       : null;

//     if (msg && Array.isArray(msg.content)) {
//       const textChunk = msg.content.find((c) => c.type === "output_text");
//       if (textChunk?.text) return textChunk.text.trim();
//     }

//     // 2) Fallback to top-level output_text
//     if (data.output_text) return String(data.output_text).trim();

//     // 3) As a last resort, if there was a tool call, surface a simple summary
//     const mcpCall = Array.isArray(data.output)
//       ? data.output.find((x) => x.type === "mcp_call")
//       : null;

//     if (mcpCall?.name && typeof mcpCall.output === "string") {
//       // Zapier returns JSON string in .output — try to parse a quick summary
//       try {
//         const parsed = JSON.parse(mcpCall.output);
//         const tool = mcpCall.name;
//         const id = parsed?.results?.[0]?.id || parsed?.execution?.id;
//         return `✅ Ran tool ${tool}${id ? ` — result id: ${id}` : ""}.`;
//       } catch {
//         return `✅ Ran tool ${mcpCall.name}.`;
//       }
//     }
//   } catch {
//     // ignore and fall through
//   }
//   return "(no reply)";
// }

// app.post("/api/chat", async (req, res) => {
//   try {
//     const userMessage = String(req.body?.message ?? "").trim();
//     if (!userMessage) return res.status(400).json({ error: "Missing message" });

//     // If you want a one-off forced tool test, you can pass a special message
//     const forceTool = false; // set true only for smoke tests

//     const body = {
//       model: "gpt-4o-mini",
//       input: [
//         { role: "system", content: "You are MiOwnAI. Use tools when helpful." },
//         { role: "user", content: userMessage }
//       ],
//       ...(forceTool ? { tool_choice: "required" } : {}), // usually leave tools on auto
//       tools: [
//         {
//           type: "mcp",
//           server_label: "zapier",
//           server_url: process.env.ZAPIER_MCP_URL,
//           require_approval: "never",
//           headers: { Authorization: `Bearer ${process.env.ZAPIER_MCP_API_KEY}` }
//           // When you're ready to lock down:
//           // allowed_tools: ["gmail_create_draft"]
//         }
//       ]
//     };

//     const response = await fetch("https://api.openai.com/v1/responses", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
//       },
//       body: JSON.stringify(body)
//     });

//     const data = await response.json();

//     // Log everything for debugging
//     console.log(JSON.stringify(data, null, 2));

//     const reply = extractReply(data);
//     return res.json({ reply });
//   } catch (e) {
//     console.error("OpenAI call failed:", e);
//     return res.status(500).json({ error: "Server error" });
//   }
// });

// app.get("/api/health", (_, res) => res.send("OK"));
// app.listen(3000, () => console.log("✅ Chat server running on port 3000"));
