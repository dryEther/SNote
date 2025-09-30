const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const auth = require('../middleware/auth');

const router = express.Router();
const CONFIG_ROOT = path.join(__dirname, '../configFiles');
if (!fs.existsSync(CONFIG_ROOT)) fs.mkdirSync(CONFIG_ROOT, { recursive: true });

router.post('/updateConfig', auth, (req, res) => {
  try {
    const config = req.body;
    if (!config || typeof config !== 'object') return res.status(400).json({ error: 'Invalid config payload' });
    const userConfigFile = path.join(CONFIG_ROOT, `${req.user}.json`);
    fs.writeFileSync(userConfigFile, JSON.stringify(config, null, 2), 'utf-8');
    res.json({ status: 'ok' });
    if(process.env.DEBUG) { console.log('Config updated for', req.user, config); }
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.get('/loadConfig', auth, async (req, res) => {
  try {
    if(process.env.DEBUG) { console.log('Loading config for', req.user); }
    const userConfigFile = path.join(CONFIG_ROOT, `${req.user}.json`);
    let userConfig = {};
    if (fs.existsSync(userConfigFile)) {
      const data = fs.readFileSync(userConfigFile, 'utf-8');
      userConfig = JSON.parse(data);
    }

    const providers = [];

    // --- Gemini ---
    if(process.env.DEBUG) { console.log('Checking Gemini AI availability with: ',process.env.API_URL ); }
    if (process.env.API_KEY && process.env.API_URL) {
      try {
        
        
        const response = await axios.get(`${process.env.API_URL}/models`, {
          headers: { Authorization: `Bearer ${process.env.API_KEY}` },
        });
        const modelList = response.data?.models?.map(m => m.id) || [];
        if (modelList.length > 0) providers.push("gemini");
      } catch(e) { e.message && console.warn("Gemini validation failed:", e.message); }
    }
    // --- OpenAI ---
     if(process.env.DEBUG) { console.log('Checking OpenAI availability with:', 'https://api.openai.com/v1/' ); }
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await axios.get(`https://api.openai.com/v1/models`, {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        });
        const modelList = response.data?.data?.map(m => m.id) || [];
        if (modelList.length > 0) providers.push({ openAI: { model: modelList } });
      } catch(e){ e.message && console.warn("OpenAI validation failed:", e.message);}
    }
    // --- Ollama ---
    if(process.env.DEBUG) { console.log('Checking Ollama AI availability with: ', process.env.OLLAMA_HOST_URL); }
    if (process.env.OLLAMA_HOST_URL) {
      try {
        const response = await axios.get(`${process.env.OLLAMA_HOST_URL}/api/tags`);
        const modelList = response.data?.models?.map(m => m.name) || [];
        if (modelList.length > 0) providers.push({ ollama: { model: modelList, default: true } });
      } catch(e){ e.message && console.warn("Ollama validation failed:", e.message); }
    }

    // --- Custom Provider ---
    if(process.env.DEBUG) { console.log('Checking Other AI availability with: ', process.env.CUSTOM_CHAT_COMPLETION_URL ); }
    if (process.env.CUSTOM_CHAT_COMPLETION_URL &&
      process.env.CUSTOM_MODEL_LIST_URL &&
      process.env.CUSTOM_API_KEY) {
      try {
        const response = await axios.get(process.env.CUSTOM_MODEL_LIST_URL, {
          headers: { Authorization: `Bearer ${process.env.CUSTOM_API_KEY}` },
        });
        const modelList = response.data?.data?.map(m => m.id) || [];
        if (modelList.length > 0) {
          providers.push({
            custom: {
              name: "Custom",
              model: modelList
            }
          });
        }
      } catch (e) { e.message && console.warn("Custom provider validation failed:", e.message);}
    }
    if(process.env.DEBUG) { console.log(userConfig); }
    const finalPayload = {
      provider: providers,
      selectedProvider: userConfig.selectedProvider,
      selectedModel: userConfig.selectedModel,
      toolbarActions: userConfig.toolbarActions || ["enrich", "format-selection", "undo", "redo"],
      appName: userConfig.appName || "MeghNote",
      accentColor: userConfig.accentColor || "#8b5cf6",
      appLogoUrl: userConfig.appLogoUrl || ""
    };

    if(process.env.DEBUG) { console.log('Config loaded for', req.user, finalPayload); }
    res.json(finalPayload);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

module.exports = router;
