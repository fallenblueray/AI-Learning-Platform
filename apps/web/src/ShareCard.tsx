import { useEffect, useRef, useState } from 'react';
import { Download, Check, Sparkles } from 'lucide-react';

export const cardThemes = {
  navy: { label: '海軍藍', background: '#152b46', foreground: '#fff8eb', accent: '#bcebd9' },
  mint: { label: '薄荷綠', background: '#c8eddf', foreground: '#152b46', accent: '#26735f' },
  orange: { label: '暖橙', background: '#f7b077', foreground: '#342316', accent: '#82421d' },
};
export type CardTheme = keyof typeof cardThemes;

export function CardArtwork({
  title = '把好奇，\n變成作品。',
  author = '我的第一個 AI 小工具',
  theme = 'navy',
}: {
  title?: string;
  author?: string;
  theme?: CardTheme;
}) {
  const colors = cardThemes[theme];
  const [layout, setLayout] = useState<CardTextLayout>({
    lines: [],
    fontSize: 82,
    lineHeight: 106.6,
    firstBaseline: 500,
  });
  useEffect(() => {
    let active = true;
    const measure = () => {
      const context = document.createElement('canvas').getContext('2d');
      if (active && context) setLayout(layoutCardText(context, title.trim() || '你的想法，從這裡開始。'));
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
    };
  }, [title]);
  return (
    <div className="share-artwork fitted-card" style={{ background: colors.background, color: colors.foreground }}>
      <svg
        viewBox="0 0 1080 1080"
        role="img"
        aria-label={`${title.trim() || '你的想法，從這裡開始。'}${author.trim() ? ` — ${author.trim()}` : ''}`}
      >
        <text x="84" y="112" fill="currentColor" fontSize="22" fontFamily="sans-serif" letterSpacing="2">
          A LITTLE IDEA. A NEW POSSIBILITY.
        </text>
        <g transform="translate(805 155) scale(1.9)" fill={colors.accent}>
          <path d="M45 0h10v32L78 9l7 7-23 24h33v10H63l23 23-7 7-24-23v33H45V58L22 81l-7-7 23-24H5V40h32L14 17l7-7 24 24z" />
        </g>
        <g
          className="card-title-lines"
          fill="currentColor"
          fontFamily="'Noto Sans TC', sans-serif"
          fontWeight="700"
          fontSize={layout.fontSize}
        >
          {layout.lines.map((line, index) => (
            <text key={index} x="84" y={layout.firstBaseline + index * layout.lineHeight}>
              {line}
            </text>
          ))}
        </g>
        <path d="M84 882H996" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />
        <g className="artwork-bottom" fill="currentColor" fontFamily="'Noto Sans TC', sans-serif">
          <text x="84" y="950" fontSize="28">
            {author.trim()}
          </text>
          <path d="M942 960L982 920M947 920H982V955" fill="none" stroke="currentColor" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
}

interface CardTextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  firstBaseline: number;
}
// The SVG preview and exported PNG share measured lines and a reserved title area.
// The decorative symbol ends at y=326; the footer begins at y=882.
export function layoutCardText(context: CanvasRenderingContext2D, title: string): CardTextLayout {
  for (let fontSize = 82; fontSize >= 24; fontSize -= 2) {
    context.font = `700 ${fontSize}px "Noto Sans TC", sans-serif`;
    const lines: string[] = [];
    for (const paragraph of title.split('\n')) {
      let line = '';
      for (const char of Array.from(paragraph)) {
        if (line && context.measureText(line + char).width > 900) {
          lines.push(line);
          line = char;
        } else line += char;
      }
      lines.push(line);
    }
    const lineHeight = fontSize * 1.3;
    const height = lines.length * lineHeight;
    if (height <= 460 || fontSize === 24)
      return { lines, fontSize, lineHeight, firstBaseline: 350 + (460 - height) / 2 + fontSize };
  }
  throw new Error('未能配置卡片文字');
}

export function ShareCard() {
  const [title, setTitle] = useState('把好奇，變成作品。');
  const [author, setAuthor] = useState('');
  const [theme, setTheme] = useState<CardTheme>('navy');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  async function download() {
    if (!title.trim()) {
      setStatus('請先填寫標題，再下載分享卡。');
      titleInput.current?.focus();
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('你的瀏覽器未能建立圖片，請換一個瀏覽器再試。');
      const colors = cardThemes[theme];
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = colors.foreground;
      ctx.font = '500 22px sans-serif';
      ctx.fillText('A LITTLE IDEA. A NEW POSSIBILITY.', 84, 112);
      ctx.save();
      ctx.translate(900, 240);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 14;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(0, 85);
        ctx.stroke();
      }
      ctx.restore();
      const layout = layoutCardText(ctx, title.trim());
      ctx.font = `700 ${layout.fontSize}px "Noto Sans TC", sans-serif`;
      layout.lines.forEach((text, index) => ctx.fillText(text, 84, layout.firstBaseline + index * layout.lineHeight));
      ctx.globalAlpha = 0.35;
      ctx.fillRect(84, 882, 912, 2);
      ctx.globalAlpha = 1;
      ctx.font = '500 28px "Noto Sans TC", sans-serif';
      ctx.fillText(author.trim(), 84, 950, 820);
      ctx.strokeStyle = colors.foreground;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(942, 960);
      ctx.lineTo(982, 920);
      ctx.moveTo(947, 920);
      ctx.lineTo(982, 920);
      ctx.lineTo(982, 955);
      ctx.stroke();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('圖片匯出失敗，請再試一次。'))),
          'image/png',
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'innovate-share-card-1080.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus('PNG 已準備下載。請在瀏覽器的下載項目中查看。');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="share-tool" aria-labelledby="share-tool-title">
      <div className="tool-heading">
        <span>
          <Sparkles size={18} /> 實作工作桌
        </span>
        <span>LIVE PREVIEW</span>
      </div>
      <h2 id="share-tool-title">這張卡，由你來做。</h2>
      <CardArtwork title={title} author={author} theme={theme} />
      <label>
        卡片標題 <span className="field-hint">必填 · 最多 60 字</span>
        <input
          ref={titleInput}
          maxLength={60}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setStatus('');
          }}
        />
      </label>
      <label>
        作者 <span className="field-hint">選填</span>
        <input
          maxLength={24}
          value={author}
          placeholder="你的名字或一句署名"
          onChange={(e) => setAuthor(e.target.value)}
        />
      </label>
      <fieldset className="theme-picker">
        <legend>選一種配色</legend>
        {(Object.keys(cardThemes) as CardTheme[]).map((key) => (
          <label key={key} className={theme === key ? 'selected' : ''}>
            <input type="radio" name="card-theme" checked={theme === key} onChange={() => setTheme(key)} />
            <span className="color-dot" style={{ background: cardThemes[key].background }} />
            {cardThemes[key].label}
            {theme === key && <Check size={12} />}
          </label>
        ))}
      </fieldset>
      <button className="button full" onClick={() => void download()} disabled={busy}>
        <Download size={17} />
        {busy ? '正在製作圖片…' : '下載我的分享卡'}
        <small>PNG · 1080 × 1080</small>
      </button>
      <p className="tool-privacy">文字只在此頁面處理，重新整理後會重設。</p>
      <p className="download-status" role="status">
        {status}
      </p>
    </section>
  );
}
