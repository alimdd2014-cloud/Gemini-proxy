export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawKeys = process.env.GROK_API_KEYS || process.env.GROQ_API_KEY || '';
  const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

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
    // 1. جلب النماذج المتاحة فعلياً لمفتاحك من Groq مباشرة
    const modelsResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsJson = await modelsResponse.json();

    if (!modelsResponse.ok || !modelsJson.data) {
      return res.status(400).send(`فشل جلب النماذج: ${JSON.stringify(modelsJson)}`);
    }

    const modelIds = modelsJson.data.map(m => m.id);

    // 2. اختيار النموذج الأفضل المتوفر في حسابك تلقائياً
    const targetModel = modelIds.find(id => id.includes('llama-3') || id.includes('llama') || id.includes('gemma') || id.includes('mixtral')) || modelIds[0];

    if (!targetModel) {
      return res.status(400).send(`لا توجد نماذج دردشة مفعلة في حسابك.`);
    }

    // 3. إرسال السؤال إلى النموذج المختار
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          {
            role: 'system',
            content: 'أنتِ سوسو، فتاة عراقية مرحة ولطيفة جداً، تردين بلهجة عراقية محبوبة وعفوية، وإجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو علامات رسمية.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Groq (${targetModel}): ${data.error?.message || 'غير معروف'}`);
    }

    const reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';
    return res.status(200).send(reply);

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
