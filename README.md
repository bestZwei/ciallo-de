# ciallo-de

一个会呼吸、会眨眼、眼神跟着你的二次元小角色。点屏幕的任何地方都有回应，点她本人回应更明显。

- 在线地址：https://ciallo.de
- 技术栈：React 18 + Vite 5 + TypeScript，运行时第三方依赖只有 `pixi.js@6.5.10` 与 `pixi-live2d-display@0.4.0`

## 开发

```bash
npm install
npm run dev       # 本地开发
npm run build     # tsc -b && vite build
npm run preview   # 预览构建产物
```

`pixi.js` 必须锁在 6.x：`pixi-live2d-display@0.4.0` 的 peerDependency 是 `@pixi/*: ^6`，升到 7 会让 `instanceof` 与 renderer 直接失配。

两个语言入口本地都在：`http://localhost:5173/`（英文）与 `http://localhost:5173/zh/`（中文），
`?selfcheck` 对两者都可用。注意 `npm run preview` 是 SPA 兜底，`/zh`（少斜杠）和任意错路径都会
返回 200 英文页；`trailingSlash` 归一与真 404 是 Vercel 侧行为，本地看不出差异。

## 架构

画面分三层，层级由 `src/styles/tokens.css` 里的 `--z-*` 决定：

| 层 | 技术 | 文件 |
|---|---|---|
| 背景弹幕 | CSS 关键帧 + DOM | `src/components/Marquee.tsx` |
| 角色 | Live2D Cubism 4（Pixi WebGL） | `src/character/Live2DStage.tsx` |
| 点击反馈 | 单个全屏 Canvas 2D | `src/fx/` |

拆三层的原因是氛围弹幕必须位于角色**之后**、被角色遮挡，全 Canvas 做不到 z 轴穿插。

两条通道严格分离：

- **React 只管结构**。只在离散状态迁移时重渲染（心情、静音、档位、首访门），低于 5 次/秒。
- **命令式运动层只管每帧**。`rig.ts`（视线超前、眼睑遮罩、挤压脉冲）与 `ParticleLayer` 的 rAF 循环都不 `setState`，直接写参数或画布。呼吸由 Cubism 框架的 `CubismBreath` 驱动（实测 `ParamBreath` 0→0.25、周期约 4.2s），眨眼由动作文件自己烘焙，见下条。

由此推出一条硬规则：**一个属性只能有一个写入者**。被 rig 每帧写入的 parameter 不允许再有 CSS/关键帧动它，否则后写入的一方永远赢——旧站 `.ciallo:hover{transform:scale()}` 就是被运行中的关键帧永久覆盖的死代码。

同一条规则在眼睛上实测到两次：`exp_03` 写的是 `ParamEyeLOpen = 0 Multiply`，叠在眨眼上直接把眼睑乘到 0，实测 idle 下 150 帧里 149 帧她是闭眼的；以及 rig 自己排了一次 150ms 的播种眨眼，而 Mao 的动作文件本来就烘焙了眨眼（`mtn_01` 一个 5.57s 循环里闭两次），两者叠加成约 1.6s 一次。现在眨眼归动作，rig 只保留乘性的眼睑遮罩（drowsy 0.25 / asleep 0），既不抢写入者，又仍然压得住表情。

输入只有一条路径：`src/lib/input.ts` 绑 `pointerdown` / `pointermove`，坐标只用 `clientX/clientY`，不 `preventDefault()`（改用 CSS `touch-action`）。唯一的「不响应」分支是元素带 `data-no-spawn`（HUD、弹窗、署名链接）。键盘是第二条入口，且**必须挂在 `window` 上**：`.l2d-figure` 上面盖着全屏 canvas，它永远不会成为 pointerdown 的 target，也就永远拿不到焦点，挂在其上的 keydown 是收不到事件的死代码。页面级监听同时带一个守卫 —— 焦点在 `a[href]/button/input/textarea/select/[contenteditable]` 上时空格与回车归该控件，否则静音键和首访门都会被键盘抢不走（T16 正反两面都在断言这件事）。

命中判定**不能**走 `model.hitTest()`。pixi-live2d-display 用 `this.hitAreas[def.name] = def` 建命中表（`cubism4.es.js:4329`），而 Mao 的 `model3.json` 里两条 `HitAreas` 的 `Name` 都是空串，于是 `HitAreaHead` 与 `HitAreaBody` 撞进同一个 `""` 键、只剩后者，`hitTest()` 恒返回 `[""]`。当时接它的 `asHitArea` 只认 `'head'|'body'`，所以「点她本人效果更明显」这一档、`TapHead`/`TapBody` 动作和受力抖动**一次都没有真正触发过**，而首访门的文案一直在承诺这件事——`HitAreaHead`/`HitAreaBody` 在 moc3 里各出现 1 次、且 Part 一律叫 `Part`/`PartArmLA` 这种名字，说明它们是官方样例惯用的隐形命中 drawable，`getDrawableIndex` 有效，坏的只有 `Name` 这一个字段。现在改成按 `Id` 取 drawable bounds 自己判（`live2d.ts` 的 `hitAreaFromModel`），并且调用前必须先跑 `toModelPosition`：容器像素不是模型画布单位，库自己的 `Live2DModel.hitTest` 也是先变换再比对。T16 守的就是这条路径。

视口是连续量不是布尔：`scale = clamp(sqrt(w*h)/sqrt(1440*900), 0.55, 1.35)`，角色尺寸、标签字号、粒子上限、弹幕字号全部乘它。尺寸、输入能力（`pointer: coarse`）、性能是三根互相独立的轴，旧站用一个 `innerWidth<=768` 同时当三者用，分屏窗口下必然误判。

`--scale` 由 `src/lib/viewport.ts` 单点写入，且**模块初始化时就要写一次**：`publish()` 只从 resize 事件里跑，没人调整大小的会话会一直用 `tokens.css` 的默认值渲染整页——截图里就是一排排文字撞在一起。T8 因此不只看 JS 里的数，而是把 CSS 变量读回来比对。弹幕的上下留白带同理写成 `calc(170px * var(--scale))` 而不是百分比：wordmark、HUD、署名都是随 `--scale` 长大的文字，百分比带不会。

## 相对旧版修掉的实测缺陷

| 旧站实测 | 现在的做法 |
|---|---|
| 连点 20 次新增元素 **0 个**（节流 + 并发上限直接 `return`） | 对象池满时把最旧的几条寿命压到 0.15s 让它们**淡出**，不接受任何点击丢弃；`spawned` 计数等于点击数 |
| 单击偏移 16–104px，连点最大 284px（`findSafePosition` 车道冷却） | 标签坐标严格等于 `clientX/clientY`，只给一个**远离角色中心的初速度**让它自己飘开 |
| 10 个前景色对背景对比度全 <2.1，`#f7dc6f` = **1.00**（物理隐形） | `src/palette.ts` 逐色算过，最低 4.41:1；标签绘制**只有描边这一条路径**，没有免描边的快路径 |
| 弹幕 8 条字号全同（CSS `!important` 覆盖内联字号） | 字号由 `--scale × --k` 推导，无 `!important`，8 档 8 色无重复 |
| 弹幕每循环约一半时间整个在屏外 | 位移距离改成「自身宽度 + 一个视口」，起终点都在屏外 |
| 语音 1.177s 每次 `currentTime=0` 硬切，连点像卡带 | 280ms 重触发闸门 + 相位淡出 + `playbackRate` 0.94/1.0/1.06 轮转 + 随机 pan ±0.35 |
| 欢迎弹窗每次都弹，音频只在弹窗里初始化 → 回访用户永久无声 | 弹窗只在首访（`ciallo.seen`）；音频解锁挂在**任意**手势的捕获阶段，与弹窗无关 |

## 音频

```
AudioBufferSource ─┐
Oscillator blip ───┼→ 各自 gain → masterGain(0.22) → DynamicsCompressor(-10/24/8) → destination
```

合成 blip 是「点击必有声音」的主保障，`public/meguru.aac` 的语音是增强：那是一段裸 ADTS AAC，Firefox 对裸 ADTS 的 `decodeAudioData` 历史上不稳，所以解码走 Promise → catch → 回调 → catch → `audioMode='synth-only'`。`src/audio/source.ts` 的候选顺序是 `/meguru.mp3` → `/meguru.aac`，日后往 `public/` 放一个 mp3 就自动生效，不需要改代码。

语音上限 4 声部、blip 12、chime 4，超限抢占最旧（25ms 淡出）而不是丢弃；节点 `onended` 里显式 `disconnect()`。静音用 `setTargetAtTime(0, now, 0.02)`，绝不 `gain.value = 0`（任意相位切断就是那声「咔」）。

## 自检

打开 `?selfcheck` 会在左下角跑一页内断言（`src/dev/selfCheck.ts`），数值同时 `console.table`。断言项十六：对比度、点击偏移必须为 0、同毫秒 200 连点全部被接受、池满时 `recycled` 递增但最新标签仍存活、帧成本、弹幕 8 档 8 色且背景不空窗、语音闸门、连续缩放区间、reduced-motion、StrictMode 下「一次点击 = 一个标签 + 一个 blip」、点击真的推出了声波、弹幕不穿过 wordmark/HUD/署名、静息帧里她的眼睑确实是睁开的、`<html lang>` 与路径派生的语言一致且中英两份字典 key 对齐、字标的子集字体确实 `loaded` 且波浪号在 `unicode-range` 里、键盘空格必须每一次都真的变成她身上的 tap（头/身两种动作都到得了，且焦点在控件上时不许抢）。探测第一步是先点「进入」把首访弹窗关掉再量——弹窗是带 `data-no-spawn` 的模态层，对着它跑只会量到一排「按设计拒绝」，而 `ciallo.seen` 按 origin 存，换一个 dev 端口就是一次首访。除 T5、T11、T13、T15 外其余十二项在同一趟同步流程里跑完，所以它们的读数与窗口是否在绘制无关。

刻意偏离原方案的这几处，都是为了量到真东西：

- **T5 断言的是应用自己的帧，不是紧循环里的假帧**。纯池运算（`fx.update` 单独计时）p95 ≤ 1ms 是硬断言，实测 0.2–0.8ms，任何环境都稳定。真正对预算的那个数来自 rAF 循环：`ParticleLayer` 在 `?selfcheck` 下记录每帧 `update+draw` 的实际耗时，T5 清空缓冲、以 ≈6 次/秒（一个人维持得住的连点）点 1.3 秒，再取这段真实帧的中位数对上 `3.0 / 4.5 / 7.0ms` 的档位预算。紧循环那趟（每步一次点击，≈12 倍人手速度）只报中位数、不断言，因为它从不把主线程交还合成器，尾巴量的是被强制的 GPU flush 而不是卡顿。窗口不绘制时根本没有 rAF，T5 就明说「几帧都没画、这里量不了」，而不是拿一个虚高的数冒充结论，也不是悄悄跳过。
- **T11 量输出，不量「节点已经排上了」**。`?selfcheck` 下 master 链改成 compressor → AnalyserNode → destination（多一个透明节点，不是第二条会让声音翻倍的路径），连点 400ms 内取最新块 peak/rms 的最大值，必须离开数字静音（三趟 master peak 0.268 / 0.319 / 0.334、rms 0.079 / 0.087 / 0.102——绝对数随机器走，断言只看是否离开静音）。解码完成的录音本身也单独算一遍 peak/rms（实测 0.878 / 0.138，1.24s），因为「解码成功」和「有内容」是两件事。上下文没在跑时只报状态不判失败——后台标签页会被 `attachAudioLifecycle` 挂起，那里静音是正确行为。
- **T13 只能在 `beforeModelUpdate` 里读眼睑**。核心求值后会把 parameter 恢复成求值前存下的草稿（`saveParameters` / `loadParameters`），所以帧间轮询读到的是动作的半成品，不是动作、表情、眼睑遮罩三方商量完的结果——同一个坑曾把视线跟随误判成坏的，改成帧内采样后 `ParamEyeBallX` 实测跨 −1.00…0.83、`ParamAngleX` 跨 −30.0…22.5。采样还要过两道门：心情得是 idle/wake（happy 是故意的 ^_^ 眯眼，boot 还在进场路上），并且库的 `motionManager.state.currentGroup` 得是 Idle。第二道门是必需的——自检自己的音频解锁点击落在她身上，会起一段 3.5–9.4s 的动作，而引发它的心情不到 1.6s 就过期，于是早先两次读数（74/98、234/296 睁）测的其实是 `TapHead[2]` 那条 9.23s 里闭眼 8.36s 的曲线，不是她静息的眼。等动作最多 12s，等不到就报出组名而不是继续采样。窗口取 6s，装得下一整个 `mtn_01`（5.57s）还多出 0.43s。把这条曲线的 `Segments` 按 Bezier 逐段积一遍：每次眨眼把双眼压到 0.5 以下约 150ms，一圈两次，合计 0.301s = 5.4%；因为窗口比一圈长，按起始相位会抓到 2 或 3 次眨眼，所以一趟干净采样的**预测区间是 92.4%–94.6%**，而不是一个点。判定是「双眼都 ≥ 0.5」，地板 85%（对两个端点都留了余量），所以这条只声明「她会睁眼」，不声明「从不眯眼」；中英两个入口各一趟，338/368 = 91.8% 与 335/362 = 92.5%，即 30 与 27 个闭眼帧——三次眨眼那一档（预测 27.7 帧），数得上；两趟都是 `0 frames skipped`，整段窗口都在 Idle，没有污染帧。反向对照把 `exp_03` 强推上去，1310 静息帧只有 16 帧睁眼（1.2%）判失败——一条不会红的断言不算断言。
- **T14 断的是「页面自己声称的语言」**。`document.documentElement.lang` 必须等于路径派生出的 `LOCALE` 对应的 BCP 47 标签，中英两份 `STRINGS` 的 key 集合必须完全相等且没有空串，`.lang-switch` 的 `href` 必须正好是另一语言的路径。这三件事任何一件飘了，线上看到的就是「英文壳里塞中文」或者 hreflang 指向一个自己不认识的语言。
- **T15 盯的是「字体静默回退」**。`document.fonts.load('900 1em "Ciallo Wordmark"', <字标实际文本>)` 必须返回至少一个 `status === 'loaded'` 的 face，且文本里的波浪号必须是 `U+FF5E`。传真实文本而不是写死字符串，是因为 `unicode-range` 只覆盖六个字形：字标哪天改字、或者有人把 ～ 打成形同的 〜（`U+301C`），匹配到的 face 数就变成 0，页面照常渲染、只是回退成雅黑，控制台一声不响。这条断言是这两个失败模式的唯一出口。
- **T16 用合成 `keydown` 驱动键盘路径，而不是直接调用落点函数**。直接调函数看不见这条断言存在的理由：处理器原先挂在 `.l2d-figure` 上，而全屏 FX canvas 盖在它上面，pointerdown 的 target 永远是 canvas，那个元素在正常游玩中根本拿不到焦点 —— 于是没有键盘事件会到它那儿，其余各层却全都健康得很。现在 40 次 `space` 打在 `document.body` 上，必须每次都产出一个 tap；再查落点质量（`area` 为空 0 次、头与身都得有、至少 28 个不同坐标，全同点即说明退回了兜底中心）；最后反向查一遍：焦点在静音键上时空格必须**不**产生 tap，否则等于用页面级监听换掉了控件的键盘激活。
- **T6 用 `Animation.currentTime` 虚拟扫时间**，60 秒的周期在几十次强制布局里走完，扫完立刻把相位还原，屏幕上的弹幕不会跳。它不靠计时器（后台标签页的计时器被钳到 1 秒一次），并且如果扫描根本没让车道移动，它会拒绝判过而不是拿一个瞬间冒充 100% 覆盖率。
- **不做 `HTMLAudioElement` 兜底，也不做 Canvas 不可用时的 DOM 兜底**。合成 blip 已经保证任何点击有声，而这两条降级路径在本机无法验证、针对的是如今不存在的浏览器；留着只会多一堆永远不被执行的分支。

之前挂着「只有窗口真的绘制才能定论」的数都已经有浏览器读数了，而且中英两个入口各跑了一趟 `npm run preview`，16/16 全绿（531x570、dpr 1.25、`coarse=false`、角色完整在框内）。逐条落地的有：**T12** 8 条车道对着 3 块 chrome 矩形、0 次穿越；**T14** `/zh/` 读到 `<html lang="zh-Hans">` 与路径派生的 `LOCALE` 一致、`/` 读到 `lang="en"`，两份字典 15/15 key 对齐，切换链接分别指向 `/` 与 `/zh/`；**T15** `1 face(s) loaded`、波浪号 `U+FF5E`、文本 `Ciallo～`，两入口一致；**T16** 40 次空格全部变成一个 tap、0 次落在她之外、36 个不同坐标、**头 16 / 身 24**，且焦点在静音键上时空格没被抢走。头与身两种动作都到得了，命中判定那处按 `Id` 比对 `getDrawableBounds` 的修复到此才算被感知证据确认——在那之前它只有静态依据（库源码的建表方式、`model3.json` 里两个空 `Name`、moc3 里 `HitAreaHead`/`HitAreaBody` 各一次）。仍然不可比的是绝对数：帧成本随机器走（T5 那 1.3–1.4ms 中位数、p95 1.8–2.2ms 来自 531x634 窗口的 53 个绘制帧，这两趟未复量），而在不绘制的窗口里 T5、T11、T13 会直说「没画、未定」，不会顺手记一个通过。

性能预算与禁令写在代码注释里，改动 `src/fx/` 前先读：循环内禁 `shadowBlur` / `ctx.filter`（辉光是启动时预烘焙的径向渐变离屏 canvas + `drawImage(..., 'lighter')`）、禁每帧 `measureText`、禁每帧读布局、`dpr` 钳到 2。

## 降级档位

`?tier=full|reduced|compact` 手动覆盖并写进 `localStorage` 的 `ciallo.tierForced`；帧时看门狗（每 3 秒至多一步，同一次会话降过不再升回）只在**本次会话**生效，不落盘。之前它也写 `ciallo.tier`，配上「降过不再升回」等于一次偶发卡顿（比如恰好在大后台标签页里量到虚高的绘制耗时）就把之后每次访问都永久钉在低档。降档只收紧软上限、不重新分配数组，所以画面上的粒子照常淡出而不是消失。

## 无障碍

角色层与粒子层 `aria-hidden`，角色本体 `role="img"` 且可聚焦，`Space`/`Enter` 等价于点她额头——键盘用户有替代路径。HUD 的 combo 用 `aria-live="polite"` 且只在 5/10/20/50 阈值播报。`prefers-reduced-motion` 下保留表情与状态切换（那是状态不是动画），关掉呼吸/呆毛/zzz 位移与粒子拖尾，弹幕改成静态排布而不是整条消失，点击只出 1 个环 + 1 个原地淡出的标签。

## 素材与署名

角色是 Live2D 官方免费素材 **Niziiro Mao**（`public/live2d/mao/`，含 Cubism Core `live2dcubismcore.min.js`），页脚 `src/components/Credits.tsx` 按要求保留：

> This content uses sample data owned and copyrighted by Live2D Inc.

`public/meguru.aac` 是站点原有的语音素材，保持不动。Mao 压缩包自带的 sound 数据不含 Ciallo 台词，已从仓库排除，不要补进来。

字标 **Ciallo～** 用 **Zen Maru Gothic 900**（OFL 1.1，授权文本随附于 `public/fonts/OFL.txt`，线上可访问 `/fonts/OFL.txt`），只取 `C i a l l o ～` 六个字形，裁完 1164 字节，落在 `src/styles/fonts/ciallo-wordmark-900.woff2`。低于 Vite 的 4096 内联阈值，因此以 data URI 打进带 hash 的 CSS：不多一个请求，也不存在回退字体被看到的一瞬。

不引 Google Fonts `<link>`：`/zh/` 面向国内访问，`fonts.googleapis.com` 在那边解析不了，引了等于中文用户永久看到雅黑，而且不会报错。**改动字标文字后要重取子集**，注意码位——项目里用的是 `U+FF5E`（～），不是长得一样的 `U+301C`（〜），`@font-face` 的 `unicode-range` 只覆盖前者，写错那个字符会静默掉出字体之外（自检 T15 就是盯这件事的）：

```bash
curl -A "<Chrome UA>" "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@900&text=Ciallo%EF%BD%9E&display=swap"
```

## 双语与 SEO

两种语言是两条 URL，不是一个开关：`/` 是英文，`/zh/` 是中文，由 Vite 的多入口构建各自产出
一份 HTML（`index.html` 与 `zh/index.html`，见 `vite.config.ts` 的 `rollupOptions.input`），
共用同一份 JS bundle。语言在运行时从路径派生（`src/i18n.ts` 的 `LOCALE`），**不读
localStorage**——存了偏好就可能让 `/` 在 `<html lang="en">` 下渲染中文，这正是爬虫和读屏都
要罚的自相矛盾。语言切换是一个普通 `<a href>`（`src/components/LanguageSwitch.tsx`），带
`hreflang`/`lang`，不加 `data-no-spawn` 就会在切语言时顺手炸一屏粒子。

文案只翻界面壳：HUD 的连击/最高/音效、首访门、载入失败、错误边界、读屏文案，全在
`STRINGS` 里，中英 key 必须一一对齐。弹幕（`お嬢様～`、`巡です、巡です～`、`Peach～？`）是
角色台词不是界面文字，两种语言共用、不翻——翻了就不是那个梗。页脚署名保持 Live2D 官方英文
原句，不改写。

SEO 侧刻意做的事与刻意不做的事：

- 两个入口各写自己的 `canonical`、`og:url`、`og:locale`（+ `og:locale:alternate`），并互相
  声明 `hreflang`（`en` / `zh-Hans` / `x-default`），三条一组、双向对称。
- **没有 `og:image`，`twitter:card` 是 `summary` 而不是 `summary_large_image`**：卡片图只接受
  这一页真实渲染出来的截图。声明一个不存在的 `/og.png` 不是中性的——认 `og:image` 的爬虫会去
  取它、拿到 404，然后回落到无图，标签于是成了超额承诺。补真图时按 1200×630 / DPR 1 截
  （DevTools 设备工具栏自定义视口，该尺寸下 `--scale ≈ 0.764`，她与弹幕、HUD 都在画内），
  同时把 `og:image:width/height` 与像素对齐。
- `robots` 带 `max-image-preview:large`；`public/robots.txt` 指向 `public/sitemap.xml`，
  sitemap 里每条 URL 都带全三个 alternate。
- `<noscript>` 写的是真实内容而不是「请开启 JS」，顺带保证 Live2D 署名在脚本失败时仍在场。
- JSON-LD `WebSite` + `inLanguage`，`workTranslation` 指向另一语言。
- `vercel.json` 设 `trailingSlash: true`，让 `/zh` 归一到 `/zh/`，避免两条 URL 同时可访问造
  成重复内容；`/assets/*` 带 hash，给一年 `immutable`，HTML 走 Vercel 默认的
  `must-revalidate`。
- **不做** 按 `Accept-Language` 的内容协商跳转：爬虫只看到单一变体，缓存和排名都会被污染。
- **不做** SPA catch-all（把所有路径 rewrite 到 `/index.html`）：那会让每个错链都返回 200
  英文页，等于一片软 404。改配 `public/404.html`（`noindex, follow`，中英各一条链接）。
- 根页语言从中文换成英文是这次的决定，代价是已收录的 `/` 换了内容语言，靠 hreflang 组 +
  `x-default → /` 把关系重新声明清楚。

## 部署

Vercel（`vercel.json` + `public/CNAME`，域名 ciallo.de），构建 `npm run build` 产出
`dist/`（两份 HTML + 共享 chunk + `public/` 原样拷贝的 `robots.txt`/`sitemap.xml`/
`404.html`/`CNAME`）。原先的 `.github/workflows/deploy.yml` 已删除：它推 `FOLDER: build`
而 Vite 产物是 `dist/`，远端也没有它要推的 `pages` 分支，从未成功跑过，留着只会让人以为有
第二条流水线。
