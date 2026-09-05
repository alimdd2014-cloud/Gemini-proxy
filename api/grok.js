// رفع الحد الأقصى لوقت الاستجابة في Vercel لمنع خطأ 500
export const maxDuration = 30;

export default async function handler(req, res) {
  const rawKeys = process.env.GROK_API_KEYS || process.env.GROQ_API_KEY || '';
  const keys = rawKeys
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفاتيح Groq في Vercel');
  }

  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  // إمكانية فحص النماذج بفتح الرابط مباشرة من المتصفح (GET)
  if (req.method === 'GET') {
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${selectedKey}` }
      });
      const data = await modelsRes.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).send(e.message);
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    // 1. جلب النماذج المتاحة في حسابك
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok || !modelsData.data) {
      return res.status(400).send(`خطأ في المفتاح: ${modelsData.error?.message || 'تأكد من المفتاح'}`);
    }

    // 2. استبعاد نماذج الصوت والتجارب الخارجية المقيدة
    const validModels = modelsData.data
      .map(m => m.id)
      .filter(id => {
        const n = id.toLowerCase();
        return !n.includes('whisper') &&
               !n.includes('guard') &&
               !n.includes('embed') &&
               !n.includes('vision') &&
               !n.includes('orpheus') &&
               !n.includes('canopylabs') &&
               !n.includes('tts') &&
               !n.includes('specdec');
      });

    // اختيار أفضل نموذج محادثة نصي نشط فوراً
    const chosenModel = validModels.find(id => id.includes('llama') || id.includes('qwen') || id.includes('gemma') || id.includes('deepseek')) || validModels[0];

    if (!chosenModel) {
      return res.status(400).send('لم يتم العثور على نموذج نصي صالح في الحساب');
    }

    // 3. إرسال الطلب للنموذج المختار مباشرة
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${selectedKey}`
      },
      body: JSON.stringify({
        model: chosenModel,
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

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Groq (${chosenModel}): ${data.error?.message || 'غير معروف'}`);
    }

    let reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';

    // حذف أي نصوص تفكير داخلية مثل <think>...</think>
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return res.status(200).send(reply || 'تدلل عيني ✨');

  } catch (error) {
    return res.status(500).send(`خطأ في السيرفر: ${error.message}`);
  }
}

