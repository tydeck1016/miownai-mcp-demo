import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // or gpt-4.1 if you prefer
            input: [
            { role: "system", content: "You are MiOwnAI. Use tools when helpful." },
            { role: "user", content: userMessage }
            ],
            tools: [
            {
                type: "mcp",
                server_label: "miownai-mcp",
                server_url: "http://localhost:4000",
                require_approval: "never",
                // headers: { Authorization: `Bearer ${process.env.MCP_KEY}` }, // if you add auth later
                allowed_tools: ["gmail.create_draft"]
            }
            ]
        }),
        });

            // const data = await response.json();
            // helpful during debugging:
            // console.log(JSON.stringify(data, null, 2));

            res.json({ reply: data.output_text ?? "(no reply)" });


    const data = await response.json();
    const reply = data.output?.[0]?.content?.[0]?.text || "(no reply)";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat request failed" });
  }
});

app.get("/api/health", (_, res) => res.send("OK"));

app.listen(3000, () => console.log("✅ Chat server running on port 3000"));
