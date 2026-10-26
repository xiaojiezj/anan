import { Capacitor, registerPlugin } from '@capacitor/core';
export type VoiceStatus = { tts: boolean; recognition: boolean; loading?: boolean; engine?: 'offline' | 'browser'; message?: string };
type VoicePlugin = { status(): Promise<VoiceStatus>; speak(options: { text: string; rate: number }): Promise<void>; listen(options: { hints: string[] }): Promise<{ matches: string[] }>; stop(): Promise<void>; openSettings(): Promise<void> };
const NativeVoice = registerPlugin<VoicePlugin>('LearningVoice');
type RecognitionResult = { results: { [key: number]: { [key: number]: { transcript: string }; length: number }; length: number }; };
type BrowserRecognition = { lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; onresult: ((e: RecognitionResult) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; abort(): void };
type VoiceWindow = Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition };
let recognition: BrowserRecognition | null = null;
let cancelWeb: (() => void) | null = null;
let generation = 0;
const recognitionClass = () => (window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition;
export async function voiceStatus(): Promise<VoiceStatus> { return Capacitor.isNativePlatform() ? NativeVoice.status() : { tts: 'speechSynthesis' in window, recognition: !!recognitionClass(), engine: 'browser', message: '网页版使用浏览器语音，支持情况取决于浏览器和中文语音服务；安卓安装包内置离线中文语音。' }; }
async function halt() {
  if (Capacitor.isNativePlatform()) { await NativeVoice.stop(); return; }
  window.speechSynthesis?.cancel(); cancelWeb?.(); recognition?.abort(); recognition = null;
}
export async function stopVoice() { generation++; await halt(); }
export async function speak(text: string, rate = 0.85) {
  const token = ++generation; await halt();
  if (token !== generation) return;
  if (Capacitor.isNativePlatform()) return NativeVoice.speak({ text, rate });
  if (!window.speechSynthesis) throw Error('当前设备不支持朗读');
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = rate;
  const chinese = window.speechSynthesis.getVoices().find(v => /zh[-_]CN/i.test(v.lang)); if (chinese) utterance.voice = chinese;
  window.speechSynthesis.speak(utterance);
}
export async function listen(hints: string[] = []): Promise<string[]> {
  const token = ++generation; await halt();
  // Let the speaker drain before opening the microphone so the app cannot answer itself.
  await new Promise(resolve => setTimeout(resolve, 220));
  if (token !== generation) throw Error('已取消语音回答');
  if (Capacitor.isNativePlatform()) return (await NativeVoice.listen({ hints })).matches;
  const Recognition = recognitionClass(); if (!Recognition) throw Error('当前浏览器不支持语音回答，请在安卓 App 中使用');
  return new Promise((resolve, reject) => {
    const session = new Recognition(); recognition = session; let settled = false;
    const finish = (matches?: string[], error?: string) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (recognition === session) recognition = null; cancelWeb = null;
      session.onend = null; session.abort(); matches ? resolve(matches) : reject(Error(error || '没有听清，请再试一次'));
    };
    const timeout = setTimeout(() => finish(undefined, '没有听清，请再试一次'), 9000);
    cancelWeb = () => finish(undefined, '已取消语音回答');
    session.lang = 'zh-CN'; session.continuous = false; session.interimResults = false; session.maxAlternatives = 5;
    session.onresult = e => finish(Array.from({ length: e.results[0].length }, (_, i) => e.results[0][i].transcript));
    session.onerror = e => finish(undefined, e.error === 'not-allowed' ? '麦克风权限未开启，可以继续点选答案' : '没有听清，请再试一次，也可以点选答案');
    session.onend = () => finish(); session.start();
  });
}
export async function openVoiceSettings() { if (Capacitor.isNativePlatform()) await NativeVoice.openSettings(); else throw Error('请在安卓 App 中打开麦克风权限设置'); }
