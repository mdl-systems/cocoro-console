'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CocoroLogo from './CocoroLogo';
import { apiPost, apiGet } from '@/lib/api-client';

// ─── Types ──────────────────────────────────────────────────

interface SetupQuestion {
    index: number;
    total: number;
    progress: number;
    id: string;
    text: string;
    type: 'open' | 'choice' | 'scale' | 'ranking' | 'order';
    category: string;
    category_label: string;
    choices?: string[];
    options?: string[];  // choices の別名フィールド
    items?: string[];   // ranking タイプで使用
    left_label?: string;   // scale 左端ラベル
    right_label?: string;  // scale 右端ラベル
}

interface SetupResult {
    personality?: Record<string, unknown>;
    summary?: string;
}

interface Props {
    onComplete: () => void;
}

// ─── Category Emoji Map ──────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
    opening: '🌸',
    personality: '✨',
    values: '💎',
    emotion: '💜',
    relationships: '🤝',
    work: '🎯',
    lifestyle: '🌿',
    communication: '💬',
    creativity: '🎨',
    growth: '🌱',
    default: '🌸',
};

// ─── Sub-components ─────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
    const pct = total > 0 ? (current / total) * 100 : 0;
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--foreground-muted, #888)' }}>
                <span>{current} / {total}</span>
                <span>{Math.round(pct)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(216,120,152,0.15)' }}>
                <motion.div
                    className="h-1.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #F0A8C0, #D87898)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
}

const OpenInput = ({ value, onChange, textareaRef, autoFocus }: {
    value: string;
    onChange: (v: string) => void;
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
    autoFocus?: boolean;
}) => (
    <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="ここに入力してください..."
        rows={4}
        className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all"
        style={{
            background: 'var(--background-secondary, #faf6f4)',
            border: '1.5px solid rgba(216,120,152,0.25)',
            color: 'var(--foreground, #2a2a2a)',
            fontFamily: 'inherit',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(216,120,152,0.6)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(216,120,152,0.25)'; }}
    />
);

function ChoiceInput({ choices, value, onChange }: { choices: string[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: choices.length <= 3 ? '1fr' : 'repeat(2, 1fr)' }}>
            {choices.map(choice => {
                const selected = value === choice;
                return (
                    <button
                        key={choice}
                        onClick={() => onChange(choice)}
                        className="px-4 py-3 rounded-xl text-sm text-left transition-all duration-200"
                        style={{
                            background: selected ? 'rgba(216,120,152,0.12)' : 'var(--background-secondary, #faf6f4)',
                            border: `1.5px solid ${selected ? 'rgba(216,120,152,0.6)' : 'rgba(216,120,152,0.2)'}`,
                            color: selected ? '#c06080' : 'var(--foreground, #2a2a2a)',
                            fontWeight: selected ? 500 : 400,
                        }}
                    >
                        {choice}
                    </button>
                );
            })}
        </div>
    );
}

function ScaleInput({ value, onChange, leftLabel, rightLabel }: {
    value: string;
    onChange: (v: string) => void;
    leftLabel?: string;
    rightLabel?: string;
}) {
    const num = value ? parseInt(value) : 5;
    const left = leftLabel ?? 'low';
    const right = rightLabel ?? 'high';

    return (
        <div className="space-y-4">
            {/* Slider */}
            <input
                type="range"
                min={1}
                max={10}
                value={num}
                onChange={e => onChange(e.target.value)}
                className="w-full accent-pink-400"
                style={{ accentColor: '#D87898', height: 4 }}
            />
            {/* Scale labels */}
            <div className="flex justify-between text-xs" style={{ color: 'var(--foreground-muted, #888)' }}>
                <span>{left}</span>
                <span>{right}</span>
            </div>
            {/* Current value */}
            <div className="text-center">
                <span
                    className="inline-block px-5 py-1.5 rounded-full text-sm font-semibold"
                    style={{ background: 'rgba(216,120,152,0.12)', color: '#c06080' }}
                >
                    {num}
                </span>
            </div>
        </div>
    );
}

function RankingInput({ items, onOrderChange }: { items: string[]; onOrderChange: (ordered: string[]) => void }) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => setDragIndex(index);

    const handleDrop = (index: number) => {
        if (dragIndex === null || dragIndex === index) return;
        const newItems = [...items];
        const [moved] = newItems.splice(dragIndex, 1);
        newItems.splice(index, 0, moved);
        onOrderChange(newItems);
        setDragIndex(null);
    };

    return (
        <div className="space-y-2">
            <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted, #888)' }}>
                ドラッグして順番を入れ替えてください
            </p>
            {items.map((item, idx) => (
                <div
                    key={item}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => setDragIndex(null)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl select-none transition-opacity"
                    style={{
                        background: 'var(--background-secondary, #faf6f4)',
                        border: `1.5px solid ${dragIndex === idx ? 'rgba(216,120,152,0.6)' : 'rgba(216,120,152,0.18)'}`,
                        opacity: dragIndex === idx ? 0.5 : 1,
                        cursor: 'grab',
                    }}
                >
                    <span className="text-base" style={{ color: 'rgba(216,120,152,0.5)', lineHeight: 1 }}>☰</span>
                    <span
                        className="text-xs font-bold w-5 text-center flex-shrink-0"
                        style={{ color: '#D87898' }}
                    >
                        {idx + 1}
                    </span>
                    <span className="flex-1 text-sm" style={{ color: 'var(--foreground, #2a2a2a)' }}>
                        {item}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Completion Screen ───────────────────────────────────────

function CompletionScreen({ result, onStart }: { result: SetupResult; onStart: () => void }) {
    const personality = result.personality ?? {};
    const traits = Object.entries(personality).slice(0, 6);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
        >
            {/* ロゴ中央配置 */}
            <div className="flex justify-center">
                <CocoroLogo size={72} glow />
            </div>
            <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground, #2a2a2a)' }}>
                    セットアップ完了！
                </h2>
                <p className="text-sm" style={{ color: 'var(--foreground-muted, #888)' }}>
                    あなたの人格プロファイルが登録されました
                </p>
            </div>

            {result.summary && (
                <div
                    className="rounded-xl p-4 text-sm text-left"
                    style={{
                        background: 'rgba(216,120,152,0.08)',
                        border: '1px solid rgba(216,120,152,0.2)',
                        color: 'var(--foreground, #2a2a2a)',
                        lineHeight: 1.7,
                    }}
                >
                    {result.summary}
                </div>
            )}

            {/* 偶数件は2列、奇数/1件は1列にして空セルを防止 */}
            {traits.length > 0 && (
                <div className={`grid gap-2 ${traits.length % 2 === 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {traits.map(([key, val]) => (
                        <div
                            key={key}
                            className="rounded-lg px-3 py-2 text-left"
                            style={{ background: 'var(--background-secondary, #faf6f4)', border: '1px solid rgba(216,120,152,0.15)' }}
                        >
                            <div className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted, #888)' }}>{key}</div>
                            <div className="text-sm font-medium" style={{ color: 'var(--foreground, #2a2a2a)' }}>
                                {typeof val === 'number' ? `${Math.round((val as number) * 100)}%` : String(val)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={onStart}
                className="w-full py-3.5 rounded-xl font-medium text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #F0A8C0, #D87898)' }}
            >
                Cocoroとチャットを始める
            </button>
        </motion.div>
    );
}

// ─── Main Component ──────────────────────────────────────────

export default function SetupWizard({ onComplete }: Props) {
    const [phase, setPhase] = useState<'loading' | 'question' | 'completing' | 'done'>('loading');
    const [sessionId, setSessionId] = useState<string>('');
    const [question, setQuestion] = useState<SetupQuestion | null>(null);
    const [answer, setAnswer] = useState<string>('');
    const [rankItems, setRankItems] = useState<string[]>([]);
    const [originalItems, setOriginalItems] = useState<string[]>([]); // 質問文の【】に固定表示用
    const [history, setHistory] = useState<{ question: SetupQuestion; answer: string }[]>([]);
    const [error, setError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false); // 操作中の競合防止
    const [setupResult, setSetupResult] = useState<SetupResult>({});
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // question の最新値を常に同期的に保持する ref
    // setQuestion を呼ぶ全ての箇所で同時に更新する（useEffectでは遅すぎる）
    const questionRef = useRef<SetupQuestion | null>(null);
    // ラッパー: state と ref を同時に更新
    const setQuestionSync = (q: SetupQuestion | null) => {
        questionRef.current = q;
        setQuestion(q);
    };

    // open タイプ: textarea に自動フォーカス（autoFocus 属性と両方使用）
    useEffect(() => {
        if (question?.type === 'open') {
            const timer = setTimeout(() => textareaRef.current?.focus(), 300);
            return () => clearTimeout(timer);
        }
    }, [question?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // scale タイプ: 初期値を '5' に設定（handleNext の空チェックをパスするため）
    useEffect(() => {
        if (question?.type === 'scale') {
            setAnswer('5');
        }
    }, [question?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // ranking タイプ: rankItems と originalItems をリセット
    useEffect(() => {
        if (question?.type === 'ranking' || question?.type === 'order') {
            const initial = question.items ?? question.choices ?? [];
            setRankItems(initial);
            setOriginalItems(initial);
        }
    }, [question?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Start wizard
    useEffect(() => {
        async function start() {
            try {
                const res = await apiPost('/api/setup?action=start', { mode: 'boot' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.success && data.question) {
                    setSessionId(data.session_id);
                    setQuestionSync(data.question);
                    setPhase('question');
                } else if (data.success && data.data) {
                    setSessionId(data.data.session_id);
                    setQuestionSync(data.data.question);
                    setPhase('question');
                } else {
                    throw new Error(data.error || 'Setup start failed');
                }
            } catch (e) {
                setError(`セットアップの開始に失敗しました: ${(e as Error).message}`);
            }
        }
        start();
    }, []);

    // ─── 完了処理（result取得 → SQLite記録 → done画面）────────────
    const finishSetup = useCallback(async () => {
        console.log('[setup] finishSetup start, sessionId:', sessionId);
        setPhase('completing');
        try {
            const resultRes = await apiGet(`/api/setup?action=result&session_id=${sessionId}`);
            const resultData = await resultRes.json();
            console.log('[setup] result response:', resultData);
            const finalResult = resultData.personality ?? resultData.result ?? resultData.data ?? {};

            await apiPost('/api/setup?action=complete', {});
            console.log('[setup] complete OK, transitioning to done');
            setSetupResult(finalResult);
            setPhase('done');
        } catch (e) {
            console.error('[setup] finishSetup error:', e);
            // エラーでも done に遷移して onComplete できるようにする
            setSetupResult({});
            setPhase('done');
        }
    }, [sessionId]);

    // Submit answer — submitting フラグを冒頭で立てて連打を即ブロック
    const handleNext = useCallback(async () => {
        if (submitting) return;          // 処理中は即リターン
        setSubmitting(true);             // 先にフラグを立てる（連打防止）
        setError('');

        const currentQuestion = questionRef.current;
        if (!currentQuestion) { setSubmitting(false); return; }

        // ranking タイプは rankItems をカンマ区切りで使用
        const isRanking = currentQuestion.type === 'ranking' || currentQuestion.type === 'order';
        const effectiveAnswer = isRanking ? rankItems.join(',') : answer;

        // scale / ranking は常に有効な回答を持つのでスキップ
        const isScale = currentQuestion.type === 'scale';
        if (!isRanking && !isScale && !effectiveAnswer.trim()) { setSubmitting(false); return; }

        // 回答前に履歴へ追加（重複チェック）
        setHistory(prev => {
            if (prev[prev.length - 1]?.question.id === currentQuestion.id) return prev;
            return [...prev, { question: currentQuestion, answer: effectiveAnswer }];
        });

        try {
            console.log('[next] sending:', {
                question_id: currentQuestion.id,
                question_index: currentQuestion.index,
                answer: effectiveAnswer?.slice(0, 20),
            });
            const res = await apiPost('/api/setup?action=answer', {
                session_id: sessionId,
                question_id: currentQuestion.id,
                answer: effectiveAnswer.trim(),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            console.log('[setup] answer response: question_id=%s next=%s', currentQuestion.id, data.question?.id ?? data.data?.question?.id);
            if (!data.success) throw new Error(data.error || 'Answer failed');

            const completed = data.completed ?? data.data?.completed ?? false;
            const nextQuestion = data.question ?? data.data?.question;

            if (completed || (!nextQuestion && currentQuestion.index >= currentQuestion.total)) {
                await finishSetup();
            } else if (nextQuestion) {
                setQuestionSync(nextQuestion);
                setAnswer('');
            } else {
                console.warn('[setup] no nextQuestion and not completed, forcing finish');
                await finishSetup();
            }
        } catch (e) {
            setError(`回答の送信に失敗しました: ${(e as Error).message}`);
        } finally {
            setSubmitting(false);
        }
    }, [answer, rankItems, sessionId, submitting, finishSetup]);

    // 前の質問へ戻る — サーバーは一切呼ばず history からのみ復元（純クライアント動作）
    const handleBack = useCallback(() => {
        if (submitting || history.length === 0) return;
        const prev = history[history.length - 1];
        console.log('[back] restoring:', {
            question_id: prev.question.id,
            question_index: prev.question.index,
        });
        setHistory(h => h.slice(0, -1));
        questionRef.current = prev.question;  // ref を即時更新
        setQuestion(prev.question);
        setAnswer(prev.answer);
        setError('');
    }, [history, submitting]);


    // 1問だけスキップ（空回答）— submitting フラグを冒頭で立てて連打を即ブロック
    const handleSkip = useCallback(async () => {
        if (submitting) return;          // 処理中は即リターン
        setSubmitting(true);             // 先にフラグを立てる（連打防止）
        setError('');

        const currentQuestion = questionRef.current;
        if (!currentQuestion) { setSubmitting(false); return; }

        // スキップ前に履歴へ追加（重複チェック）
        setHistory(prev => {
            if (prev[prev.length - 1]?.question.id === currentQuestion.id) return prev;
            return [...prev, { question: currentQuestion, answer: '' }];
        });

        try {
            console.log('[skip] sending:', {
                question_id: currentQuestion.id,
                question_index: currentQuestion.index,
                question_text: currentQuestion.text?.slice(0, 20),
            });
            const res = await apiPost('/api/setup?action=answer', {
                session_id: sessionId,
                question_id: currentQuestion.id,
                answer: '',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            console.log('[setup] skip response: question_id=%s next=%s', currentQuestion.id, data.question?.id ?? data.data?.question?.id);
            const completed = data.completed ?? data.data?.completed ?? false;
            const nextQuestion = data.question ?? data.data?.question;
            if (completed || (!nextQuestion && currentQuestion.index >= currentQuestion.total)) {
                await finishSetup();
            } else if (nextQuestion) {
                setQuestionSync(nextQuestion);
                setAnswer('');
            } else {
                console.warn('[setup] skip: no nextQuestion, forcing finish');
                await finishSetup();
            }
        } catch (e) {
            console.error('[setup] skip error:', e);
            setError(`スキップに失敗しました: ${(e as Error).message}`);
        } finally {
            setSubmitting(false);
        }
    }, [sessionId, submitting, finishSetup]);

    // Handle Enter key for open questions
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) handleNext();
    }, [handleNext]);

    const isRankingQuestion = question?.type === 'ranking' || question?.type === 'order';
    const isScaleQuestion = question?.type === 'scale';
    // scale は常に次へ押せる（デフォルト値 5 が入っている）、ranking は items あれば OK
    const canProceed = isScaleQuestion
        ? true
        : isRankingQuestion
            ? rankItems.length > 0
            : !!answer.trim();

    // scale ラベル: left_label/right_label → なければ「XXX」vs「YYY」を正規表現でパース
    const scaleLabels = (() => {
        if (question?.left_label && question?.right_label) {
            return { left: question.left_label, right: question.right_label };
        }
        const match = question?.text.match(/「([^」]+)」\s*vs\s*「([^」]+)」/);
        return {
            left: match?.[1] ?? 'low',
            right: match?.[2] ?? 'high',
        };
    })();
    const icon = question ? (CATEGORY_ICONS[question.category] ?? CATEGORY_ICONS.default) : '🌸';

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'var(--background, #fff)' }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl p-8 shadow-xl"
                style={{
                    background: 'var(--background, #fff)',
                    border: '1px solid rgba(216,120,152,0.15)',
                    boxShadow: '0 24px 60px rgba(216,120,152,0.10)',
                }}
            >
                {/* Loading */}
                {phase === 'loading' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <CocoroLogo size={56} glow />
                        <p className="text-sm" style={{ color: 'var(--foreground-muted, #888)' }}>
                            {error || 'セットアップを準備しています...'}
                        </p>
                        {error && (
                            <button
                                onClick={onComplete}
                                className="mt-2 text-xs px-4 py-2 rounded-lg"
                                style={{ color: '#c06080', border: '1px solid rgba(216,120,152,0.3)' }}
                            >
                                スキップ
                            </button>
                        )}
                    </div>
                )}

                {/* Completing */}
                {phase === 'completing' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <CocoroLogo size={56} glow />
                        <p className="text-sm" style={{ color: 'var(--foreground-muted, #888)' }}>
                            人格プロファイルを生成しています...
                        </p>
                    </div>
                )}

                {/* Done */}
                {phase === 'done' && (
                    <CompletionScreen result={setupResult} onStart={onComplete} />
                )}

                {/* Question */}
                {phase === 'question' && question && (
                    <div className="space-y-6" onKeyDown={handleKeyDown}>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <CocoroLogo size={32} />
                            {question.category_label && (
                                <span
                                    className="text-xs px-3 py-1 rounded-full"
                                    style={{ background: 'rgba(216,120,152,0.10)', color: '#c06080' }}
                                >
                                    {icon} {question.category_label}
                                </span>
                            )}
                        </div>

                        {/* Progress */}
                        <ProgressBar current={question.index} total={question.total} />

                        {/* Question text */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={question.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-4"
                            >
                                {/* ranking は質問文を ": " で分割してメインテキストと順位リストを別行表示 */}
                                {(question.type === 'ranking' || question.type === 'order') ? (
                                    <div className="space-y-2">
                                        <h3
                                            className="text-base font-medium leading-relaxed"
                                            style={{ color: 'var(--foreground, #2a2a2a)' }}
                                        >
                                            {question.text.split(': ')[0]}
                                        </h3>
                                        {rankItems.length > 0 && (
                                            <p className="text-sm" style={{ color: 'var(--foreground-muted, #888)' }}>
                                                【{originalItems.join(', ')}】
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <h3
                                        className="text-base font-medium leading-relaxed"
                                        style={{ color: 'var(--foreground, #2a2a2a)' }}
                                    >
                                        {question.text}
                                    </h3>
                                )}

                                {/* Input */}
                                {question.type === 'open' && (
                                    <OpenInput value={answer} onChange={setAnswer} textareaRef={textareaRef} autoFocus={true} />
                                )}
                                {question.type === 'choice' && (() => {
                                    const choices = question.choices ?? question.options ?? [];
                                    return choices.length > 0 ? (
                                        <ChoiceInput
                                            choices={choices}
                                            value={answer}
                                            onChange={setAnswer}
                                        />
                                    ) : null;
                                })()}
                                {question.type === 'scale' && (
                                    <ScaleInput
                                        value={answer || '5'}
                                        onChange={setAnswer}
                                        leftLabel={scaleLabels.left}
                                        rightLabel={scaleLabels.right}
                                    />
                                )}
                                {(question.type === 'ranking' || question.type === 'order') && (
                                    <RankingInput
                                        items={rankItems}
                                        onOrderChange={setRankItems}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Error */}
                        {error && (
                            <p className="text-xs" style={{ color: '#e05070' }}>{error}</p>
                        )}

                        {/* Actions: [← 戻る] [次へ →] [スキップ] */}
                        <div className="flex gap-2 pt-1">
                            {/* 戻るボタン: 1問目（履歴なし）は 視覚的に非表示（レイアウト維持） */}
                            <button
                                onClick={handleBack}
                                disabled={submitting || history.length === 0}
                                className="px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
                                style={{
                                    color: 'var(--foreground-muted, #888)',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    opacity: history.length === 0 ? 0 : 1,
                                    pointerEvents: history.length === 0 ? 'none' : 'auto',
                                }}
                            >
                                ← 戻る
                            </button>
                            <button
                                onClick={handleNext}
                                disabled={!canProceed || submitting}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #F0A8C0, #D87898)' }}
                            >
                                {submitting ? '送信中...' : question.index === question.total ? '完了' : '次へ →'}
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={submitting}
                                className="px-3 py-2.5 rounded-xl text-xs transition-colors"
                                style={{ color: 'var(--foreground-muted, #999)', border: '1px solid rgba(0,0,0,0.06)' }}
                            >
                                スキップ
                            </button>
                        </div>

                        {question.type === 'open' && (
                            <p className="text-center text-xs" style={{ color: 'var(--foreground-muted, #999)', opacity: 0.6 }}>
                                Ctrl + Enter でも送信できます
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
