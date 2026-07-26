// Vercel serverless function: keeps the Gemini API key off the browser.
const SYSTEM_PROMPT = "You are a supportive academic wellbeing analyst for medical students. Analyze the JSON array of daily study logs you receive for patterns linking information overload, sustained/rising stress, and early burnout risk — specifically: stress rising alongside rising hours or subject count (overload pattern), consistently high stress regardless of hours (chronic strain), long hours with little subject variation (monotony/no recovery), or sudden spikes vs. the rest of the week. Respond ONLY with valid JSON: { risk_level: 'Low'|'Moderate'|'High', reasoning: string (2-3 sentences referencing actual numbers/trends from the data), suggestions: array of 3 specific, actionable schedule adjustments (not generic advice) }. Tone: calm, factual, encouraging, never alarmist. Base risk_level strictly on the given data.";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI insight is not configured yet. Add GEMINI_API_KEY in Vercel.' });
  const logs = req.body && req.body.logs;
  if (!Array.isArray(logs) || logs.length < 2) return res.status(400).json({ error: 'Add at least two daily logs before requesting an insight.' });
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(logs) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error && payload.error.message || 'Gemini request failed.');
    const text = payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts[0].text;
    const insight = JSON.parse(text);
    if (!['Low', 'Moderate', 'High'].includes(insight.risk_level) || !insight.reasoning || !Array.isArray(insight.suggestions)) throw new Error('The AI returned an unexpected response. Please try again.');
    return res.status(200).json(insight);
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unable to generate an insight right now.' });
  }
};

