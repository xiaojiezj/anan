import { afterEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ stop: vi.fn(async () => {}), speak: vi.fn(async () => {}), listen: vi.fn(async () => ({ matches:['十二'] })), status: vi.fn(async () => ({tts:true,recognition:true})), openSettings: vi.fn(async () => {}) }));
vi.mock('@capacitor/core', () => ({ Capacitor:{isNativePlatform:() => true},registerPlugin:() => native }));
import { listen, speak, stopVoice, voiceStatus } from '../src/services/voice';
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('speech lifecycle', () => {
  it('drops a stale speech request while the next one takes over', async () => { let release!: () => void; native.stop.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })); const stale = speak('日'); await speak('月'); release(); await stale; expect(native.speak).toHaveBeenCalledTimes(1); expect(native.speak).toHaveBeenCalledWith({text:'月',rate:.85}); });
  it('cancels a pending microphone start before it can acquire audio', async () => { vi.useFakeTimers(); const pending = listen(); const check = expect(pending).rejects.toThrow('已取消'); await Promise.resolve(); await stopVoice(); await vi.advanceTimersByTimeAsync(250); await check; expect(native.listen).not.toHaveBeenCalled(); });
  it('stops the speaker before invoking recognition and returns transcripts', async () => { vi.useFakeTimers(); const pending = listen(); await vi.advanceTimersByTimeAsync(250); expect(await pending).toEqual(['十二']); expect(native.stop.mock.invocationCallOrder[0]).toBeLessThan(native.listen.mock.invocationCallOrder[0]); });
  it('sends the complete practice vocabulary to offline recognition', async () => { vi.useFakeTimers(); const pending = listen(['日','月','山']); await vi.advanceTimersByTimeAsync(250); await pending; expect(native.listen).toHaveBeenCalledWith({hints:['日','月','山']}); });
  it('exposes model preparation instead of reporting missing system services', async () => { native.status.mockResolvedValueOnce({tts:false,recognition:false,loading:true,engine:'offline',message:'正在准备'} as Awaited<ReturnType<typeof native.status>>); expect(await voiceStatus()).toMatchObject({tts:false,recognition:false,loading:true,engine:'offline'}); });
});
