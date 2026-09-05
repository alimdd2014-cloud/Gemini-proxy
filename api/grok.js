export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const body = req.body || {};
  const userMessage = body.message || (body.query && body.query.message) || body.text || '';

  if (!userMessage) {
    return res.status(200).send('يا روحي رسالتك فارغة! 🙈');
  }

  try {
    // 1. جلب قائمة النماذج المتاحة في حسابك
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${selectedKey}` }
    });
    const modelsData = await modelsRes.json();

    if (!modelsRes.ok || !modelsData.data) {
      return res.status(400).send(`خطأ في قراءة المفتاح: ${modelsData.error?.message || 'غير صالح'}`);
    }

    // 2. تصفية النماذج واستبعاد المقيدة ونماذج الصوت
    let candidates = modelsData.data
      .map(m => m.id)
      .filter(id => {
        const lower = id.toLowerCase();
        return !lower.includes('whisper') &&
               !lower.includes('guard') &&
               !lower.includes('embed') &&
               !lower.includes('vision') &&
               !lower.includes('canopylabs') &&
               !lower.includes('orpheus') &&
               !lower.includes('tts');
      });

    // ترتيب النماذج لإعطاء الأولوية لنماذج المحادثة المعتمدة
    candidates.sort((a, b) => {
      const score = (name) => {
        const n = name.toLowerCase();
        if (n.includes('llama')) return 10;
        if (n.includes('qwen')) return 8;
        if (n.includes('deepseek')) return 7;
        if (n.includes('gemma')) return 6;
        if (n.includes('mixtral')) return 5;
        return 1;
      };
      return score(b) - score(a);
    });

    if (candidates.length === 0) {
      return res.status(400).send('لا توجد نماذج دردشة نشطة في حسابك');
    }

    // 3. تجربة النماذج المؤهلة حتى ينجح أول نموذج فوراً
    let lastError = '';
    for (const targetModel of candidates.slice(0, 5)) {
      try {
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
            temperature: 0.7
          })
        });

        const data = await response.json();
        if (response.ok && data.choices?.[0]?.message?.content) {
          return res.status(200).send(data.choices[0].message.content);
        } else {
          lastError = `${targetModel}: ${data.error?.message || response.statusText}`;
        }
      } catch (err) {
        lastError = `${targetModel}: ${err.message}`;
      }
    }

    return res.status(400).send(`فشلت محاولة النماذج المتاحة: ${lastError}`);

  } catch (error) {
    return res.status(500).send(`خطأ في الاتصال: ${error.message}`);
  }
}
