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

  // فحص النماذج بفتح رابط البروكسي مباشرة في المتصفح
  if (req.method === 'GET') {
    try {
      const mRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${selectedKey}` }
      });
      const mData = await mRes.json();
      return res.status(200).json({ active_models: (mData.data || []).map(m => m.id) });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    // 1. جلب النماذج الفعلية من حسابك
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok || !modelsData.data) {
      return res.status(400).send(`فشل فحص المفتاح: ${modelsData.error?.message || 'تأكد من صلاحية المفتاح'}`);
    }

    const allIds = modelsData.data.map(m => m.id);

    // 2. استبعاد النماذج الموقوفة والصوتية والتجريبية المقيدة
    const validModels = allIds.filter(id => {
      const l = id.toLowerCase();
      return !l.includes('whisper') &&
             !l.includes('guard') &&
             !l.includes('vision') &&
             !l.includes('orpheus') &&
             !l.includes('canopylabs') &&
             !l.includes('embed') &&
             !l.includes('tts') &&
             !l.includes('mixtral') &&
             !l.includes('distill'); // استبعاد عائلة distill المتوقفة
    });

    // ترتيب الأفضلية لنماذج المحادثة المعتمدة
    validModels.sort((a, b) => {
      const score = (name) => {
        const n = name.toLowerCase();
        if (n.includes('llama-3.3')) return 10;
        if (n.includes('llama-3.1')) return 9;
        if (n.includes('llama-3')) return 8;
        if (n.includes('qwen')) return 7;
        if (n.includes('gemma')) return 6;
        return 1;
      };
      return score(b) - score(a);
    });

    const targetModel = validModels[0];

    if (!targetModel) {
      return res.status(400).send(`النماذج المتوفرة في حسابك: ${allIds.join(', ')}`);
    }

    // 3. إرسال الرسالة للنموذج المختار مع تقييد الرموز لمنع خطأ OTPM
    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            content: 'أنتِ سوسو، فتاة عراقية لطيفة ومرحة جداً، تردين بلهجة عراقية محبوبة وعفوية، إجاباتك قصيرة ومختصرة تناسب محادثات الواتساب اليومية وبدون أي مقدمات أو تكلف.'
          },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    const chatData = await chatRes.json();

    if (!chatRes.ok) {
      return res.status(chatRes.status).send(`خطأ (${targetModel}): ${chatData.error?.message}. القائمة: ${allIds.slice(0, 6).join(', ')}`);
    }

    let reply = chatData.choices?.[0]?.message?.content || 'تدلل عيني ✨';
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '');
    reply = reply.replace(/<think>[\s\S]*/gi, '');
    reply = reply.trim();

    return res.status(200).send(reply || 'تدلل عيني ✨');

  } catch (error) {
    return res.status(500).send(`خطأ في السيرفر: ${error.message}`);
  }
}
