export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { prompt } = req.body;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1792",
        quality: "standard",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Ошибка генерации" });
    }

    res.status(200).json({ url: data.data[0].url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
