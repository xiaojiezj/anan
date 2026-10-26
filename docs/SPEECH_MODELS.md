# 离线中文语音

Android 1.1.0 使用内置模型，不查询系统 TTS 或 SpeechRecognizer。普通网页预览仍使用浏览器 Web Speech API。

- 朗读：Sherpa-ONNX 2.0.0 + Icefall VITS / AISHELL-3 全精度中文模型，CPU 两线程，speaker 66，保留完整停顿并统一输出音量。
- 识别：Vosk Android 0.3.75 + vosk-model-small-cn-0.22，16 kHz 单声道 PCM，按题库提供候选词和 `[unk]`。
- 音频：AudioTrack / AudioRecord。录音只在内存处理，单次最长 8 秒，取消 / 后台停止；不联网、不保存录音。
- 许可：Sherpa、Vosk、AISHELL-3 模型均为 Apache-2.0。完整许可位于 `android/app/src/main/assets/licenses/`，模型原始 LICENSE 也随模型附带。

## 构建资源

所有运行所需文件已经在工程中；`npm run speech:check` 校验模型及原生 AAR，APK 构建脚本也会运行此检查。

如果复制工程时遗漏大文件，下载地址和整个下载文件的 SHA256 固定在 `scripts/speech-sources.json`。从官方来源重新下载后，先验证该 SHA256：

1. Sherpa AAR 放入 `android/app/libs/sherpa-onnx-2.0.0.aar`。
2. 将两个模型压缩包解压到临时目录，只复制 `android/app/src/main/assets/speech/manifest.json` 中列出的文件，保留目录结构。AISHELL-3 仅复制清单中的文件，不需要未启用的 `rule.far`，没有 espeak 数据依赖。
3. 执行 `npm run speech:check`，通过后再构建。

首次启动把模型复制到 Android 的 `no_backup/speech-<revision>` 目录，每个文件校验长度与 SHA256，最后写 `.ready` 标记。中途退出可在下次启动重新完成，不触碰 IndexedDB 学习数据；模型不进入系统备份。

## 原生测试

`android/app/src/androidTest/java/com/xiaojie/littleexplorer/OfflineSpeechTest.java` 在 ARM64 Android 35 模拟器运行真实 JNI 与模型；不是 mock。

独立识别样本位于测试 assets 的 `mandarin/`，由本机 macOS Tingting 普通话语音以每分钟 135 字生成，再转成 16 kHz、单声道、16 位小端 PCM，覆盖 0–20 和默认 12 个字。它们仅作为测试输入，不会装进正式 App 包，也不是儿童真声。测试另含 33 个字 / 数字的合成音长度、能量、峰值和有限性检查，完整题目合成、静音、取消合成、AudioTrack 取消后重新播放。

模拟器结果不代表荣耀手机的实际麦克风与儿童发音准确率。目标手机仍需在“家长 → 试听朗读 / 测试麦克风”确认声音与权限。

调试中也尝试过把合成音回送 Vosk 识别，短字存在明显误识别，记录见 `output/offline-roundtrip-diagnostic.txt`。该检查同时混合了合成声音、重采样和识别误差，不能作为朗读发音正确或真机识别准确率的证明。因此最终测试分别覆盖合成音完整性和独立录音识别；没有宣称合成短字互认或儿童真声达到 100%。
