import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = String(req.body?.message ?? "").trim();
    if (!userMessage) return res.status(400).json({ error: "Missing message" });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: "You are MiOwnAI. Use tools when helpful." },
          { role: "user", content: userMessage }
        ],
        tools: [
          {
            type: "mcp",
            server_label: "miownai-mcp",
            server_url: "https://miownai-mcp-demo.onrender.com", // <-- Render URL
            require_approval: "never",
            allowed_tools: ["gmail.create_draft"]
          }
        ]
      }),
    });

    const data = await response.json();
    // Helpful during debugging:
    // console.log(JSON.stringify(data, null, 2));

    const text = data.output_text ?? "(no reply)";
    return res.json({ reply: text });
  } catch (e) {
    console.error("OpenAI call failed:", e);
    // Return a single response; do not try to write twice
    return res.status(500).json({ error: "Server error" });
  }
});


app.get("/api/health", (_, res) => res.send("OK"));

app.listen(3000, () => console.log("✅ Chat server running on port 3000"));
