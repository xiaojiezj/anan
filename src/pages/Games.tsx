import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Pause, Play, RotateCcw, Star, Flag, Volume2 } from 'lucide-react';
import { useApp, errorMessage } from '../context';
import { newMoleGame, advanceGame, hitMole, pauseGame, resumeGame, newMathGame, answerMath, countVehicle, nextMath, VEHICLES, type MathGame } from '../domain/learning';
import { matchWordSpeech, parseNumberSpeech } from '../domain/state';
import { listen, stopVoice } from '../services/voice';
import { Back, Modal, VoiceButtons } from '../components/UI';
import { Mole } from '../components/Art';
function useBackgroundPause(pause: () => void) {
  const latest = useRef(pause); latest.current = pause;
  useEffect(() => {
    const hide = () => { if (document.hidden) latest.current(); };
    const back = () => latest.current();
    document.addEventListener('visibilitychange', hide); window.addEventListener('game-back', back);
    const native = Capacitor.isNativePlatform() ? NativeApp.addListener('appStateChange', ({ isActive }) => { if (!isActive) latest.current(); }) : null;
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('game-back', back); void native?.then(h => h.remove()); };
  }, []);
}
function Result({ kind, score, total, subtitle }: { kind: 'literacy' | 'count' | 'calculate'; score: number; total: number; subtitle: string }) {
  const { navigate, start } = useApp();
  return <section className="result-page"><div className="result-stars">✧ <Star size={45} fill="currentColor"/> ✧</div><span className="eyebrow">EVERY LITTLE STEP COUNTS</span><h1>又完成了一次小小探索！</h1><p>{subtitle}</p><div className="result-stats"><div><strong>{total}</strong><span>{kind === 'literacy' ? '练习汉字' : '完成题数'}</span></div><div><strong>{score}</strong><span>{kind === 'literacy' ? '成功命中' : '一次答对'}</span></div></div><Mole happy/><button className="button full" onClick={() => start(kind)}><RotateCcw size={18}/>再探索一次</button><button className="button secondary full" onClick={() => navigate(kind === 'literacy' ? 'literacy' : 'math')}>回到{kind === 'literacy' ? '汉字森林' : '数字小镇'}</button></section>;
}
export function LiteracyGame({ id }: { id: string }) {
  const { data, navigate, read, finish, notify } = useApp(); const [game] = useState(() => newMoleGame(data.library));
  const [, redraw] = useState(0), [listening, setListening] = useState(false), [transcript, setTranscript] = useState('');
  const active = useRef(true), voiceToken = useRef(0), recorded = useRef(false), listeningRef = useRef(false);
  const tick = () => { advanceGame(game); redraw(n => n + 1); };
  function pause() { if (game.finished) { navigate('literacy'); return; } voiceToken.current++; listeningRef.current = false; setListening(false); advanceGame(game); pauseGame(game); void stopVoice().catch(() => {}); redraw(n => n + 1); }
  useBackgroundPause(pause);
  useEffect(() => { active.current = true; const timer = setInterval(tick,100); return () => { active.current = false; voiceToken.current++; clearInterval(timer); void stopVoice().catch(() => {}); }; }, []);
  const target = game.target, done = game.finished;
  useEffect(() => { if (!done) { setTranscript(''); read(`请找到，${target}。`, true); } }, [target, done]);
  useEffect(() => { if (done && !recorded.current) { recorded.current = true; finish({ id, kind: 'literacy', score: game.score, total: game.targets.length, at: Date.now() }); read('真棒，今天的汉字练习完成啦！', true); } }, [done]);
  function hit(slot: number, wave: number) { const result = hitMole(game,slot,wave); if (result !== null) { setTranscript(result ? '找对啦！再看看其他小地鼠。' : '没关系，再看看上面的字。'); redraw(n => n + 1); } }
  async function answerByVoice() {
    if (listeningRef.current) { await stopVoice(); return; }
    advanceGame(game); if (game.finished || game.pausedAt !== null) return;
    pauseGame(game); const token = ++voiceToken.current, round = game.index, wave = game.wave;
    listeningRef.current = true; setListening(true); setTranscript('读出上面的大字，我在听…');
    try {
      const matches = await listen(game.pool);
      if (!active.current || token !== voiceToken.current || game.index !== round || document.hidden) return;
      resumeGame(game);
      const correct = matches.some(text => matchWordSpeech(text, game.target));
      if (correct) {
        const slot = game.moles.findIndex(m => m?.char === game.target && !m.hit);
        if (slot >= 0) hit(slot, wave); else setTranscript('这个字已经找到了，等下一批小地鼠吧。');
      } else setTranscript(`听到“${matches[0] || ''}”。再试一次，也可以点地鼠。`);
    } catch (e) { if (active.current && token === voiceToken.current) setTranscript(errorMessage(e)); }
    finally { if (active.current && token === voiceToken.current) { if (!document.hidden) resumeGame(game); listeningRef.current = false; setListening(false); redraw(n => n + 1); } }
  }
  if (done) return <Result kind="literacy" score={game.score} total={game.targets.length} subtitle="每个认真寻找的瞬间，都在悄悄长大。"/>;
  const paused = game.pausedAt !== null, remaining = Math.max(0, game.deadline - (game.pausedAt ?? Date.now()));
  return <div className="game-page literacy-game"><div className="game-top"><Back onClick={pause} label="汉字森林"/><span>{game.index+1} / {game.targets.length} 个字</span><button className="icon-button" aria-label="暂停练习" onClick={pause}><Pause size={22}/></button></div><div className="game-progress"><span style={{ width: `${remaining / (game.seconds * 1000) * 100}%` }}/></div><div className="target-area"><span className="eyebrow">找找看，哪个字是</span><button className="target-word" onClick={() => read(game.target)} aria-label={`朗读目标字${game.target}`}>{game.target}<Volume2 size={19}/></button><span className="score-pill"><Star size={16}/>{game.score} 次命中<span>·</span>{Math.ceil(remaining/1000)} 秒</span></div><div className="mole-field"><span className="field-flower">✿</span>{game.moles.map((mole, slot) => <button key={`${game.wave}-${slot}`} className={`mole-hole ${mole ? 'occupied' : ''} ${mole?.hit ? 'hit' : ''}`} disabled={!mole || mole.hit || paused} aria-label={mole ? `地鼠${mole.char}` : '空洞'} onClick={() => hit(slot,game.wave)}><span className="hole-ground"/>{mole && <div className="mole-character"><Mole happy={mole.hit}/><span className="mole-letter">{mole.char}</span></div>}{game.feedback?.slot === slot && game.feedback.until > Date.now() && <span className={`hit-feedback ${game.feedback.correct ? '' : 'wrong'}`}>{game.feedback.correct ? '+1 ✦' : '再试试'}</span>}</button>)}</div><p className="game-feedback" role="status">{transcript || '点点相同汉字的小地鼠，或者说出这个字。'}</p><VoiceButtons onRead={() => read(`请找到，${game.target}。`)} onListen={() => void answerByVoice().catch(e => notify(errorMessage(e)))} listening={listening}/><p className="small muted centered">说话时会暂停计时 · 同一只地鼠只计一次</p>
  {paused && !listening && <Modal title="休息一下，等你回来" onClose={() => { resumeGame(game); redraw(n => n + 1); }}><Mole className="pause-mole"/><p className="centered muted">练习已暂停，剩余时间会为你保留。</p><button className="button full" onClick={() => { resumeGame(game); redraw(n => n + 1); }}><Play size={18}/>继续探索</button><button className="button secondary full" onClick={() => navigate('literacy')}><Flag size={17}/>提前结束</button></Modal>}</div>;
}
export function ArithmeticGame({ id, mode }: { id: string; mode: MathGame['mode'] }) {
  const { data, navigate, read, finish, notify } = useApp(); const [game] = useState(() => newMathGame(data.math,mode));
  const [, redraw] = useState(0), [paused, setPaused] = useState(false), [listening, setListening] = useState(false), [transcript, setTranscript] = useState(''), [animation, setAnimation] = useState(0);
  const active = useRef(true), voiceToken = useRef(0), recorded = useRef(false), listeningRef = useRef(false), pausedRef = useRef(false);
  function pause() { if (game.finished) { navigate('math'); return; } voiceToken.current++; listeningRef.current = false; setListening(false); pausedRef.current = true; setPaused(true); void stopVoice().catch(() => {}); }
  useBackgroundPause(pause);
  useEffect(() => { active.current = true; return () => { active.current = false; voiceToken.current++; void stopVoice().catch(() => {}); }; }, []);
  const done = game.finished, q = game.questions[Math.min(game.index,game.questions.length-1)], vehicle = VEHICLES.find(v => v.id === q.vehicle)!;
  const prompt = mode === 'count' ? q.answer === 0 ? '车站里一辆车也没有。这就是零。' : `数一数，有几${vehicle.unit}${vehicle.name}？` : `${q.a} ${q.op === '+' ? '加' : '减'} ${q.b}，等于多少？`;
  useEffect(() => { if (!done) { setTranscript(''); read(prompt, true); } }, [game.index, done]);
  useEffect(() => { if (done && !recorded.current) { recorded.current = true; finish({ id, kind: mode, score: game.firstTry, total: game.questions.length, at: Date.now() }); read('真棒！数字小镇的探索完成啦！', true); } }, [done]);
  function answer(value: number, round: number) {
    if (pausedRef.current) return;
    const result = answerMath(game,value,round);
    if (result === 'correct') { setTranscript('答对啦！准备好就去下一站。'); read('答对啦，真棒！', true); }
    if (result === 'wrong') setTranscript('再数一数，没关系，慢慢来。');
    if (result === 'ignored' && !game.solved) setTranscript('再说一次完整的数字，或者点击下面的答案。');
    redraw(n => n + 1);
  }
  async function answerByVoice() {
    if (listeningRef.current) { await stopVoice(); return; }
    if (game.solved || game.finished || pausedRef.current) return;
    const token = ++voiceToken.current, round = game.index; listeningRef.current = true; setListening(true); setTranscript('说出你的答案，我在听…');
    try {
      const matches = await listen(['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','两']);
      if (!active.current || token !== voiceToken.current || round !== game.index || document.hidden) return;
      const value = parseNumberSpeech(matches[0] || '');
      if (value === null) setTranscript(`听到“${matches[0] || ''}”。请说一个 0 到 20 的数字。`); else answer(value,round);
    } catch (e) { if (active.current && token === voiceToken.current) setTranscript(errorMessage(e)); }
    finally { if (active.current && token === voiceToken.current) { listeningRef.current = false; setListening(false); } }
  }
  function count(index: number, round: number) { if (pausedRef.current || listeningRef.current) return; if (countVehicle(game,index,round)) { read(String(game.counted.length), true); setTranscript(game.solved ? `数完啦，一共有 ${q.answer} ${vehicle.unit}！` : `已经数了 ${game.counted.length} ${vehicle.unit}，继续找找看。`); redraw(n => n + 1); } }
  if (done) return <Result kind={mode} score={game.firstTry} total={game.questions.length} subtitle="认真想、勇敢试，就是最棒的小小驾驶员。"/>;
  return <div className="game-page math-game"><div className="game-top"><Back onClick={pause} label="数字小镇"/><span>第 {game.index+1} / {game.questions.length} 站</span><button className="icon-button" aria-label="暂停练习" onClick={pause}><Pause size={22}/></button></div><div className="game-progress warm-progress"><span style={{ width: `${game.index / game.questions.length * 100}%` }}/></div><div className="math-question"><p className="eyebrow">{mode === 'count' ? 'COUNT THE LITTLE VEHICLES' : 'THINK, TRY & DISCOVER'}</p><h1>{mode === 'count' ? <>认识数字 <strong>{q.answer}</strong></> : <>{q.a} <span>{q.op}</span> {q.b} <span>=</span> <strong>{game.solved ? q.answer : '?'}</strong></>}</h1><p>{mode === 'count' ? q.answer === 0 ? '一辆也没有，空空的车站就是 0。' : `点一点，每${vehicle.unit}${vehicle.name}只数一次。` : q.op === '+' ? `原来有 ${q.a} ${vehicle.unit}，又开来 ${q.b} ${vehicle.unit}。` : `原来有 ${q.a} ${vehicle.unit}，开走了 ${q.b} ${vehicle.unit}。`}</p></div><section className="vehicle-scene"><div className="town-sky"><span>☁</span><span className="town-house">⌂</span><span>☁</span></div><div className="vehicle-stage" key={`${game.index}-${animation}`}>{Array.from({ length: mode === 'count' ? q.answer : q.op === '+' ? q.a! + q.b! : q.a! }, (_, i) => <button key={i} aria-label={`第${i+1}${vehicle.unit}${vehicle.name}`} disabled={mode !== 'count' || game.counted.includes(i) || listening || paused} onClick={() => count(i,game.index)} className={`vehicle-token ${game.counted.includes(i) ? 'counted' : ''} ${mode === 'calculate' ? q.op === '+' && i >= q.a! ? 'arriving' : q.op === '−' && i >= q.answer ? 'departing' : '' : ''}`} style={{ animationDelay: `${(i % 5) * 0.09}s` }}><span>{vehicle.emoji}</span>{game.counted.includes(i) && <b>{game.counted.indexOf(i)+1}</b>}</button>)}{(mode === 'count' && q.answer === 0 || mode === 'calculate' && q.a === 0 && q.b === 0) && <div className="empty-station">空空的小车站</div>}</div><div className="town-road"/></section>{mode === 'calculate' && <button className="text-button replay" onClick={() => { setAnimation(a => a+1); read(prompt); }}><RotateCcw size={16}/>再看一次</button>}<p className="game-feedback" role="status">{transcript || (game.solved ? '数完啦，准备好就去下一站。' : '慢慢想，想好了再回答。')}</p>
  {!game.solved && mode === 'calculate' && <div className="answer-choices">{q.choices.map(value => <button key={value} className={game.wrong.includes(value) ? 'wrong' : ''} disabled={listening || paused || game.wrong.includes(value)} onClick={() => answer(value,game.index)}>{value}</button>)}</div>}
  {!game.solved && mode === 'count' && q.answer === 0 && <button className="button full" disabled={listening || paused} onClick={() => answer(0,game.index)}>一辆也没有，就是 0</button>}
  {game.solved ? <button className="button full" onClick={() => { voiceToken.current++; void stopVoice().catch(() => {}); nextMath(game); redraw(n => n+1); }}>{game.index+1 === game.questions.length ? '完成这次探索' : '去下一站'}<ArrowRight size={18}/></button> : <VoiceButtons onRead={() => read(prompt)} onListen={() => void answerByVoice().catch(e => notify(errorMessage(e)))} listening={listening}/>}
  {paused && <Modal title="小车停好了，休息一下" onClose={() => { pausedRef.current = false; setPaused(false); }}><p className="muted">这道题会留在这里，随时可以继续。</p><button className="button full" onClick={() => { pausedRef.current = false; setPaused(false); }}><Play size={18}/>继续探索</button><button className="button secondary full" onClick={() => navigate('math')}>提前结束</button></Modal>}</div>;
}
