require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer — store upload in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, GIF images are allowed.'));
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Caption API Route ──────────────────────────────────────────
app.post('/api/caption', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const { style = 'descriptive', length = 'medium', tone = 'neutral', count = '3', custom = '', model = 'meta-llama/llama-4-scout-17b-16e-instruct' } = req.body;

    const lengthGuide = {
      short:  '1 concise single line',
      medium: '2 to 3 clear sentences',
      long:   'a full descriptive paragraph'
    }[length] || '2 to 3 sentences';

    const prompt = `You are an expert image caption writer. Analyze the image carefully and respond ONLY with a valid JSON object — no markdown, no extra text, no explanation.

Required JSON format:
{
  "captions": ["caption1", "caption2"],
  "alt_text": "concise alt text under 125 characters",
  "description": "objective and detailed 2-4 sentence image description"
}

Rules:
- Generate exactly ${count} caption(s) in the captions array
- Caption style: ${style}
- Caption tone: ${tone}
- Caption length: ${lengthGuide}
- alt_text must be factual, screen-reader friendly, and under 125 characters
- description must be thorough and objective${custom ? `\n- Additional instruction: ${custom}` : ''}

Return ONLY the raw JSON object.`;

    // Convert image buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      console.error('Groq API error:', errData);
      return res.status(groqResponse.status).json({
        error: errData.error?.message || 'Groq API request failed.'
      });
    }

    const groqData = await groqResponse.json();
    const rawText = groqData.choices?.[0]?.message?.content || '';

    // Parse JSON from model response
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return res.status(500).json({ error: 'Model returned invalid JSON. Please try again.' });
    }

    return res.json(parsed);

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

// Catch-all — serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  AI Caption Generator running at http://localhost:${PORT}`);
});
