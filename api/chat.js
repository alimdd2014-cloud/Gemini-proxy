export const maxDuration = 30;

export default async function handler(req, res) {
  // قبول طلبات POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // جلب مفتاح Gemini من متغيرات البيئة
  const rawKeys = process.env.GEMINI_API_KEY || process.env.GROK_API_KEYS || '';
  const keys = rawKeys
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفتاح GEMINI_API_KEY في Vercel');
  }

  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  // استخراج نص الرسالة بشكل آمن من أي صيغة مرسلة
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${selectedKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'أنتِ سوسو، فتاة عراقية مرحة ولطيفة جداً، تردين بلهجة عراقية محبوبة وعفوية، إجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو تكلف.'
          }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Gemini: ${data.error?.message || 'غير معروف'}`);
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'تدلل عيني ✨';
    return res.status(200).send(reply.trim());

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
