export const maxDuration = 30;

export default async function handler(req, res) {
  // قراءة وتنظيف المفاتيح
  const rawKeys = process.env.GROK_API_KEYS || process.env.GROQ_API_KEY || '';
  const keys = rawKeys
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).send('لم يتم ضبط مفاتيح Groq في Vercel');
  }

  const selectedKey = keys[Math.floor(Math.random() * keys.length)];

  // إمكانية عرض قائمة النماذج المتاحة بفتح الرابط من المتصفح مباشرة
  if (req.method === 'GET') {
    try {
      const checkRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${selectedKey}` }
      });
      const data = await checkRes.json();
      const activeIds = (data.data || []).map(m => m.id);
      return res.status(200).json({ available_models: activeIds });
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
    // 1. جلب النماذج النشطة في الحساب فوراً
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsData = await modelsRes.json();

    let targetModel = 'deepseek-r1-distill-qwen-32b';

    if (modelsData.data) {
      const activeList = modelsData.data.map(m => m.id);
      // استبعاد النماذج الموقوفة أو المقيدة أو الصوتية
      const validModels = activeList.filter(id => {
        const lower = id.toLowerCase();
        return !lower.includes('whisper') &&
               !lower.includes('guard') &&
               !lower.includes('vision') &&
               !lower.includes('orpheus') &&
               !lower.includes('canopylabs') &&
               !lower.includes('distill-llama-70b') &&
               !lower.includes('mixtral');
      });

      // تفضيل نماذج Qwen الحديثة
      targetModel = validModels.find(id => id.includes('qwen-32b') || id.includes('qwen')) ||
                    validModels.find(id => id.includes('llama-3.3') || id.includes('llama-3.1')) ||
                    validModels[0] ||
                    targetModel;
    }

    // 2. إرسال الطلب في محاولة واحدة سريعة
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
            content: 'أنتِ سوسو، فتاة عراقية مرحة ولطيفة جداً، تردين بلهجة عراقية محبوبة وعفوية، وإجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو تكلف.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.6
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).send(`خطأ من Groq (${targetModel}): ${data.error?.message || 'غير معروف'}`);
    }

    let reply = data.choices?.[0]?.message?.content || 'تدلل عيني ✨';

    // مسح وسم التفكير الإنجليزي بالكامل
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return res.status(200).send(reply || 'تدلل عيني ✨');

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
