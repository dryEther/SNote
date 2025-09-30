const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('../middleware/auth');

const router = express.Router();
const CONFIG_ROOT = path.join(__dirname, '../configFiles');

router.post('/AI', auth, async (req, res) => {
  try {
    const { action, payload } = req.body;
    if (!action || !payload) return res.status(400).json({ message: "Missing action or payload" });
    if(process.env.DEBUG) { console.log(`AI action: ${action} for user: ${req.user}`); }
    const userConfigFile = path.join(CONFIG_ROOT, `${req.user}.json`);
    if (!fs.existsSync(userConfigFile)) return res.status(400).json({ message: "No config found for user" });
    const config = JSON.parse(fs.readFileSync(userConfigFile, 'utf-8'));
    const provider = config.selectedProvider;
    const model = config.selectedModel;
    if (!provider || !model) return res.status(400).json({ message: "No provider/model selected in config" });

    let promptText = "";
    if (action === "enrich") {
      const { systemPrompt, userPrompt, contentToReplace } = payload.prompts;
      promptText = `${systemPrompt}\n\n${userPrompt}`;
      if (contentToReplace) promptText += `\n\nContext:\n${contentToReplace}`;
    } else if (action === "format") {
      promptText = `Format the following as a Markdown code block:\n\n${payload.selection}`;
    } else return res.status(400).json({ message: "Invalid action" });

    let responseText = "";
    async function parseStream(response, extractFn) {
      let text = "";
      if (response.headers["content-type"]?.includes("application/json")) {
        let data = "";
        for await (const chunk of response.data) data += chunk;
        const parsed = JSON.parse(data);
        text += extractFn(parsed);
      } else {
        for await (const chunk of response.data) {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              text += extractFn(json) || "";
            } catch {}
          }
        }
      }
      return text;
    }

    if (provider === "openAI") {
      const response = await axios.post("https://api.openai.com/v1/chat/completions",
        { model, messages: [{ role: "user", content: promptText }], stream: true },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, responseType: "stream" }
      );
      responseText = await parseStream(response, (json) => json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || "");
    } else if (provider === "gemini") {
      const response = await axios.post(`${process.env.API_URL}/models/${model}:generateContent?stream=true`,
        { contents: [{ role: "user", parts: [{ text: promptText }] }] },
        { headers: { Authorization: `Bearer ${process.env.API_KEY}`, "Content-Type": "application/json" }, responseType: "stream" }
      );
      responseText = await parseStream(response, (json) => json.candidates?.[0]?.content?.parts?.[0]?.text || "");
    } else if (provider === "ollama") {
      const response = await axios.post(`${process.env.OLLAMA_HOST_URL}/api/chat`,
        { model, messages: [{ role: "user", content: promptText }], stream: true },
        { headers: { "Content-Type": "application/json" }, responseType: "stream" }
      );
      responseText = await parseStream(response, (json) => json.message?.content || "");
    } else {
      return res.status(400).json({ message: `Unsupported provider: ${provider}` });
    }

    if (!responseText.trim()) return res.status(500).json({ message: "Empty response from AI provider" });
    res.json({ text: responseText });
  } catch (err) {
    res.status(500).json({ message: `Error from AI provider: ${err.message}` });
  }
});

module.exports = router;
