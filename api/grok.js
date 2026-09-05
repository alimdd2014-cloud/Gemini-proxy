export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // سحب وتنظيف المفاتيح
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
    // 1. جلب النماذج المتاحة في حسابك مباشرة من Groq
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok || !modelsData.data) {
      return res.status(400).send(`خطأ في جلب النماذج: ${modelsData.error?.message || 'تأكد من صلاحية المفتاح'}`);
    }

    // تصفية النماذج لاستبعاد نماذج الصوت والتضمين
    const textModels = modelsData.data
      .map(m => m.id)
      .filter(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('embed'));

    if (textModels.length === 0) {
      return res.status(400).send('لا توجد نماذج دردشة مفعلة في هذا المفتاح');
    }

    // اختيار أقوى نموذج متاح تلقائياً (مثل 70b أو أول نموذج نصي بالقائمة)
    const activeModel = textModels.find(m => m.includes('70b')) || textModels[0];

    // 2. إرسال الرسالة للنموذج المختار
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          {
            role: 'system',
            content: 'أنتِ سوسو، فتاة عراقية مرحة ولطيفة جداً، تردين بلهجة عراقية محبوبة وعفوية، وإجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون مقدمات رسمية.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Groq (${activeModel}): ${data.error?.message || 'غير معروف'}`);
    }

    const reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';
    return res.status(200).send(reply);

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
