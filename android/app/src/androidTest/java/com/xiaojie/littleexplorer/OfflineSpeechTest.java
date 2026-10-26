package com.xiaojie.littleexplorer;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.k2fsa.sherpa.onnx.GeneratedAudio;
import org.junit.*;
import org.junit.runner.RunWith;
import org.vosk.Recognizer;
import java.io.File;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

/** Real bundled JNI + models on Android, using generated samples rather than a live microphone. */
@RunWith(AndroidJUnit4.class)
public class OfflineSpeechTest {
    private static OfflineSpeechEngine engine;
    private static final List<String> NUMBERS = Arrays.asList("零","一","二","三","四","五","六","七","八","九","十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","两");
    @BeforeClass public static void loadBundledModels() throws Exception {
        engine = new OfflineSpeechEngine(InstrumentationRegistry.getInstrumentation().getTargetContext());
    }
    @AfterClass public static void release() { if (engine != null) engine.close(); }
    private static void assertAudible(GeneratedAudio audio) {
        assertTrue("Speech is too short", audio.getSamples().length > audio.getSampleRate() / 4);
        float peak = 0; double power = 0;
        for (float sample : audio.getSamples()) {
            assertTrue("Non-finite audio sample", Float.isFinite(sample));
            peak = Math.max(peak, Math.abs(sample)); power += sample * sample;
        }
        assertTrue("Inaudible or clipped synthesis", peak > .05f && peak <= 1f);
        assertTrue("Insufficient speech energy", Math.sqrt(power / audio.getSamples().length) > .003);
    }
    @Test public void readsMandarinQuestionWithAudibleSamples() throws Exception {
        GeneratedAudio audio = engine.synthesize("你好，小小探索家。三加二，等于多少？", .85f, () -> true);
        assertTrue("No audible duration", audio.getSamples().length > audio.getSampleRate());
        float peak = 0; for (float sample : audio.getSamples()) peak = Math.max(peak, Math.abs(sample));
        assertTrue("Silent synthesis", peak > .01f);
        File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "offline-speech-check.wav");
        assertTrue(audio.save(file.getAbsolutePath()));
    }
    @Test public void readsNumbersWithAudibleSamples() {
        for (String number : NUMBERS.subList(0, 21)) assertAudible(engine.synthesize(number + "。", .85f, () -> true));
    }
    @Test public void readsDefaultCharactersWithAudibleSamples() {
        for (String word : Arrays.asList("日","月","水","火","山","石","田","土","人","口","手","木")) {
            assertAudible(engine.synthesize(word + "。", .85f, () -> true));
        }
    }
    @Test public void silenceCannotProduceAnAnswer() throws Exception {
        Recognizer recognizer = engine.newRecognizer(NUMBERS,16000f);
        try { byte[] silence = new byte[96000]; recognizer.acceptWaveForm(silence,silence.length); assertTrue(OfflineSpeechEngine.transcripts(recognizer.getFinalResult()).isEmpty()); }
        finally { recognizer.close(); }
    }
    @Test public void recognizesIndependentMandarinRecordings() throws Exception {
        List<String> words = Arrays.asList("日","月","水","火","山","石","田","土","人","口","手","木");
        List<String> failures = new ArrayList<>();
        List<String> all = new ArrayList<>(NUMBERS.subList(0, 21)); all.addAll(words);
        for (String answer : all) {
            try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("mandarin/" + answer + ".pcm");
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                 Recognizer recognizer = engine.newRecognizer(words.contains(answer) ? words : NUMBERS, 16000f)) {
                byte[] chunk = new byte[4096]; int length;
                while ((length = input.read(chunk)) != -1) bytes.write(chunk, 0, length);
                byte[] sound = bytes.toByteArray(); byte[] padded = new byte[sound.length + 32000];
                System.arraycopy(sound, 0, padded, 16000, sound.length);
                recognizer.acceptWaveForm(padded, padded.length);
                List<String> result = OfflineSpeechEngine.transcripts(recognizer.getFinalResult());
                if (result.isEmpty() || !result.get(0).equals(answer)) failures.add(answer + " -> " + result);
            }
        }
        assertTrue(failures.toString(), failures.isEmpty());
    }
    @Test public void cancelsSynthesisAndCanReadAgain() {
        AtomicInteger callbacks = new AtomicInteger();
        engine.synthesize("你好。我们来认识汉字。下一题准备好了吗？", .85f, () -> { callbacks.incrementAndGet(); return false; });
        assertEquals(1, callbacks.get());
        assertTrue(engine.synthesize("重新开始。", .85f, () -> true).getSamples().length > 0);
    }
    @Test public void cancellationReleasesAndroidPlayback() throws Exception {
        LearningVoicePlugin plugin = new LearningVoicePlugin();
        ExecutorService worker = Executors.newSingleThreadExecutor();
        try {
            GeneratedAudio audio = engine.synthesize("你好，小小探索家。今天我们一起认识汉字，快乐数数。", .7f, () -> true);
            Future<?> playing = worker.submit(() -> plugin.play(audio, 0));
            Thread.sleep(300);
            assertFalse("Playback ended before cancellation test", playing.isDone());
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> plugin.stopInternal("测试取消"));
            playing.get(2, TimeUnit.SECONDS);
            // A fresh player must still be able to start and drain its full buffered tail.
            plugin.play(engine.synthesize("三。", .85f, () -> true), 1);
        } finally { plugin.handleOnDestroy(); worker.shutdownNow(); }
    }
}
