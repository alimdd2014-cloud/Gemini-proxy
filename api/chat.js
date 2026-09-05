export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKeys = process.env.GEMINI_API_KEY || process.env.GROK_API_KEYS || '';
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

  // تجربة النماذج الحديثة المتاحة بالترتيب لضمان الاستجابة
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${selectedKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'أنتِ سوسو، بنية عراقية مرحة ولطيفة كلش، تردين بلهجة عراقية محبوبة وعفوية، إجاباتج قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو تكلف.'
            }]
          },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 250 }
        })
      });

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.status(200).send(data.candidates[0].content.parts[0].text.trim());
      }
    } catch (e) {
      continue;
    }
  }

  return res.status(500).send('تعذر الاتصال بنماذج Gemini، تأكد من صلاحية المفتاح.');
}
