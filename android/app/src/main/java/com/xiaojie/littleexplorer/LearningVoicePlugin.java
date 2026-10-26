package com.xiaojie.littleexplorer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import org.vosk.Recognizer;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@CapacitorPlugin(name = "LearningVoice", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class LearningVoicePlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService speechWorker = Executors.newSingleThreadExecutor();
    private final ExecutorService microphoneWorker = Executors.newSingleThreadExecutor();
    private final AtomicLong epoch = new AtomicLong();
    private final Object audioLock = new Object();
    private CompletableFuture<OfflineSpeechEngine> engine;
    private volatile String loadError = "";
    private volatile boolean ready, destroyed;
    private AudioTrack track;
    private AudioRecord recorder;
    // Main-thread-owned calls. Every worker result is fenced by epoch.
    private PluginCall listeningCall;
    private PluginCall permissionCall;

    @Override public void load() {
        engine = CompletableFuture.supplyAsync(() -> {
            try { OfflineSpeechEngine value = new OfflineSpeechEngine(getContext()); ready = true; return value; }
            catch (Exception | LinkageError e) {
                loadError = "离线语音加载失败，请确认手机存储空间充足后重新打开 App；无需安装系统语音引擎";
                android.util.Log.e("LearningVoice", "Bundled model initialization failed", e);
                throw new CompletionException(e);
            }
        }, speechWorker);
    }
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject(); result.put("tts", ready); result.put("recognition", ready);
        result.put("loading", !ready && loadError.isEmpty()); result.put("engine", "offline");
        result.put("message", !loadError.isEmpty() ? loadError : ready ? "内置中文语音已就绪，无需联网" : "首次正在准备内置中文语音，请稍候…");
        call.resolve(result);
    }
    @PluginMethod public void speak(PluginCall call) {
        main.post(() -> {
            String text = call.getString("text", "");
            if (text.trim().isEmpty() || text.length() > 500) { call.reject("朗读内容为空或过长"); return; }
            stopInternal("已取消语音回答"); final long token = epoch.get();
            final float rate = Math.max(.5f, Math.min(1.2f, call.getFloat("rate", .85f)));
            speechWorker.execute(() -> {
                try {
                    OfflineSpeechEngine loaded = engine.get();
                    if (!active(token)) { call.resolve(); return; }
                    GeneratedAudio audio = loaded.synthesize(text, rate, () -> active(token));
                    if (!active(token)) { call.resolve(); return; }
                    if (audio.getSamples().length == 0) { call.reject("这段文字暂时无法朗读，请换一个汉字或重试"); return; }
                    play(audio, token); call.resolve();
                } catch (Exception | LinkageError error) {
                    if (active(token)) call.reject(loadError.isEmpty() ? "声音播放失败，请检查媒体音量后重试" : loadError);
                    else call.resolve();
                }
            });
        });
    }
    private boolean active(long token) { return !destroyed && epoch.get() == token; }
    void play(GeneratedAudio audio, long token) {
        int rate = audio.getSampleRate();
        int size = Math.max(AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT), rate / 2);
        AudioTrack output = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
            .setTransferMode(AudioTrack.MODE_STREAM).setBufferSizeInBytes(size).build();
        try {
            synchronized (audioLock) { if (!active(token)) return; track = output; output.play(); }
            float[] samples = audio.getSamples(); short[] buffer = new short[2048]; int written = 0;
            for (int offset = 0; offset < samples.length && active(token);) {
                int length = Math.min(buffer.length, samples.length - offset);
                for (int i = 0; i < length; i++) buffer[i] = (short) Math.round(Math.max(-1f,Math.min(1f,samples[offset+i])) * 32767f);
                int consumed = output.write(buffer, 0, length, AudioTrack.WRITE_BLOCKING);
                if (consumed <= 0) { if (active(token)) throw new IllegalStateException("Audio write failed"); break; }
                offset += consumed; written += consumed;
            }
            // Wait for the buffered tail so a short character is not cut off.
            long deadline = SystemClock.elapsedRealtime() + 3000;
            while (active(token) && output.getPlaybackHeadPosition() < written && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(15);
        } finally {
            synchronized (audioLock) { if (track == output) track = null; }
            try { output.stop(); } catch (IllegalStateException ignored) {} output.release();
        }
    }
    @PluginMethod public void listen(PluginCall call) {
        main.post(() -> {
            if (listeningCall != null || permissionCall != null) { call.reject("正在聆听，请先取消后再试"); return; }
            stopInternal("已取消语音回答"); listeningCall = call;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                permissionCall = call; requestPermissionForAlias("microphone", call, "microphoneResult");
            } else startMicrophone(call, epoch.get());
        });
    }
    @PermissionCallback private void microphoneResult(PluginCall call) {
        main.post(() -> {
            if (permissionCall != call || listeningCall != call) return;
            permissionCall = null;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                listeningCall = null; call.reject("麦克风权限未开启，可在家长设置中打开权限，或继续点选答案"); return;
            }
            startMicrophone(call, epoch.get());
        });
    }
    @SuppressLint("MissingPermission") // Runtime permission is checked above; revocation is caught below.
    private void startMicrophone(PluginCall call, long token) {
        List<String> hints = new ArrayList<>(); JSArray values = call.getArray("hints");
        if (values != null) for (int i = 0; i < Math.min(values.length(), 100); i++) hints.add(values.optString(i));
        microphoneWorker.execute(() -> {
            AudioRecord input = null; Recognizer recognizer = null;
            List<String> matches = Collections.emptyList(); String failure = "";
            try {
                OfflineSpeechEngine loaded = engine.get(); if (!active(token)) return;
                recognizer = loaded.newRecognizer(hints, 16000f);
                int size = Math.max(AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), 6400);
                input = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size);
                synchronized (audioLock) {
                    if (!active(token)) return;
                    if (input.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Microphone not initialized");
                    recorder = input; input.startRecording();
                }
                if (input.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("Microphone unavailable");
                byte[] buffer = new byte[3200]; long deadline = SystemClock.elapsedRealtime() + 8000;
                while (active(token) && SystemClock.elapsedRealtime() < deadline) {
                    int count = input.read(buffer, 0, buffer.length, AudioRecord.READ_BLOCKING);
                    if (count <= 0) { if (active(token)) throw new IllegalStateException("Microphone read failed"); break; }
                    if (recognizer.acceptWaveForm(buffer, count)) {
                        matches = OfflineSpeechEngine.transcripts(recognizer.getResult());
                        if (!matches.isEmpty()) break;
                    }
                }
                if (matches.isEmpty() && active(token)) matches = OfflineSpeechEngine.transcripts(recognizer.getFinalResult());
                if (matches.isEmpty()) failure = "没有听清，请再说一次，也可以点选答案";
            } catch (SecurityException e) { failure = "麦克风权限未开启，请在家长设置中打开权限"; }
            catch (Exception | LinkageError e) { failure = loadError.isEmpty() ? "无法使用麦克风，请关闭其他占用麦克风的应用后重试" : loadError; }
            finally {
                if (input != null) {
                    synchronized (audioLock) { if (recorder == input) recorder = null; }
                    try { input.stop(); } catch (IllegalStateException ignored) {} input.release();
                }
                if (recognizer != null) recognizer.close();
            }
            final List<String> result = matches; final String error = failure;
            main.post(() -> {
                if (!active(token) || listeningCall != call) return;
                listeningCall = null;
                if (!error.isEmpty()) call.reject(error);
                else { JSObject response = new JSObject(); response.put("matches", new JSArray(result)); call.resolve(response); }
            });
        });
    }
    void stopInternal(String message) {
        epoch.incrementAndGet(); permissionCall = null;
        if (listeningCall != null) { PluginCall previous = listeningCall; listeningCall = null; previous.reject(message); }
        synchronized (audioLock) {
            if (track != null) try { track.pause(); track.flush(); } catch (IllegalStateException ignored) {}
            if (recorder != null) try { recorder.stop(); } catch (IllegalStateException ignored) {}
        }
    }
    @PluginMethod public void stop(PluginCall call) { main.post(() -> { stopInternal("已取消语音回答"); call.resolve(); }); }
    @PluginMethod public void openSettings(PluginCall call) {
        main.post(() -> {
            try { getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))); call.resolve(); }
            catch (Exception e) { call.reject("请在手机设置中打开小小探索家的麦克风权限"); }
        });
    }
    @Override protected void handleOnStop() { main.post(() -> stopInternal("练习已暂停")); }
    @Override protected void handleOnDestroy() {
        destroyed = true; main.post(() -> stopInternal("已退出练习"));
        speechWorker.shutdown(); microphoneWorker.shutdown();
        CompletableFuture.runAsync(() -> {
            try {
                while (!speechWorker.awaitTermination(5, TimeUnit.SECONDS)) { /* off the UI thread */ }
                while (!microphoneWorker.awaitTermination(5, TimeUnit.SECONDS)) { /* off the UI thread */ }
                if (engine != null && !engine.isCompletedExceptionally()) engine.get().close();
            } catch (Exception ignored) {} ready = false;
        });
    }
}
