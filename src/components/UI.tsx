import { ArrowLeft, X, Volume2, Mic, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</header>;
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog ref={dialog} className="modal" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) onClose(); }}><div className="modal-inner"><div className="section-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21}/></button></div>{children}</div></dialog>;
}
export function Back({ onClick, label = '返回' }: { onClick(): void; label?: string }) { return <button className="text-button" onClick={onClick}><ArrowLeft size={18}/>{label}</button>; }
export function VoiceButtons({ onRead, onListen, listening, disabled = false }: { onRead(): void; onListen(): void; listening: boolean; disabled?: boolean }) {
  return <div className="voice-buttons"><button className="button secondary" disabled={listening || disabled} onClick={onRead}><Volume2 size={18}/>听一听</button><button className={`button ${listening ? 'listening' : 'soft'}`} disabled={disabled} onClick={onListen}>{listening ? <LoaderCircle size={18} className="spin"/> : <Mic size={18}/>} {listening ? '正在听 · 点此取消' : '说出答案'}</button></div>;
}
export function ErrorText({ message }: { message: string }) { return message ? <p className="error" role="alert">{message}</p> : null; }
