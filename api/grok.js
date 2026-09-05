export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKeys = process.env.GROK_API_KEYS || process.env.GROQ_API_KEY || '';
  const keys = rawKeys
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفاتيح Groq في Vercel');
  }

  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  const body = req.body || {};
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  // قائمة النماذج المعتمدة والسريعة في Groq للتجربة المباشرة بدون تايم أوت
  const modelsToTry = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
    'mixtral-8x7b-32768'
  ];

  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${selectedKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'أنتِ سوسو، فتاة عراقية لطيفة ومرحة، تردين بلهجة عراقية محبوبة وعفوية، وإجاباتك قصيرة ومختصرة جداً لمحادثات الواتساب وبدون مقدمات رسمية.'
            },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      let reply = data.choices?.[0]?.message?.content;

      if (response.ok && reply) {
        // حذف أي وسوم تفكير داخلية إن وجدت
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return res.status(200).send(reply || 'تدلل عيني ✨');
      } else {
        lastError = data.error?.message || response.statusText;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(500).send(`خطأ من Groq: ${lastError}`);
}
