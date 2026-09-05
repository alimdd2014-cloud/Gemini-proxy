export default async function handler(req, res) {
  // السماح بطلبات POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // جلب المفاتيح وتقسيمها إذا كانت متعددة
  const rawKeys = process.env.GROK_API_KEYS || process.env.XAI_API_KEY || '';
  const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفاتيح Grok في Vercel');
  }

  // اختيار مفتاح عشوائي لتوزيع الحمل
  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  // استخراج الرسالة من جسم الطلب
  const body = req.body || {};
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
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
      return res.status(response.status).send(`خطأ من Grok: ${data.error?.message || 'غير معروف'}`);
    }

    const reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';

    // إرجاع النص الصافي مباشرة
    return res.status(200).send(reply);

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
