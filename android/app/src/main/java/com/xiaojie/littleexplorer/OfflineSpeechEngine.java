package com.xiaojie.littleexplorer;

import android.content.Context;
import android.content.res.AssetManager;
import androidx.annotation.Keep;
import com.k2fsa.sherpa.onnx.*;
import kotlin.jvm.functions.Function1;
import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.BooleanSupplier;

/** Bundled CPU-only Mandarin models, independent of system speech services. */
public final class OfflineSpeechEngine implements AutoCloseable {
    private final OfflineTts tts;
    private final Model recognition;
    public OfflineSpeechEngine(Context context) throws Exception {
        File root = installAssets(context);
        File voice = new File(root, "vits-icefall-zh-aishell3");
        OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig();
        vits.setModel(new File(voice, "model.onnx").getAbsolutePath());
        vits.setLexicon(new File(voice, "lexicon.txt").getAbsolutePath());
        vits.setTokens(new File(voice, "tokens.txt").getAbsolutePath());
        OfflineTtsModelConfig model = new OfflineTtsModelConfig();
        model.setVits(vits); model.setNumThreads(2); model.setProvider("cpu");
        OfflineTtsConfig config = new OfflineTtsConfig();
        config.setModel(model); config.setRuleFsts(new File(voice, "number.fst").getAbsolutePath());
        config.setMaxNumSentences(1);
        // Keep quiet consonants in short Hanzi; pause shortening can remove them.
        config.setSilenceScale(1f);
        tts = new OfflineTts(null, config);
        try { recognition = new Model(new File(root, "vosk-model-small-cn-0.22").getAbsolutePath()); }
        catch (Exception | LinkageError e) { tts.release(); throw e; }
    }
    // A single synthesis executor owns tts; each recording owns its recognizer.
    public GeneratedAudio synthesize(String text, float rate, BooleanSupplier active) {
        GeneratedAudio audio = tts.generateWithCallback(text, 66, rate, new SynthesisCallback(active));
        float[] samples = audio.getSamples(); float peak = 0;
        for (float sample : samples) peak = Math.max(peak, Math.abs(sample));
        if (peak > .0001f && Float.isFinite(peak)) {
            float gain = Math.min(30f, .85f / peak);
            for (int i = 0; i < samples.length; i++) samples[i] *= gain;
        }
        return audio;
    }
    // Sherpa JNI looks up invoke(float[]): Integer. A Java lambda only exposes
    // the erased invoke(Object): Object method and causes a fatal JNI exception.
    @Keep
    public static final class SynthesisCallback implements Function1<float[], Integer> {
        private final BooleanSupplier active;
        public SynthesisCallback(BooleanSupplier active) { this.active = active; }
        @Override public Integer invoke(float[] samples) { return active.getAsBoolean() ? 1 : 0; }
    }
    public Recognizer newRecognizer(List<String> hints, float sampleRate) throws IOException {
        Recognizer recognizer;
        if (hints == null || hints.isEmpty()) recognizer = new Recognizer(recognition, sampleRate);
        else {
            LinkedHashSet<String> phrases = new LinkedHashSet<>();
            for (String hint : hints) if (hint != null && !hint.trim().isEmpty() && hint.length() <= 40) phrases.add(hint);
            // Unknown speech must remain possible rather than forcing all sound into an answer.
            phrases.add("[unk]");
            recognizer = new Recognizer(recognition, sampleRate, new JSONArray(phrases).toString());
        }
        recognizer.setMaxAlternatives(3); return recognizer;
    }
    public static List<String> transcripts(String json) throws Exception {
        JSONObject result = new JSONObject(json); LinkedHashSet<String> texts = new LinkedHashSet<>();
        JSONArray alternatives = result.optJSONArray("alternatives");
        if (alternatives != null) for (int i = 0; i < alternatives.length(); i++) addText(texts, alternatives.getJSONObject(i).optString("text"));
        else addText(texts, result.optString("text"));
        return new ArrayList<>(texts);
    }
    private static void addText(Set<String> texts, String text) {
        String clean = text.replaceAll("\\s+", "").trim();
        if (!clean.isEmpty() && !clean.contains("[unk]")) texts.add(clean);
    }
    /** Verify each copied asset and publish the completion marker last. */
    static synchronized File installAssets(Context context) throws Exception {
        AssetManager assets = context.getAssets(); String manifestText;
        try (InputStream input = assets.open("speech/manifest.json")) { manifestText = readText(input); }
        JSONObject manifest = new JSONObject(manifestText);
        String revision = manifest.getString("revision");
        File root = new File(context.getNoBackupFilesDir(), "speech-" + revision);
        File marker = new File(root, ".ready"); JSONArray files = manifest.getJSONArray("files");
        boolean complete = marker.isFile();
        for (int i = 0; complete && i < files.length(); i++) {
            JSONObject item = files.getJSONObject(i);
            complete = new File(root, item.getString("path")).length() == item.getLong("size");
        }
        if (complete) return root;
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("无法创建离线语音目录");
        if (marker.exists() && !marker.delete()) throw new IOException("无法更新离线语音数据");
        for (int i = 0; i < files.length(); i++) {
            JSONObject item = files.getJSONObject(i); File destination = new File(root, item.getString("path"));
            if (!destination.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("非法语音资源路径");
            File parent = destination.getParentFile();
            if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("语音存储空间不足");
            File partial = new File(parent, destination.getName() + ".part");
            MessageDigest digest = MessageDigest.getInstance("SHA-256"); long written = 0;
            try (InputStream input = assets.open("speech/" + item.getString("path")); FileOutputStream output = new FileOutputStream(partial)) {
                byte[] buffer = new byte[65536]; int length;
                while ((length = input.read(buffer)) != -1) { output.write(buffer, 0, length); digest.update(buffer, 0, length); written += length; }
                output.getFD().sync();
            }
            StringBuilder hash = new StringBuilder(); for (byte b : digest.digest()) hash.append(String.format(Locale.ROOT, "%02x", b & 255));
            if (written != item.getLong("size") || !hash.toString().equals(item.getString("sha256"))) throw new IOException("离线语音包校验失败，请重新安装更新包");
            if (destination.exists() && !destination.delete()) throw new IOException("无法替换语音资源");
            if (!partial.renameTo(destination)) throw new IOException("无法保存语音资源");
        }
        try (FileOutputStream output = new FileOutputStream(marker)) { output.write(revision.getBytes(StandardCharsets.UTF_8)); output.getFD().sync(); }
        return root;
    }
    private static String readText(InputStream stream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int length;
        while ((length = stream.read(buffer)) != -1) output.write(buffer,0,length);
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }
    @Override public void close() { tts.release(); recognition.close(); }
}
