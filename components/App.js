import { useState, useRef, useCallback } from "react";

const BASE_PROMPT = `Твоя роль: ты маркетолог с 5-летним опытом в нише {{niche}}.

Следующая задача: нужно написать ТЗ дизайнеру для рекламного креатива, а затем на основе этого ТЗ предложить сам креатив.

Продукт:
{{productInfo}}

Главная информация о продукте:
{{mainProductMessage}}

Целевая аудитория / контекст:
{{audienceInfo}}

Язык:
{{language}}

Стиль:
{{style}}

Пожелания:
{{wishes}}

Акценты:
{{focusPoints}}

Референсы:
{{references}}

Правки:
{{revisionRequest}}

Тебе нужно:
1. Проанализировать продукт
2. Проанализировать ЦА: кто это, боли, желания, триггеры
3. Проанализировать референсы: структура, стиль, подача
4. Создать детальное ТЗ дизайнеру
5. Предложить концепцию креатива

Учитывай: формат 9:16, Facebook/Instagram, 1-3 секунды на захват внимания, пользователь должен сразу понять оффер, текст короткий, визуал простой, без перегруза.

ВАЖНО: Верни ответ строго в формате JSON (без markdown-обёртки, без \`\`\`json). Структура:

{
  "audienceAnalysis": "...",
  "referenceAnalysis": "...",
  "designerBrief": "1. Задача: ...\\n2. Цель: ...\\n3. Формат: 9:16\\n4. Основная идея: ...\\n5. Визуал: ...\\n6. Композиция: ...\\n7. Что в кадре: ...\\n8. Главный акцент: ...\\n9. Тексты:\\n   - Заголовок: ...\\n   - Подзаголовок: ...\\n   - CTA: ...\\n10. Иерархия: ...\\n11. Стиль: ...\\n12. Ограничения: ...\\n13. Почему сработает: ...",
  "creativeConcept": "...",
  "imagePrompt": "A detailed DALL-E prompt in English for a 9:16 vertical advertising image. Describe visual style, composition, colors, mood, key visual elements. No text overlays in the image."
}`;

const fillPrompt = (template, vars) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v || "—"), template);

const uid = () => Math.random().toString(36).slice(2, 10);

// Upload single image to Vercel Blob, returns public URL
async function uploadToBlob(base64, filename, mimeType) {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, filename, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
  return data.url;
}

async function callClaude({ prompt, imageUrls }) {
  const content = [];
  imageUrls.forEach((url) => {
    content.push({ type: "image", source: { type: "url", url } });
  });
  content.push({ type: "text", text: prompt });

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) throw new Error(`Ошибка API: ${res.status}`);
  const data = await res.json();
  const raw = data.content.map((b) => b.text || "").join("");
  const clean = raw.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Не удалось получить результат. Попробуйте ещё раз.");
  return JSON.parse(match[0]);
}

async function generateImage(prompt) {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка генерации");
  return data.url;
}

const Icons = {
  Upload: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 10l-4-4-4 4M12 6v10" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  X: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>,
  Copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" /></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  History: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Zap: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M13 2L4.093 12.688A1 1 0 005 14h6l-2 8 9.907-10.688A1 1 0 0018 10h-6l1-8z" /></svg>,
  Pencil: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  ChevronRight: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  Image: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const inputStyle = { background: "#1a1814", border: "1px solid #2d2a25", borderRadius: "6px", color: "#e8e0d0", fontFamily: "'Outfit', sans-serif" };

const Label = ({ children, optional }) => (
  <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#8B7355", letterSpacing: "0.12em" }}>
    {children}
    {optional && <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "#5a5248" }}>опционально</span>}
  </label>
);

const Input = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle}
    onFocus={(e) => (e.target.style.borderColor = "#8B7355")}
    onBlur={(e) => (e.target.style.borderColor = "#2d2a25")} />
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    className="w-full px-4 py-3 text-sm outline-none resize-none transition-all" style={inputStyle}
    onFocus={(e) => (e.target.style.borderColor = "#8B7355")}
    onBlur={(e) => (e.target.style.borderColor = "#2d2a25")} />
);

// Upload images one by one to Vercel Blob
function ImageUpload({ images, setImages }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFiles = useCallback(async (files) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const reader = new FileReader();
        const base64 = await new Promise((res) => {
          reader.onload = (e) => res(e.target.result.split(",")[1]);
          reader.readAsDataURL(file);
        });
        // Show preview immediately
        const previewUrl = URL.createObjectURL(file);
        const tempId = uid();
        setImages((prev) => [...prev, { id: tempId, url: previewUrl, blobUrl: null, uploading: true, name: file.name }]);
        // Upload to blob
        const blobUrl = await uploadToBlob(base64, `${uid()}-${file.name}`, file.type);
        setImages((prev) => prev.map((img) =>
          img.id === tempId ? { ...img, blobUrl, uploading: false } : img
        ));
      } catch (e) {
        console.error("Upload error:", e);
      }
    }
    setUploading(false);
  }, [setImages]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  return (
    <div>
      <div onClick={() => inputRef.current.click()} onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        className="cursor-pointer flex flex-col items-center justify-center gap-3 py-10 transition-all"
        style={{ border: `2px dashed ${dragging ? "#8B7355" : "#2d2a25"}`, borderRadius: "10px", background: dragging ? "#1f1d1980" : "#12110e" }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#1a1814", border: "1px solid #2d2a25" }}>
          {uploading ? (
            <div className="w-4 h-4 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "#8B7355" }} />
          ) : <Icons.Upload />}
        </div>
        <div className="text-center">
          <p className="text-sm" style={{ color: "#e8e0d0" }}>
            {uploading ? "Загружаю..." : <>Перетащите или <span style={{ color: "#8B7355" }}>выберите файлы</span></>}
          </p>
          <p className="text-xs mt-1" style={{ color: "#5a5248" }}>PNG, JPG, WEBP — любой размер</p>
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => processFiles(e.target.files)} />
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {images.map((img) => (
            <div key={img.id} className="relative group w-20 h-20">
              <img src={img.url} alt={img.name} className="w-full h-full object-cover rounded-lg" style={{ border: "1px solid #2d2a25", opacity: img.uploading ? 0.5 : 1 }} />
              {img.uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "#00000060" }}>
                  <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "#8B7355" }} />
                </div>
              )}
              {!img.uploading && (
                <div className="absolute top-1 right-1 w-3 h-3 rounded-full" style={{ background: "#6fcf97" }} />
              )}
              <button onClick={() => setImages((p) => p.filter((i) => i.id !== img.id))}
                className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "#e55a4e", color: "#fff" }}><Icons.X /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, content, accent }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative overflow-hidden" style={{ background: "#1a1814", border: "1px solid #2d2a25", borderRadius: "10px" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #2d2a25" }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: accent, letterSpacing: "0.14em" }}>{title}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
          style={{ color: copied ? "#6fcf97" : "#5a5248", background: "#0f0e0c" }}>
          {copied ? <Icons.Check /> : <Icons.Copy />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <div className="px-5 py-5">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#c4b99a" }}>{content}</p>
      </div>
    </div>
  );
}

function ImageCard({ imageUrl, onRegenerate, loading }) {
  return (
    <div className="relative overflow-hidden" style={{ background: "#1a1814", border: "1px solid #2d2a25", borderRadius: "10px" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #FF6B6B, transparent)" }} />
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #2d2a25" }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#FF6B6B", letterSpacing: "0.14em" }}>Сгенерированный креатив</span>
        <div className="flex gap-2">
          <button onClick={onRegenerate} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded" style={{ color: "#5a5248", background: "#0f0e0c" }}>
            <Icons.Zap />{loading ? "Генерирую..." : "Ещё раз"}
          </button>
          <a href={imageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded" style={{ color: "#5a5248", background: "#0f0e0c" }}>
            <Icons.Download />Скачать
          </a>
        </div>
      </div>
      <div className="p-5 flex justify-center">
        <img src={imageUrl} alt="Creative" className="rounded-lg" style={{ maxHeight: "600px", maxWidth: "100%", objectFit: "contain", border: "1px solid #2d2a25" }} />
      </div>
    </div>
  );
}

function HistoryPanel({ history, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div className="relative ml-auto w-80 h-full flex flex-col" style={{ background: "#13120f", borderLeft: "1px solid #2d2a25" }}>
        <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid #2d2a25" }}>
          <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: "#8B7355" }}>История</h2>
          <button onClick={onClose} style={{ color: "#5a5248" }}><Icons.X /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-32"><p className="text-sm" style={{ color: "#5a5248" }}>Пока нет сохранений</p></div>
          ) : history.map((item) => (
            <button key={item.id} onClick={() => { onSelect(item); onClose(); }}
              className="w-full text-left px-5 py-4 transition-colors hover:bg-white/5 flex items-center justify-between"
              style={{ borderBottom: "1px solid #1a1814" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "#e8e0d0" }}>{item.form.niche || "Без ниши"}</p>
                <p className="text-xs mt-0.5" style={{ color: "#5a5248" }}>{new Date(item.ts).toLocaleString("ru")}</p>
              </div>
              <Icons.ChevronRight />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const Spinner = ({ text = "Генерирую", sub = "Подождите..." }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-6">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full" style={{ border: "2px solid #2d2a25" }} />
      <div className="absolute inset-0 rounded-full animate-spin" style={{ border: "2px solid transparent", borderTopColor: "#8B7355" }} />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold" style={{ color: "#8B7355" }}>{text}</p>
      <p className="text-xs mt-1" style={{ color: "#5a5248" }}>{sub}</p>
    </div>
  </div>
);

const EMPTY_FORM = { niche: "", productInfo: "", mainProductMessage: "", audienceInfo: "", language: "Русский", style: "", wishes: "", focusPoints: "" };

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);

  const setField = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const generate = async (revisionRequest = "") => {
    const stillUploading = images.some((img) => img.uploading);
    if (stillUploading) { alert("Подождите — изображения ещё загружаются..."); return; }

    setLoading(true); setError(null); setGeneratedImage(null);
    try {
      const imageUrls = images.filter((img) => img.blobUrl).map((img) => img.blobUrl);
      const refText = imageUrls.length > 0
        ? `Прикреплено ${imageUrls.length} референс(ов). Проанализируй их визуально.`
        : "Референсы не предоставлены.";

      const prompt = fillPrompt(BASE_PROMPT, { ...form, references: refText, revisionRequest: revisionRequest || "—" });
      const data = await callClaude({ prompt, imageUrls });
      setResult(data); setRevisionMode(false); setRevisionText("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleGenerateImage = async () => {
    if (!result?.imagePrompt) return;
    setImageLoading(true); setImageError(null);
    try { setGeneratedImage(await generateImage(result.imagePrompt)); }
    catch (e) { setImageError(e.message); }
    finally { setImageLoading(false); }
  };

  const handleRevision = () => {
    const extra = `\n\nПРЕДЫДУЩАЯ ВЕРСИЯ:\n${JSON.stringify(result, null, 2)}\n\nЧТО ИЗМЕНИТЬ: ${revisionText}`;
    generate(revisionText + extra);
  };

  const saveToHistory = () => {
    setHistory((h) => [{ id: uid(), form, result, ts: Date.now() }, ...h.slice(0, 19)]);
    alert("Сохранено ✓");
  };

  const downloadResult = () => {
    if (!result) return;
    const text = ["═══ АНАЛИЗ ЦА ═══\n" + result.audienceAnalysis, "\n═══ АНАЛИЗ РЕФЕРЕНСОВ ═══\n" + result.referenceAnalysis, "\n═══ ТЗ ДЛЯ ДИЗАЙНЕРА ═══\n" + result.designerBrief, "\n═══ КОНЦЕПЦИЯ КРЕАТИВА ═══\n" + result.creativeConcept].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = `brief-${Date.now()}.txt`; a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: "#0f0e0c", fontFamily: "'Outfit', sans-serif", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
        ::placeholder { color: #3d3830 !important; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f0e0c; }
        ::-webkit-scrollbar-thumb { background: #2d2a25; border-radius: 2px; }
      `}</style>

      <header style={{ borderBottom: "1px solid #1a1814" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "#8B7355" }}><Icons.Zap /></div>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "22px", letterSpacing: "0.08em", lineHeight: 1 }}>CREATIVE STUDIO</h1>
              <p className="text-xs" style={{ color: "#5a5248" }}>AI-генерация рекламных креативов</p>
            </div>
          </div>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-4 py-2 rounded text-sm"
            style={{ border: "1px solid #2d2a25", color: "#8B7355", background: "#1a1814" }}>
            <Icons.History />История
            {history.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#8B735530" }}>{history.length}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!result && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "38px", letterSpacing: "0.06em", lineHeight: 1 }}>СДЕЛАТЬ КРЕАТИВ</h2>
              <p className="mt-2 text-sm" style={{ color: "#5a5248" }}>Заполните бриф — Claude создаст ТЗ, концепцию и изображение</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label>Референсы</Label>
                <ImageUpload images={images} setImages={setImages} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1"><Label>Ниша</Label><Input value={form.niche} onChange={setField("niche")} placeholder="Фитнес, курсы, косметика..." /></div>
                <div className="col-span-2 sm:col-span-1"><Label>Язык креатива</Label><Input value={form.language} onChange={setField("language")} placeholder="Русский" /></div>
              </div>
              <div><Label>Информация о продукте</Label><Textarea value={form.productInfo} onChange={setField("productInfo")} placeholder="Что за продукт, цена, характеристики..." rows={3} /></div>
              <div><Label>Главный оффер / суть</Label><Textarea value={form.mainProductMessage} onChange={setField("mainProductMessage")} placeholder="Главная мысль для донесения..." rows={2} /></div>
              <div><Label optional>Целевая аудитория</Label><Textarea value={form.audienceInfo} onChange={setField("audienceInfo")} placeholder="Кто покупает, возраст, боли, желания..." rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1"><Label>Стиль (2–5 слов)</Label><Input value={form.style} onChange={setField("style")} placeholder="Минимализм, яркий..." /></div>
                <div className="col-span-2 sm:col-span-1"><Label optional>Акценты</Label><Input value={form.focusPoints} onChange={setField("focusPoints")} placeholder="На что делать упор..." /></div>
              </div>
              <div><Label optional>Пожелания</Label><Textarea value={form.wishes} onChange={setField("wishes")} placeholder="Особые требования..." rows={2} /></div>

              {error && <div className="px-4 py-3 rounded text-sm" style={{ background: "#e55a4e15", border: "1px solid #e55a4e40", color: "#e55a4e" }}>{error}</div>}

              <button onClick={() => generate()}
                className="w-full py-4 font-bold tracking-widest uppercase flex items-center justify-center gap-3 rounded transition-all"
                style={{ background: "#8B7355", color: "#0f0e0c", letterSpacing: "0.14em", fontFamily: "'Bebas Neue', sans-serif", fontSize: "16px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#a08660")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#8B7355")}>
                <Icons.Zap />Сгенерировать
              </button>
            </div>
          </div>
        )}

        {loading && <Spinner text="Генерирую креатив" sub="Claude анализирует данные и референсы..." />}

        {result && !loading && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "32px", letterSpacing: "0.06em", lineHeight: 1 }}>РЕЗУЛЬТАТ</h2>
                <p className="text-xs mt-1" style={{ color: "#5a5248" }}>{form.niche && `Ниша: ${form.niche}`}</p>
              </div>
              <button onClick={() => { setResult(null); setRevisionMode(false); setGeneratedImage(null); setImages([]); }}
                className="text-xs px-4 py-2 rounded" style={{ border: "1px solid #2d2a25", color: "#8B7355", background: "#1a1814" }}>
                ← Новый
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <ResultCard title="Анализ ЦА" content={result.audienceAnalysis} accent="#6fcf97" />
              <ResultCard title="Анализ референсов" content={result.referenceAnalysis} accent="#56CCF2" />
              <ResultCard title="ТЗ для дизайнера" content={result.designerBrief} accent="#F2C94C" />
              <ResultCard title="Концепция креатива" content={result.creativeConcept} accent="#BB6BD9" />

              {!generatedImage && !imageLoading && (
                <div className="rounded-xl p-6 text-center" style={{ background: "#1a1814", border: "1px dashed #2d2a25" }}>
                  <div className="flex justify-center mb-3" style={{ color: "#5a5248" }}><Icons.Image /></div>
                  <p className="text-sm mb-1" style={{ color: "#e8e0d0" }}>Сгенерировать изображение</p>
                  <p className="text-xs mb-4" style={{ color: "#5a5248" }}>DALL-E 3 создаст визуал на основе концепции</p>
                  {imageError && <p className="text-xs mb-3" style={{ color: "#e55a4e" }}>{imageError}</p>}
                  <button onClick={handleGenerateImage}
                    className="px-6 py-3 rounded text-sm font-semibold flex items-center gap-2 mx-auto"
                    style={{ background: "#FF6B6B20", border: "1px solid #FF6B6B50", color: "#FF6B6B" }}>
                    <Icons.Image />Сгенерировать изображение
                  </button>
                </div>
              )}

              {imageLoading && <Spinner text="Генерирую изображение" sub="DALL-E 3 рисует ваш креатив..." />}
              {generatedImage && <ImageCard imageUrl={generatedImage} onRegenerate={handleGenerateImage} loading={imageLoading} />}
            </div>

            {revisionMode && (
              <div className="mb-4 p-5 rounded-lg" style={{ background: "#1a1814", border: "1px solid #2d2a25" }}>
                <Label>Что изменить?</Label>
                <Textarea value={revisionText} onChange={setRevisionText} placeholder="Опишите правки..." rows={3} />
                <div className="flex gap-3 mt-4">
                  <button onClick={handleRevision} className="flex-1 py-3 font-bold text-xs tracking-widest uppercase rounded flex items-center justify-center gap-2"
                    style={{ background: "#8B7355", color: "#0f0e0c" }}>
                    <Icons.Zap />Перегенерировать
                  </button>
                  <button onClick={() => setRevisionMode(false)} className="px-5 py-3 text-xs rounded"
                    style={{ border: "1px solid #2d2a25", color: "#5a5248" }}>Отмена</button>
                </div>
              </div>
            )}

            {!revisionMode && (
              <div className="flex flex-wrap gap-3">
                <button onClick={saveToHistory} className="flex items-center gap-2 px-5 py-3 rounded text-sm font-semibold" style={{ background: "#8B7355", color: "#0f0e0c" }}>
                  <Icons.Check />Готово
                </button>
                <button onClick={() => setRevisionMode(true)} className="flex items-center gap-2 px-5 py-3 rounded text-sm" style={{ border: "1px solid #2d2a25", color: "#e8e0d0", background: "#1a1814" }}>
                  <Icons.Pencil />Правки
                </button>
                <button onClick={downloadResult} className="flex items-center gap-2 px-5 py-3 rounded text-sm" style={{ border: "1px solid #2d2a25", color: "#e8e0d0", background: "#1a1814" }}>
                  <Icons.Download />Скачать ТЗ
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {showHistory && <HistoryPanel history={history} onSelect={(item) => { setForm(item.form); setResult(item.result); setGeneratedImage(null); }} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
