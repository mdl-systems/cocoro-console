'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Globe, Palette, Save, Loader2 } from 'lucide-react';
import { apiPut } from '@/lib/api-client';

interface Profile {
    name: string;
    nickname: string;
    interests: string[];
    ai_preferences: { personality: string; language: string; formality: string };
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/profile').then(r => r.json()).then(d => { setProfile(d); setLoading(false); });
    }, []);

    async function saveProfile() {
        if (!profile) return;
        setSaving(true);
        await apiPut('/api/profile', profile as unknown as Record<string, unknown>);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    if (loading || !profile) {
        return <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} /></div>;
    }

    return (
        <div className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>設定</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>プロフィールとAI設定</p>
                </div>
                <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saved ? '保存完了 ✓' : '保存'}
                </button>
            </div>

            <div className="p-8 space-y-6 max-w-2xl">
                {/* Profile */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <User size={16} style={{ color: 'var(--accent-primary-light)' }} /> プロフィール
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>名前</label>
                            <input className="input-field" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>ニックネーム</label>
                            <input className="input-field" value={profile.nickname} onChange={e => setProfile({ ...profile, nickname: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>興味・関心（カンマ区切り）</label>
                            <input className="input-field" value={profile.interests.join(', ')} onChange={e => setProfile({ ...profile, interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                        </div>
                    </div>
                </motion.div>

                {/* AI Preferences */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        <Palette size={16} style={{ color: 'var(--accent-secondary)' }} /> AI性格設定
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>性格タイプ</label>
                            <select className="input-field" value={profile.ai_preferences.personality} onChange={e => setProfile({ ...profile, ai_preferences: { ...profile.ai_preferences, personality: e.target.value } })}>
                                <option value="friendly">フレンドリー</option>
                                <option value="professional">プロフェッショナル</option>
                                <option value="creative">クリエイティブ</option>
                                <option value="analytical">アナリティカル</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>言語</label>
                            <select className="input-field" value={profile.ai_preferences.language} onChange={e => setProfile({ ...profile, ai_preferences: { ...profile.ai_preferences, language: e.target.value } })}>
                                <option value="ja">日本語</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs block mb-1.5" style={{ color: 'var(--foreground-muted)' }}>口調</label>
                            <select className="input-field" value={profile.ai_preferences.formality} onChange={e => setProfile({ ...profile, ai_preferences: { ...profile.ai_preferences, formality: e.target.value } })}>
                                <option value="casual">カジュアル</option>
                                <option value="polite">丁寧</option>
                                <option value="formal">フォーマル</option>
                            </select>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
