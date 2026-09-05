export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKeys = process.env.GEMINI_API_KEY || '';
  const keys = rawKeys
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفتاح GEMINI_API_KEY في Vercel');
  }

  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${selectedKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'أنتِ سوسو، فتاة عراقية مرحة ولطيفة، تردين بلهجة عراقية محبوبة وعفوية، إجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون مقدمات رسمية.'
          }]
        },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 250 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`Google API Error [${response.status}]: ${data.error?.message || 'Unknown error'}`);
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'تدلل عيني ✨';
    return res.status(200).send(reply.trim());

  } catch (error) {
    return res.status(500).send(`Network Error: ${error.message}`);
  }
}
