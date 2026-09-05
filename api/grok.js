export const maxDuration = 30;

// يمكنك كتابة أي اسم نموذج معتمد في حسابك هنا مباشرة
const MODEL_NAME = 'qwen-2.5-32b';

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

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: 'أنتِ سوسو، فتاة عراقية لطيفة ومرحة، تردين بلهجة عراقية محبوبة وعفوية، وإجاباتك قصيرة ومختصرة جداً لمحادثات الواتساب اليومية وبدون مقدمات رسمية.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Groq (${MODEL_NAME}): ${data.error?.message || 'تأكد من اسم النموذج'}`);
    }

    let reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';

    // تنظيف أي وسوم تفكير داخلية
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return res.status(200).send(reply || 'تدلل عيني ✨');

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
