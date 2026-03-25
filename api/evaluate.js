// api/evaluate.js
// Vercel Serverless Function — proxies essay to Claude API securely
// Your ANTHROPIC_API_KEY lives only here, never in the browser

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — allow your frontend to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { essay, taskQuestion, taskType } = req.body;

  // Basic validation
  if (!essay || essay.trim().length < 20) {
    return res.status(400).json({ error: 'Essay too short.' });
  }

  const questionBlock = taskQuestion
    ? `Task Question:\n"""\n${taskQuestion}\n"""\n\n`
    : '';

  const prompt = `You are a certified IELTS examiner. Evaluate this IELTS Writing Task ${taskType} essay strictly per official IELTS band descriptors. ${taskQuestion ? 'The task question is provided — use it to assess Task Response accuracy (how well the essay addresses the specific question).' : 'No task question was provided — evaluate Task Response on general IELTS criteria.'}

${questionBlock}Essay:
"""
${essay}
"""

Respond ONLY with a valid JSON object — no markdown, no extra text:
{
  "overall_band": <4–9, 0.5 increments>,
  "task_response": <4–9, 0.5 increments>,
  "coherence_cohesion": <4–9, 0.5 increments>,
  "lexical_resource": <4–9, 0.5 increments>,
  "grammatical_range": <4–9, 0.5 increments>,
  "strengths": "<2-3 sentences on what the candidate did well>",
  "weaknesses": "<2-3 sentences on the main weaknesses>",
  "feedback": "<3-4 sentences of detailed examiner-style feedback>",
  "improvement_1": "<specific, actionable tip>",
  "improvement_2": "<specific, actionable tip>",
  "improvement_3": "<specific, actionable tip>"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('');
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
