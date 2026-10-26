import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Compass, BookOpen, Shapes, Gift, Settings, ArrowUpRight, ArrowRight, Sprout, Volume2, Check, ShieldCheck, RotateCcw } from 'lucide-react';
import { AppContext, errorMessage, type Tab, type GameRoute } from './context';
import { type AppData, type Session } from './domain/state';
import { newMoleGame, newMathGame } from './domain/learning';
import { loadData, saveData } from './services/storage';
import { speak, stopVoice, voiceStatus, type VoiceStatus } from './services/voice';
import { LiteracyArt, MathArt, GiftArt } from './components/Art';
import { PageHeading } from './components/UI';
import LiteracyPage from './pages/Literacy';
import MathPage from './pages/Math';
import MallPage from './pages/Mall';
import SettingsPage from './pages/Settings';
import { LiteracyGame, ArithmeticGame } from './pages/Games';
const tabs = [{ id: 'home', label: '探索乐园', icon: Compass }, { id: 'literacy', label: '汉字森林', icon: BookOpen }, { id: 'math', label: '数字小镇', icon: Shapes }, { id: 'mall', label: '心愿商城', icon: Gift }, { id: 'settings', label: '家长设置', icon: Settings }] as const;
export default function App() {
  const [data, setData] = useState<AppData | null>(null), current = useRef<AppData | null>(null);
  const [loadError, setLoadError] = useState(''), [tab, setTab] = useState<Tab>('home');
  const [speechState, setSpeechState] = useState<VoiceStatus | null>(null);
  const [game, setGame] = useState<GameRoute | null>(null), [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), queue = useRef(Promise.resolve());
  async function load() { try { const saved = await loadData(); current.current = saved; setData(saved); setLoadError(''); } catch { setLoadError('设备数据暂时无法读取。请检查存储空间后重试，原数据不会被覆盖。'); } }
  useEffect(() => { void load(); return () => { clearTimeout(toastTimer.current); void stopVoice().catch(() => {}); }; }, []);
  useEffect(() => {
    let mounted = true; let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() { try { const status = await voiceStatus(); if (mounted) { setSpeechState(status); if (status.loading) timer = setTimeout(refresh, 1000); } } catch { if (mounted) setSpeechState({ tts: false, recognition: false, message: '语音状态读取失败，请重新打开 App。' }); } }
    void refresh(); return () => { mounted = false; clearTimeout(timer); };
  }, []);
  function notify(message: string) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 5200); }
  async function commit(change: (value: AppData) => AppData) {
    const task = queue.current.then(async () => {
      if (!current.current) throw Error('数据尚未加载');
      const next = change(structuredClone(current.current));
      try { await saveData(next); } catch (e) { if (e instanceof DOMException) throw Error('保存失败，请检查设备存储空间；原数据已保留'); throw e; }
      current.current = next; setData(next);
    });
    queue.current = task.catch(() => {}); return task;
  }
  function navigate(next: Tab) { void stopVoice().catch(() => {}); setGame(null); setTab(next); window.scrollTo(0,0); }
  function start(kind: GameRoute['kind']) {
    if (!data) return;
    if (Capacitor.isNativePlatform() && data.voice.autoRead && (!speechState || speechState.loading)) { notify('正在准备内置中文语音，请稍候再开始。'); return; }
    try { if (kind === 'literacy') newMoleGame(data.library); else newMathGame(data.math, kind); setGame({ kind, id: crypto.randomUUID() }); window.scrollTo(0,0); }
    catch (e) { notify(errorMessage(e)); }
  }
  function read(text: string, automatic = false) {
    if (automatic && !current.current?.voice.autoRead) return;
    void speak(text, current.current?.voice.rate).catch(e => notify(errorMessage(e)));
  }
  function finish(session: Session) { void commit(d => ({ ...d, history: d.history.some(s => s.id === session.id) ? d.history : [session, ...d.history].slice(0,500) })).catch(e => notify(errorMessage(e))); }
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = NativeApp.addListener('backButton', () => {
      if (document.querySelector('dialog[open]')) { document.querySelector('dialog[open]')?.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      if (game) { window.dispatchEvent(new Event('game-back')); return; }
      if (tab !== 'home') navigate('home'); else void NativeApp.minimizeApp();
    });
    return () => { void handle.then(h => h.remove()); };
  }, [game, tab]);
  if (!data) return <div className="loading-screen"><div className="brand-mark"><Sprout/></div><h1>小小探索家</h1><p>{loadError || '准备好，一起发现新世界…'}</p>{loadError && <button className="button" onClick={() => void load()}><RotateCcw size={18}/>重新读取</button>}</div>;
  return <AppContext.Provider value={{ data, commit, notify, navigate, start, read, finish }}><div className={`app-shell ${game ? 'in-game' : ''}`}>
    <aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); if (game) window.dispatchEvent(new Event('game-back')); else navigate('home'); }}><span className="brand-mark"><Sprout size={25}/></span><div><strong>小小探索家</strong><small>LITTLE EXPLORER</small></div></a><p className="sidebar-label">每一小步，都是成长</p><nav aria-label="主导航">{tabs.map(t => <button key={t.id} disabled={!!game} className={tab === t.id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(t.id)}><t.icon size={21}/><span>{t.label}</span>{tab === t.id && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-note"><Sprout size={24}/><strong>慢慢来，也很棒。</strong><p>每一次好奇，<br/>都值得被认真回应。</p><span>一起探索，一起长大</span></div><div className="local-label"><ShieldCheck size={15}/>学习数据保存在本机</div></aside>
    <div className="main-shell"><div className="topbar"><div className="mobile-brand"><span className="brand-mark"><Sprout size={20}/></span><strong>小小探索家</strong></div><span className="desktop-crumb">成长的每一天 <span>/</span> {tabs.find(t => t.id === tab)?.label}</span><button className="voice-status" disabled={!!game} onClick={() => navigate('settings')}><Volume2 size={16}/><span>{speechState?.loading ? '语音正在准备' : data.voice.autoRead ? speechState?.engine === 'offline' ? speechState.tts ? '离线语音已开启' : '语音暂不可用' : '语音陪伴已开启' : '点击开启语音陪伴'}</span><span className={data.voice.autoRead ? 'status-dot' : ''}/></button></div>
    <main>{game ? game.kind === 'literacy' ? <LiteracyGame key={game.id} id={game.id}/> : <ArithmeticGame key={game.id} id={game.id} mode={game.kind}/> : tab === 'home' ? <Home data={data} navigate={navigate} start={start}/> : tab === 'literacy' ? <LiteracyPage/> : tab === 'math' ? <MathPage/> : tab === 'mall' ? <MallPage/> : <SettingsPage/>}</main>
    {!game && <footer className="page-footer"><Sprout size={15}/>把好奇留给孩子，把陪伴留给自己。</footer>}</div>
    {!game && <nav className="bottom-nav" aria-label="手机导航">{tabs.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => navigate(t.id)}><t.icon size={21}/><span>{t.label.replace('家长设置','家长')}</span></button>)}</nav>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div></AppContext.Provider>;
}
function Home({ data, navigate, start }: { data: AppData; navigate(tab: Tab): void; start(kind: GameRoute['kind']): void }) {
  const today = new Date().toDateString(), sessions = data.history.filter(s => new Date(s.at).toDateString() === today);
  const enabled = data.library.words.filter(w => w.enabled).length;
  return <div className="home-page"><PageHeading eyebrow="HELLO, LITTLE EXPLORER" title="今天，又会发现什么呢？" description="认一个新字，数一辆小车。快乐成长，从小小的探索开始。" action={<div className="date-pill"><span>每一天</span><strong>都值得期待 <Sprout size={17}/></strong></div>}/>
    <div className="section-heading explore-heading"><h2>开启今天的探索 <span className="heading-dot"/></h2><span className="muted small">小小世界，大大好奇</span></div>
    <div className="explore-grid"><section className="explore-card literacy-card"><div className="card-copy"><span className="tag"><BookOpen size={14}/>识字 · 敲地鼠</span><h2>汉字森林</h2><p>听一听，找一找，<br/>和小地鼠成为汉字好朋友。</p><button className="button" onClick={() => start('literacy')}>出发，去认字 <ArrowRight size={18}/></button><span className="card-meta">已选 {enabled} 个汉字 · 每字 {data.library.seconds} 秒</span></div><LiteracyArt/><button className="card-link" aria-label="查看汉字森林" onClick={() => navigate('literacy')}><ArrowUpRight size={22}/></button></section>
    <section className="explore-card math-card"><div className="card-copy"><span className="tag"><Shapes size={14}/>认数 · 加减法</span><h2>数字小镇</h2><p>小汽车准备出发，<br/>一起数数路上的新发现。</p><button className="button warm" onClick={() => navigate('math')}>出发，去数数 <ArrowRight size={18}/></button><span className="card-meta">{data.math.numbers.length} 个数字 · 每轮 {data.math.rounds} 题</span></div><MathArt/><button className="card-link" aria-label="查看数字小镇" onClick={() => navigate('math')}><ArrowUpRight size={22}/></button></section></div>
    <section className="wish-banner"><div className="wish-art"><GiftArt/></div><div><span className="eyebrow">A LITTLE WISH</span><h2>把小小心愿，装进口袋</h2><p>和爸爸妈妈一起，挑选下一份期待。</p></div><button className="button secondary" onClick={() => navigate('mall')}>逛逛心愿商城 <ArrowRight size={17}/></button></section>
    <div className="home-bottom"><section className="progress-card"><div className="section-heading"><h2>成长的小脚印</h2><span className="tag neutral">今天</span></div><div className="stats"><div><strong>{sessions.length}<small>轮</small></strong><span>完成探索</span></div><div><strong>{sessions.filter(s => s.kind === 'literacy').length}<small>轮</small></strong><span>汉字练习</span></div><div><strong>{sessions.filter(s => s.kind !== 'literacy').length}<small>轮</small></strong><span>数学练习</span></div></div><p className="small muted">{sessions.length ? '每一步都算数，为今天的努力鼓鼓掌。' : '还没有今天的脚印，一起出发吧。'}</p></section><section className="parent-card"><div className="parent-icon"><Settings size={24}/></div><div><h3>给爸爸妈妈的小入口</h3><p>调整学习内容、语音和练习节奏，<br/>找到适合孩子的那一步。</p><button className="text-button" onClick={() => navigate('settings')}>家长设置 <ArrowRight size={16}/></button></div></section></div>
  </div>;
}
