import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, PlayCircle, Trophy, Award, Download } from 'lucide-react';
import { api, post, levelNames } from './api';
import type { Learning } from './types';
interface CaptionTrack {
  id: string;
  language: string;
  label: string;
  url: string;
  default?: boolean;
}
interface MediaResponse {
  url: string;
  captions?: CaptionTrack[];
}
interface Result {
  score: number;
  passed: boolean;
  certificate_id: string | null;
  feedback: { id: string; correct: boolean; explanation: string }[];
}
export function LearningPage({
  id,
  notify,
  onBack,
  onComplete,
}: {
  id: string;
  notify: (m: string) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [data, setData] = useState<Learning | null>(null),
    [lessonIndex, setLessonIndex] = useState(0),
    [exam, setExam] = useState(false),
    [answers, setAnswers] = useState<Record<string, number>>({}),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [asset, setAsset] = useState(''),
    [captions, setCaptions] = useState<CaptionTrack[]>([]),
    [captionId, setCaptionId] = useState('off'),
    [mediaRevision, setMediaRevision] = useState(0),
    [error, setError] = useState('');
  const video = useRef<HTMLVideoElement | null>(null),
    lastSaved = useRef(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setLessonIndex(0);
    setExam(false);
    setResult(null);
    setAnswers({});
    api<Learning>(`/enrollments/${id}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const lesson = data?.content.lessons[lessonIndex];
  useEffect(() => {
    let active = true;
    setAsset('');
    setCaptions([]);
    setCaptionId('off');
    lastSaved.current = 0;
    if (lesson?.has_asset)
      api<MediaResponse>(`/enrollments/${id}/lessons/${lesson.id}/asset`)
        .then((r) => {
          if (active) {
            setAsset(r.url);
            setCaptions(r.captions ?? []);
            setCaptionId(r.captions?.find((t) => t.default)?.id ?? 'off');
          }
        })
        .catch((e) => {
          if (active) notify(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, lesson?.id, lesson?.has_asset, notify]);
  useEffect(() => {
    const tracks = video.current?.textTracks;
    if (tracks)
      Array.from(tracks).forEach((track, index) => {
        track.mode = captions[index]?.id === captionId ? 'showing' : 'disabled';
      });
  }, [captionId, captions, asset, mediaRevision]);
  useEffect(() => {
    const tracks = video.current?.textTracks;
    const sync = () => {
      if (!tracks) return;
      const index = Array.from(tracks).findIndex((track) => track.mode === 'showing');
      setCaptionId(captions[index]?.id ?? 'off');
    };
    tracks?.addEventListener('change', sync);
    return () => tracks?.removeEventListener('change', sync);
  }, [captions, asset, mediaRevision]);
  async function save(read: boolean, position = 0) {
    if (!lesson) return;
    try {
      await api(`/enrollments/${id}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ lesson_id: lesson.id, position_seconds: Math.floor(position), read }),
      });
      setData((old) =>
        old
          ? {
              ...old,
              progress: [
                ...old.progress.filter((p) => p.lesson_id !== lesson.id),
                {
                  lesson_id: lesson.id,
                  position_seconds: position,
                  read: read || old.progress.some((p) => p.lesson_id === lesson.id && p.read),
                },
              ],
            }
          : old,
      );
      if (read) notify('已記下你的學習進度。');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function submit() {
    setBusy(true);
    try {
      const r = await post<Result>(`/enrollments/${id}/attempts`, { answers });
      setResult(r);
      if (r.passed) onComplete();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="empty-state">
        <p role="alert">{error}</p>
        <button className="button" onClick={onBack}>
          返回我的學習
        </button>
      </div>
    );
  if (!data) return <div className="empty-state">正在準備課程…</div>;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        返回我的學習
      </button>
      <div className="lesson-heading">
        <span className="eyebrow">{levelNames[data.content.level]} · 自主學習</span>
        <h1>{data.content.title}</h1>
      </div>
      <div className="lesson-progress-banner">
        <span>你的學習紀錄</span>
        <strong>
          {data.progress.filter((p) => p.read).length} / {data.content.lessons.length} 個單元已閱讀
        </strong>
      </div>
      <div className="learning-layout">
        <aside className="lesson-nav">
          <h3>課程內容</h3>
          {data.content.lessons.map((l, i) => (
            <button
              key={l.id}
              className={!exam && i === lessonIndex ? 'active' : ''}
              onClick={() => {
                setLessonIndex(i);
                setExam(false);
              }}
            >
              <span>
                {data.progress.some((p) => p.lesson_id === l.id && p.read) ? (
                  <CheckCircle2 size={18} />
                ) : l.kind === 'video' ? (
                  <PlayCircle size={18} />
                ) : (
                  <FileText size={18} />
                )}
              </span>
              <span>{l.title}</span>
            </button>
          ))}
          <button className={exam ? 'active' : ''} onClick={() => setExam(true)}>
            <Trophy size={18} />
            <span>課程測驗</span>
          </button>
          <div className="lesson-note">
            你可以直接參加測驗。
            <br />
            80 分合格，不限次重考。
          </div>
        </aside>
        <section className="lesson-content panel">
          {exam ? (
            <>
              <div className="eyebrow">CHECK YOUR UNDERSTANDING</div>
              <h2>把所學，化為自己的理解。</h2>
              <p>單選題，共 {data.content.questions.length} 題。達 80 分即可獲得完成證書。</p>
              {result ? (
                <div className="exam-result">
                  <Award size={46} />
                  <h2>
                    {result.score}
                    <small> / 100</small>
                  </h2>
                  <h3>{result.passed ? '恭喜，你已通過課程測驗！' : '再試一次，讓理解更扎實。'}</h3>
                  <p>
                    {result.passed
                      ? '完成證書已排程製作，稍後可到「我的證書」下載。'
                      : '你可以重溫教材，然後再次挑戰。'}{' '}
                  </p>
                  {result.feedback.map((f, i) => (
                    <div className={`feedback ${f.correct ? 'correct' : ''}`} key={f.id}>
                      <strong>
                        第 {i + 1} 題 · {f.correct ? '答對了' : '可以再想想'}
                      </strong>
                      <p>{f.explanation}</p>
                    </div>
                  ))}
                  <button
                    className="button secondary"
                    onClick={() => {
                      setResult(null);
                      setAnswers({});
                    }}
                  >
                    重新測驗
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  {data.content.questions.map((q, i) => (
                    <fieldset className="question" key={q.id}>
                      <legend>
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        {q.prompt}
                      </legend>
                      {q.options.map((option, n) => (
                        <label className={`answer-option ${answers[q.id] === n ? 'selected' : ''}`} key={n}>
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === n}
                            onChange={() => setAnswers({ ...answers, [q.id]: n })}
                            required
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <button className="button" disabled={busy}>
                    {busy ? '評核中…' : '提交測驗'}
                    <ArrowRight size={17} />
                  </button>
                </form>
              )}
            </>
          ) : (
            lesson && (
              <>
                <div className="eyebrow">
                  單元 {String(lessonIndex + 1).padStart(2, '0')} / {data.content.lessons.length}
                </div>
                <h2>{lesson.title}</h2>
                {lesson.kind === 'video' && asset && (
                  <video
                    key={`${lesson.id}:${mediaRevision}`}
                    ref={video}
                    controls
                    playsInline
                    preload="metadata"
                    crossOrigin="anonymous"
                    src={asset}
                    onLoadedMetadata={() => {
                      if (video.current)
                        video.current.currentTime =
                          data.progress.find((p) => p.lesson_id === lesson.id)?.position_seconds || 0;
                    }}
                    onPause={(event) => void save(false, event.currentTarget.currentTime)}
                    onError={() => notify('影片連結可能已過期，請按「重新載入教材」。')}
                    onTimeUpdate={(event) => {
                      if (Date.now() - lastSaved.current > 15000) {
                        lastSaved.current = Date.now();
                        void save(false, event.currentTarget.currentTime);
                      }
                    }}
                  >
                    {captions.map((track) => (
                      <track
                        key={track.id}
                        kind="captions"
                        src={track.url}
                        srcLang={track.language}
                        label={track.label}
                        onError={() => notify('字幕未能載入，請重新載入教材。')}
                      />
                    ))}
                  </video>
                )}
                {lesson.kind === 'video' && captions.length > 0 && (
                  <label>
                    字幕
                    <select
                      aria-label="選擇字幕"
                      value={captionId}
                      onChange={(event) => setCaptionId(event.target.value)}
                    >
                      <option value="off">關閉字幕</option>
                      {captions.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {lesson.kind === 'video' && !asset && (
                  <div className="lesson-unavailable">
                    <PlayCircle size={38} />
                    <h3>{lesson.has_asset ? '正在準備影片' : '影片尚未加入'}</h3>
                    <p>
                      {lesson.has_asset
                        ? '若未能載入，可按下方按鈕重新取得教材。'
                        : '你可先閱讀文字教材；影片就緒後由課程管理員更新。'}
                    </p>
                  </div>
                )}
                {lesson.kind === 'text' && asset && <img className="lesson-image" src={asset} alt={lesson.title} />}
                {lesson.has_asset && (
                  <button
                    className="text-button"
                    onClick={() =>
                      api<MediaResponse>(`/enrollments/${id}/lessons/${lesson.id}/asset`)
                        .then((r) => {
                          setAsset(r.url);
                          setCaptions(r.captions ?? []);
                          setCaptionId(r.captions?.find((t) => t.id === captionId)?.id ?? 'off');
                          setMediaRevision((value) => value + 1);
                        })
                        .catch((e) => notify(e.message))
                    }
                  >
                    重新載入教材
                  </button>
                )}
                <div className="lesson-text">
                  {lesson.content.split('\n\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {lesson.kind === 'attachment' && asset && (
                  <a className="button secondary" href={asset} target="_blank" rel="noreferrer">
                    <Download size={17} />
                    開啟講義
                  </a>
                )}
                <div className="lesson-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      void save(true, video.current?.currentTime || 0);
                    }}
                  >
                    <CheckCircle2 size={17} />
                    標記已閱讀
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      lessonIndex < data.content.lessons.length - 1 ? setLessonIndex(lessonIndex + 1) : setExam(true)
                    }
                  >
                    {lessonIndex < data.content.lessons.length - 1 ? '下一個單元' : '參加測驗'}
                    <ArrowRight size={17} />
                  </button>
                </div>
              </>
            )
          )}
        </section>
      </div>
    </>
  );
}
