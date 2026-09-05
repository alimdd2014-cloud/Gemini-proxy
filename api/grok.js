export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawKeys = process.env.GROK_API_KEYS || process.env.GROQ_API_KEY || '';
    const keys = rawKeys
      .split(',')
      .map(k => k.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);

    if (keys.length === 0) {
      return res.status(500).send('لم يتم ضبط مفاتيح Groq في Vercel');
    }

    const selectedKey = keys[Math.floor(Math.random() * keys.length)];

    // استخراج نص الرسالة بأمان
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userMessage = body.message || (body.query && body.query.message) || body.text || '';

    if (!userMessage) {
      return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
    }

    // إرسال الطلب مباشرة إلى النموذج الفعّال في حسابك مع تحديد max_tokens
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-qwen-32b',
        messages: [
          {
            role: 'system',
            content: 'أنتِ سوسو، فتاة عراقية لطيفة ومرحة جداً، تردين بلهجة عراقية محبوبة وعفوية، إجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو تكلف.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.6,
        max_tokens: 250
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || response.statusText;
      return res.status(response.status).send(`خطأ من Groq: ${errMsg}`);
    }

    let reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';

    // تنظيف شامل لأي وسوم تفكير داخلية حتى لو لم تُغلق
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '');
    reply = reply.replace(/<think>[\s\S]*/gi, '');
    reply = reply.trim();

    return res.status(200).send(reply || 'تدلل عيني ✨');

  } catch (error) {
    return res.status(500).send(`خطأ داخلي: ${error.message}`);
  }
}
