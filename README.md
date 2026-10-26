# 小小探索家 · 网页与 Android

重做原 `morphe/weixin/mota` 的商城、识字和数学功能，增加普通话题目朗读及语音回答。支持网页与 Android，未创建 iOS 工程。

## GitHub Pages

仓库：[xiaojiezj/anan](https://github.com/xiaojiezj/anan)。网站地址：[小小探索家](https://xiaojiezj.github.io/anan/)。使用 GitHub Pages 默认域名与 HTTPS，无需配置域名或 DNS 解析。

推送到 `main` 后，GitHub Actions 自动安装依赖、运行测试、构建并发布网站。首次发布需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。GitHub Free 的 Pages 需要公开仓库；私有仓库需支持 Pages 的付费方案。网站发布后可公开访问。

```bash
npm ci
npm test
npm run build:pages
npm exec vite -- preview --outDir dist-pages --port 5181
```

本地验证地址为 `http://localhost:5181/`。Pages 构建单独输出到 `dist-pages/`，使用相对资源路径，支持默认网站地址的 `/anan/` 路径；Android 继续使用 `npm run build` 生成的 `dist/`，两者互不覆盖。工作流只上传网页文件，不发布 APK、原生语音模型或签名文件。

商品照片、字库与学习记录保存在当前浏览器的 IndexedDB 中，不上传到 GitHub，也不会在用户之间共享。从本地预览、Android 或旧域名迁移，请先在旧页面“家长 → 导出备份”保存 JSON，再到新网站“家长 → 导入备份”。不同域名的数据不自动共享；清除站点数据会删除本机记录。

网页版朗读和语音回答依赖浏览器 Web Speech API、中文语音服务及麦克风权限，部分手机浏览器不支持。浏览器识别可能使用其服务商的在线服务；Android 安装包的内置离线中文语音不在网页上运行。

## 直接安装

安装包：`output/little-explorer-1.1.0-debug.apk`。

1. 把 APK 传到 Android 手机，在系统文件管理器中打开。
2. 若手机询问，为本次使用的文件管理器或浏览器开启“允许安装未知应用”。
3. 完成安装后，打开“小小探索家”。不需要上架应用商店或登录。
4. 首次打开等待“离线语音已开启”，再进入“家长 → 试听朗读 / 测试麦克风”。点击麦克风时才会申请录音权限。
5. 已装 1.0.0 的手机直接覆盖安装，不要卸载；商品图片和配置继续保留。

这是本地开发签名的测试包，支持 Android 7.0 / API 24 及以上，建议使用已更新 Android System WebView 的手机。它不依赖开发电脑或开发服务器，可以断网打开。1.1.0 内置中文朗读和识别模型，语音断网可用，不再依赖荣耀等手机上的系统语音服务或 Google 服务。支持 ARM64 / ARMv7 设备。模型在首次启动时校验并复制到 App 私有目录，界面显示准备状态。安装包约 144 MiB，比旧版明显增大；额外模型文件约 96 MiB。

安装更新需保留相同包名和签名。当前使用这台电脑的 `~/.android/debug.keystore`；从另一台电脑生成的调试包可能需要先卸载旧版，卸载会清除本机数据。长期分发前应配置自己的 release 签名并妥善备份签名文件。没有接入远程更新服务。

## 功能

### 心愿商城

- 初始商品为空；添加、查看、修改图片 / 名称 / 价格，移除及回收站恢复。
- JPG / PNG / WebP，原图最大 10 MB，按完整比例缩放到 640×640 白底画布。
- 名称 1–24 个字符，奖励币价格 1–999999 整数，最多 100 件商品；回收站保留最近 100 件。
- 沿用原版范围：只配置商品和展示奖励币价格，没有余额账户、发币或扣币兑换。

### 汉字森林

- 默认“日月水火山石田土人口手木”；批量添加、自动拆分去重、逐字编辑删除、勾选练习、全选，最多 100 个字。
- 9 洞敲地鼠，每批 1 个目标字、2 个干扰字。顶部持续显示目标；命中 +1，重复点击和过期点击不计分。
- 每字 5 / 10 / 15 / 20 秒；地鼠停留 3 / 5 / 8 / 10 秒或自定义 1–20 秒。调整到较慢速度时自动延长每字时长，最后一批不会匆忙闪过。
- 自动换字、暂停继续、提前结束、完整结果；切后台自动暂停，回来手动继续。
- 每个目标字可自动朗读，也可重听；点击麦克风读出汉字，识别匹配后命中目标地鼠。聆听期间暂停计时，取消、超时及后台返回不会把旧回答计入新题。

### 数字小镇

- 0–20 自选，1–5 / 1–10 / 1–20 快选，加法 / 减法 / 混合，5 / 10 题。
- 小汽车、公交车、小火车、小货车、小轮船、小飞机六种道具。
- 认识数字逐个点数，单个道具不重复计数，0 用空车站说明；也可直接语音回答数量。
- 加减法开来 / 开走动画、重看、点选或语音回答、答错重试、手动下一题，没有倒计时。
- 运算数、结果与答案选项全部来自所选集合；无负数，不选 0 就不出现 0；无法组成算式时仍可认数。
- 结果展示完成题数、一次答对数；首页显示今天完成的练习次数，最多保存 500 次完整练习。

### 语音与数据

- 原生 Android 离线语音：Sherpa-ONNX + Icefall VITS / AISHELL-3 中文朗读，Vosk small-cn 中文识别。使用 CPU，不依赖系统 TTS、系统识别器或在线 API。
- “家长”可开关自动朗读、调整语速、试听、测试麦克风、打开麦克风权限设置。
- 麦克风仅按需开启，最长一次聆听 8 秒；音频仅在内存处理，不保存、不上传。取消或切后台即停止播放 / 录音，旧回调不会给新题计分。
- 识字传入整轮字库，数学传入全部 0–20 数字作为识别提示；仍允许未知语音，静音不计分。噪声、口音和儿童发音可能影响准确率，随时可重试或点选。
- 首次准备资源期间暂停语音入口；模型加载失败会给出提示，点选功能仍可用。
- IndexedDB 事务保存所有配置、商品照片和练习记录；失败保留旧状态，坏数据不会自动被默认值覆盖。
- JSON 备份含全部图片；安卓通过系统分享面板保存备份，导入前校验并显示替换确认。
- 原微信登录与云存储没有移植：独立 App 当前采用单设备数据，不自动同步或导入微信 OPENID 下的存档。备份可在安装相同 App 的设备间手动迁移。

## 本地开发

技术：React 19、TypeScript、Vite、Capacitor 8、原生 Java 语音桥。

```bash
npm ci
npm run dev
```

浏览器预览：`http://localhost:5180`。浏览器用 Web Speech API，语音支持情况与安卓原生版可能不同。浏览器数据与 APK 数据相互独立。

```bash
npm test
npm run build
npm run android:sync
npm run android:open
```

## 生成 APK

需要 Node 22+、JDK 21、Android SDK 36、Build Tools 35/36 和 Gradle 8.14.3。Android 工程内的 Gradle wrapper 可以自动下载 Gradle。

本次安装的工具位于忽略目录 `.tools/`，不会写进源码。构建脚本自动采用 `.tools/android-sdk`，也可以使用已有 `ANDROID_HOME`。当前电脑 JDK 21 位于 `.tools/jdk/Contents/Home`。

```bash
export JAVA_HOME="$PWD/.tools/jdk/Contents/Home"
export ANDROID_HOME="$PWD/.tools/android-sdk"
npm run android:apk
```

需要使用已经运行的本机 SOCKS 代理时，设置 `ANDROID_BUILD_SOCKS_PORT` 为对应端口；脚本不会修改系统代理配置。正式分发请在 Android Studio 配置 release 签名，当前脚本生成 debug APK。

## 验证

见 [验证记录](docs/VERIFICATION.md) 和 [离线语音模型](docs/SPEECH_MODELS.md)。安卓模拟器可验证模型、原生播放和取消逻辑；荣耀真机的扬声器、麦克风及实际儿童发音仍需在目标手机上确认。

## 代码目录

- `src/domain/`：可独立测试的字库、地鼠、数学、商品和语音答案规则。
- `src/pages/`、`src/components/`：页面、游戏和本地绘制插画。
- `src/services/`：事务存储、图片处理、备份、浏览器 / 原生语音适配。
- `android/app/src/main/java/com/xiaojie/littleexplorer/`：离线模型安装、合成、识别、原生音频、权限与生命周期。
- `android/app/src/androidTest/`：原生语音测试及独立中文音频样本（仅测试包包含这些录音）。
- `tests/`：出题约束、计分、防重复、语音取消、存储回滚和备份校验。
- `scripts/`：APK 构建与图标生成。
