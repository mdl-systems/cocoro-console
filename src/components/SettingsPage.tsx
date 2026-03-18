'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, User, Globe, Palette, Bell, Shield, Database,
    Save, Loader2, Sun, Moon, Monitor, Check, Download, Trash2, AlertTriangle,
    Bot, Copy, Upload, Sparkles,
} from 'lucide-react';
import { apiPut } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────
interface Profile {
    name: string;
    nickname: string;
    ai_nickname: string;
    interests: string[];
    ai_preferences: { personality: string; language: string; formality: string };
}

type Theme = 'light' | 'dark' | 'system';
type Lang = 'ja' | 'en' | 'zh';

interface AppSettings {
    theme: Theme;
    language: Lang;
    notifications: {
        desktop: boolean;
        email: boolean;
        daily_briefing: boolean;
        sound: boolean;
    };
    privacy: {
        save_history: boolean;
        emotion_analysis: boolean;
        memory_system: boolean;
    };
}

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    language: 'ja',
    notifications: { desktop: true, email: false, daily_briefing: true, sound: false },
    privacy: { save_history: true, emotion_analysis: true, memory_system: true },
};

// ─── Theme helpers ────────────────────────────────────────────
function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
}

// ─── Sub-components ───────────────────────────────────────────
function SectionCard({ delay = 0, icon, title, children }: {
    delay?: number; icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="glass-panel p-6"
        >
            <h3 className="text-sm font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                {icon} {title}
            </h3>
            {children}
        </motion.div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className="relative w-10 h-5.5 rounded-full flex-shrink-0 transition-all duration-200"
            style={{
                background: checked ? 'var(--accent-primary)' : 'var(--border)',
                height: '22px',
            }}
        >
            <span
                className="absolute inset-y-0 flex items-center transition-all duration-200"
                style={{ left: checked ? 'calc(100% - 18px)' : '2px' }}
            >
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
        </button>
    );
}

function ToggleRow({ label, sub, checked, onChange }: {
    label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-2.5"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</p>
                {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{sub}</p>}
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    );
}

function DangerButton({
    icon, label, description, onClick, loading, confirmLabel,
}: {
    icon: React.ReactNode; label: string; description: string;
    onClick: () => void; loading?: boolean; confirmLabel?: string;
}) {
    const [confirm, setConfirm] = useState(false);
    function handle() {
        if (confirmLabel && !confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        onClick(); setConfirm(false);
    }
    return (
        <div className="flex items-center justify-between py-3"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{description}</p>
            </div>
            <button
                onClick={handle}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                    background: confirm ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)',
                    border: `1px solid ${confirm ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.2)'}`,
                    color: '#ef4444',
                }}
            >
                {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
                {confirm ? (confirmLabel ?? label) : label}
            </button>
        </div>
    );
}

// ─── Personality Prompt Section ───────────────────────────────
function PersonalitySection({ profile }: { profile: Profile | null }) {
    const [outputMode, setOutputMode] = useState<'chatgpt' | 'gemini' | 'claude' | 'generic' | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);
    const [importDone, setImportDone] = useState(false);

    const FORMAT_MAP = {
        chatgpt: { label: 'ChatGPT用', prefix: '# カスタム指示（ChatGPT）\n\n' },
        gemini:  { label: 'Gemini用',  prefix: '# システムプロンプト（Gemini）\n\n' },
        claude:  { label: 'Claude用',  prefix: '<system>\n' },
        generic: { label: '汎用',       prefix: '# AIアシスタント設定\n\n' },
    } as const;

    async function generatePrompt(mode: typeof outputMode) {
        if (!mode) return;
        setOutputMode(mode);
        setGenerating(true);
        setGeneratedPrompt('');
        try {
            const res = await fetch('/api/memory');
            const data = await res.json();
            const memories = Array.isArray(data.memories ?? data.data?.memories) ? (data.memories ?? data.data?.memories) : [];
            const name = profile?.nickname || profile?.name || 'ユーザー';
            const personality = profile?.ai_preferences?.personality || 'friendly';
            const formality = profile?.ai_preferences?.formality || 'polite';
            const interests = profile?.interests?.join('、') || '';
            const fmt = FORMAT_MAP[mode];
            const memStr = memories.slice(0, 10).map((m: { content?: string }) => `- ${m.content ?? ''}`).join('\n');

            const prompt = `${fmt.prefix}あなたは ${name} さんのパーソナルAIアシスタントです。

【性格・スタイル】
性格タイプ: ${personality}
口調: ${formality}

【${name} さんの情報】
興味・関心: ${interests || '（未設定）'}

【学習した記憶・習慣】
${memStr || '（まだ記憶がありません）'}

【行動指針】
- ${name} さんのことを深く理解し、最適なサポートを提供してください
- 過去の会話から学んだ好みや習慣を積極的に活かしてください
- 専門用語は避け、わかりやすい言葉で説明してください${mode === 'claude' ? '\n</system>' : ''}`;

            setGeneratedPrompt(prompt);
        } catch {
            setGeneratedPrompt('プロンプトの生成に失敗しました。');
        }
        setGenerating(false);
    }

    async function copyPrompt() {
        await navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function importPrompt() {
        if (!importText.trim()) return;
        setImporting(true);
        setImportDone(false);
        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `以下は私の人格・価値観・思考パターンです。これを学習してあなたの人格に反映してください：\n${importText}`,
                    system_hint: 'personality_import',
                    conversation_id: null,
                }),
            });
            setImportDone(true);
            setImportText('');
            setTimeout(() => setImportDone(false), 4000);
        } catch { /* ignore */ }
        setImporting(false);
    }

    return (
        <div className="space-y-6">
            {/* Output */}
            <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    人格プロンプト出力
                </p>
                <p className="text-[11px] mb-3" style={{ color: 'var(--foreground-muted)' }}>
                    あなたの人格をプロンプトとして出力します。他のAIサービスにコピーしてご利用ください。
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    {(Object.keys(FORMAT_MAP) as Array<keyof typeof FORMAT_MAP>).map(k => (
                        <button key={k}
                            onClick={() => generatePrompt(k)}
                            disabled={generating}
                            className="text-xs py-2 px-3 rounded-lg transition-all font-medium"
                            style={{
                                background: outputMode === k ? 'rgba(216,120,152,0.12)' : 'var(--background-secondary)',
                                border: `1px solid ${outputMode === k ? 'var(--accent-primary)' : 'var(--border)'}`,
                                color: outputMode === k ? 'var(--accent-primary)' : 'var(--foreground-muted)',
                            }}>
                            {FORMAT_MAP[k].label}
                        </button>
                    ))}
                </div>
                {generatedPrompt && (
                    <div className="relative">
                        <textarea
                            readOnly
                            value={generatedPrompt}
                            rows={8}
                            className="input-field font-mono text-[11px] resize-none w-full"
                            style={{ lineHeight: 1.6 }}
                        />
                        <button onClick={copyPrompt}
                            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all"
                            style={{
                                background: copied ? 'rgba(52,211,153,0.15)' : 'var(--background)',
                                border: '1px solid var(--border)',
                                color: copied ? '#34d399' : 'var(--foreground-muted)',
                            }}>
                            {copied ? <Check size={10} /> : <Copy size={10} />}
                            {copied ? 'コピー済み' : 'コピー'}
                        </button>
                    </div>
                )}
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Import */}
            <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    人格プロンプト取り込み
                </p>
                <p className="text-[11px] mb-3" style={{ color: 'var(--foreground-muted)' }}>
                    他のAIサービスで使っていたプロンプトを取り込むと、AIとの絆をすぐに高めることができます。
                </p>
                <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    rows={5}
                    placeholder="ここにプロンプトを貼り付けてください..."
                    className="input-field text-xs resize-none w-full mb-3"
                    style={{ lineHeight: 1.6 }}
                />
                {importDone && (
                    <div className="flex items-center gap-2 text-xs mb-2 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
                        <Sparkles size={12} />
                        AIとの絆が向上しました！
                    </div>
                )}
                <button
                    onClick={importPrompt}
                    disabled={importing || !importText.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                        background: importing || !importText.trim() ? 'var(--background-secondary)' : 'var(--accent-primary)',
                        color: importing || !importText.trim() ? 'var(--foreground-muted)' : '#fff',
                        border: '1px solid var(--border)',
                        opacity: !importText.trim() ? 0.5 : 1,
                    }}>
                    {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {importing ? '取り込み中...' : 'プロンプトを取り込む'}
                </button>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Load stored settings from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('cocoro_settings');
            if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch { /* ignore */ }
    }, []);

    // Load profile
    useEffect(() => {
        fetch('/api/profile')
            .then(r => r.json())
            .then(d => { setProfile({ ai_nickname: '', ...d }); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Apply theme whenever it changes
    useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);

    const patchSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...patch } as AppSettings;
            localStorage.setItem('cocoro_settings', JSON.stringify(next));
            return next;
        });
    }, []);

    async function save() {
        if (!profile) return;
        setSaving(true);
        try {
            await apiPut('/api/profile', profile as unknown as Record<string, unknown>);
            // ai_nicknamをlocalStorageにも保存（ChatPageから参照）
            if (profile.ai_nickname) {
                localStorage.setItem('cocoro_ai_nickname', profile.ai_nickname);
            }
            await fetch('/api/settings/language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: settings.language }),
            });
        } catch { /* ignore */ }
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    async function exportHistory() {
        setExporting(true);
        try {
            const res = await fetch('/api/chat?list=1');
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `cocoro-history-${new Date().toISOString().slice(0, 10)}.json`;
            a.click(); URL.revokeObjectURL(url);
        } catch { /* ignore */ }
        setExporting(false);
    }

    async function resetMemory() {
        try { await fetch('/api/memory', { method: 'DELETE' }); } catch { /* ignore */ }
    }

    async function deleteAll() {
        setDeleting(true);
        try {
            await fetch('/api/memory', { method: 'DELETE' });
            await fetch('/api/chat', { method: 'DELETE' });
        } catch { /* ignore */ }
        setDeleting(false);
        setTimeout(() => window.location.reload(), 500);
    }

    if (loading) {
        return <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} /></div>;
    }

    const THEMES: { id: Theme; icon: React.ReactNode; label: string }[] = [
        { id: 'light',  icon: <Sun size={14} />,     label: 'ライト' },
        { id: 'dark',   icon: <Moon size={14} />,    label: 'ダーク' },
        { id: 'system', icon: <Monitor size={14} />, label: 'システム' },
    ];
    const LANGS: { id: Lang; flag: string; label: string }[] = [
        { id: 'ja', flag: '🇯🇵', label: '日本語' },
        { id: 'en', flag: '🇺🇸', label: 'English' },
        { id: 'zh', flag: '🇨🇳', label: '中文' },
    ];

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>設定</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>プロフィール・テーマ・プライバシー設定</p>
                </div>
                <button onClick={save} disabled={saving}
                    className="btn-primary text-sm flex items-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saved ? '保存完了 ✓' : '保存'}
                </button>
            </div>

            <div className="p-8 space-y-6 max-w-2xl">
                {/* ── Profile ───────────────────────────────── */}
                <SectionCard icon={<User size={15} style={{ color: 'var(--accent-primary)' }} />} title="プロフィール">
                    {profile && (
                        <div className="space-y-4">
                            {[
                                { lbl: '名前', key: 'name' as const },
                                { lbl: 'ニックネーム', key: 'nickname' as const },
                            ].map(({ lbl, key }) => (
                                <div key={key}>
                                    <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>{lbl}</label>
                                    <input className="input-field" value={profile[key]}
                                        onChange={e => setProfile({ ...profile, [key]: e.target.value })} />
                                </div>
                            ))}
                            <div>
                                <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>興味・関心（カンマ区切り）</label>
                                <input className="input-field"
                                    value={profile.interests.join(', ')}
                                    onChange={e => setProfile({ ...profile, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* ── AI Nickname ────────────────────────────── */}
                <SectionCard delay={0.04} icon={<Bot size={15} style={{ color: 'var(--accent-primary)' }} />} title="AIのニックネーム">
                    {profile && (
                        <div>
                            <p className="text-[11px] mb-3" style={{ color: 'var(--foreground-muted)' }}>
                                チャット画面でのAIの呼び名を設定します。未設定の場合はデフォルト名が使われます。
                            </p>
                            <div>
                                <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>
                                    AIのニックネーム
                                </label>
                                <input
                                    className="input-field"
                                    placeholder={`${profile.nickname || 'ユーザー'}のAI`}
                                    value={profile.ai_nickname ?? ''}
                                    onChange={e => setProfile({ ...profile, ai_nickname: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* ── Language ──────────────────────────────── */}
                <SectionCard delay={0.05} icon={<Globe size={15} style={{ color: '#3b82f6' }} />} title="言語設定">
                    <div className="grid grid-cols-3 gap-2">
                        {LANGS.map(({ id, flag, label }) => (
                            <button key={id} onClick={() => patchSettings({ language: id })}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all text-sm"
                                style={{
                                    background: settings.language === id ? 'rgba(59,130,246,0.1)' : 'var(--background-secondary)',
                                    border: `1px solid ${settings.language === id ? '#3b82f6' : 'var(--border)'}`,
                                    color: settings.language === id ? '#3b82f6' : 'var(--foreground-muted)',
                                }}>
                                <span className="text-xl">{flag}</span>
                                <span className="text-xs font-medium">{label}</span>
                                {settings.language === id && <Check size={10} />}
                            </button>
                        ))}
                    </div>
                </SectionCard>

                {/* ── Theme ─────────────────────────────────── */}
                <SectionCard delay={0.1} icon={<Palette size={15} style={{ color: '#a78bfa' }} />} title="テーマ設定">
                    <div className="grid grid-cols-3 gap-2">
                        {THEMES.map(({ id, icon, label }) => (
                            <button key={id} onClick={() => patchSettings({ theme: id })}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
                                style={{
                                    background: settings.theme === id ? 'rgba(167,139,250,0.1)' : 'var(--background-secondary)',
                                    border: `1px solid ${settings.theme === id ? '#a78bfa' : 'var(--border)'}`,
                                    color: settings.theme === id ? '#a78bfa' : 'var(--foreground-muted)',
                                }}>
                                {icon}
                                <span className="text-xs font-medium">{label}</span>
                                {settings.theme === id && <Check size={10} />}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] mt-3" style={{ color: 'var(--foreground-muted)', opacity: 0.6 }}>
                        ダークモードは背景 #0a0a0a・カード #1a1a1a・ピンクアクセントを使用
                    </p>
                </SectionCard>

                {/* ── AI Preferences ────────────────────────── */}
                <SectionCard delay={0.12} icon={<Settings size={15} style={{ color: 'var(--accent-primary)' }} />} title="AI 性格設定">
                    {profile && (
                        <div className="space-y-4">
                            {[
                                {
                                    lbl: '性格タイプ', key: 'personality' as const,
                                    opts: [['friendly', 'フレンドリー'], ['professional', 'プロフェッショナル'], ['creative', 'クリエイティブ'], ['analytical', 'アナリティカル']],
                                },
                                {
                                    lbl: '口調', key: 'formality' as const,
                                    opts: [['casual', 'カジュアル'], ['polite', '丁寧'], ['formal', 'フォーマル']],
                                },
                            ].map(({ lbl, key, opts }) => (
                                <div key={key}>
                                    <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>{lbl}</label>
                                    <select className="input-field"
                                        value={profile.ai_preferences[key]}
                                        onChange={e => setProfile({ ...profile, ai_preferences: { ...profile.ai_preferences, [key]: e.target.value } })}>
                                        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* ── Notifications ─────────────────────────── */}
                <SectionCard delay={0.15} icon={<Bell size={15} style={{ color: '#f59e0b' }} />} title="通知設定">
                    <div>
                        <ToggleRow label="デスクトップ通知" sub="OS のネイティブ通知を使用"
                            checked={settings.notifications.desktop}
                            onChange={v => patchSettings({ notifications: { ...settings.notifications, desktop: v } })} />
                        <ToggleRow label="メール通知" sub="重要なイベントをメールでお知らせ"
                            checked={settings.notifications.email}
                            onChange={v => patchSettings({ notifications: { ...settings.notifications, email: v } })} />
                        <ToggleRow label="デイリーブリーフィング" sub="毎朝 6〜11 時に今日の概要を表示"
                            checked={settings.notifications.daily_briefing}
                            onChange={v => patchSettings({ notifications: { ...settings.notifications, daily_briefing: v } })} />
                        <ToggleRow label="通知音" sub="タスク完了時にサウンドを再生"
                            checked={settings.notifications.sound}
                            onChange={v => patchSettings({ notifications: { ...settings.notifications, sound: v } })} />
                    </div>
                </SectionCard>

                {/* ── Privacy ───────────────────────────────── */}
                <SectionCard delay={0.18} icon={<Shield size={15} style={{ color: '#34d399' }} />} title="プライバシー設定">
                    <div>
                        <ToggleRow label="会話履歴の保存" sub="チャット履歴をローカルに保存"
                            checked={settings.privacy.save_history}
                            onChange={v => patchSettings({ privacy: { ...settings.privacy, save_history: v } })} />
                        <ToggleRow label="感情分析" sub="会話中のAI感情状態を追跡"
                            checked={settings.privacy.emotion_analysis}
                            onChange={v => patchSettings({ privacy: { ...settings.privacy, emotion_analysis: v } })} />
                        <ToggleRow label="記憶システム" sub="長期記憶・学習機能を有効化"
                            checked={settings.privacy.memory_system}
                            onChange={v => patchSettings({ privacy: { ...settings.privacy, memory_system: v } })} />
                    </div>
                </SectionCard>

                {/* ── Data Management ───────────────────────── */}
                <SectionCard delay={0.2} icon={<Database size={15} style={{ color: '#f87171' }} />} title="データ管理">
                    <div>
                        <DangerButton
                            icon={<Download size={12} />}
                            label="会話履歴をエクスポート"
                            description="すべての会話履歴を JSON ファイルでダウンロード"
                            loading={exporting}
                            onClick={exportHistory}
                        />
                        <DangerButton
                            icon={<Trash2 size={12} />}
                            label="記憶をリセット"
                            description="AIの長期記憶をすべて削除します（会話は残ります）"
                            confirmLabel="本当にリセットする"
                            onClick={resetMemory}
                        />
                        <DangerButton
                            icon={loading ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                            label="全データを削除"
                            description="記憶・会話履歴・設定をすべて削除します。この操作は取り消せません"
                            confirmLabel="全削除を確認"
                            loading={deleting}
                            onClick={deleteAll}
                        />
                    </div>

                    {/* Personality prompts */}
                    <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Bot size={14} style={{ color: 'var(--accent-primary)' }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>人格プロンプト</span>
                        </div>
                        <PersonalitySection profile={profile} />
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}
