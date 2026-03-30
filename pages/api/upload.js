import { put } from "@vercel/blob";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { base64, filename, mimeType } = req.body;
    const buffer = Buffer.from(base64, "base64");
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mimeType,
    });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
