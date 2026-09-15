# 产品需求文档（PRD）V4.0

**产品名**：一念（Yi Nian）
**Slogan**：把每个念头，慢慢变成生活
**包名**：com.yinian.app
**版本历史**：
- V4.0（2026-09-02）：新增时间胶囊模块、数据备份功能、子任务界面统一
- V3.0：基础功能完善

## 一、产品定位

「一念」是一款本地优先的生活管理工具，将灵感记录、游戏管理、目标管理、习惯打卡等日常需求整合在一个 App 中。用户可以自由启用/禁用各功能模块，打造个性化的首页。

## 二、全局架构

### 2.1 底部 Tab 导航（三个 Tab）

| Tab 图标 | Tab 名称 | 核心职责 |
| --- | --- | --- |
| ⌂ | 应用 | 首页模块网格入口，点击进入各功能模块 |
| ◈ | 回忆 | 全局回忆录，展示已完成的生活成就和已通关的游戏 |
| ● | 我的 | 自定义首页应用、标签管理、游戏平台管理、数据备份 |

### 2.2 首页（HomeScreen）
- **品牌区域**：顶部展示「一念」品牌标识和问候语
- **模块网格**：以 2 列卡片网格展示已启用的功能模块，每张卡片固定占 47% 宽度
- **可用模块**（共 6 个，均可在「我的」中启用/禁用/排序）：
  - 🎲 惊喜盒子 — 灵感盲盒，随机抽取想法
  - 🎮 游戏殿堂 — 管理你的游戏库
  - 🎯 扔骰子 — 随机决定一件事
  - 📋 目标管理 — OKR 目标与关键结果
  - ✅ 习惯打卡 — 每天坚持好习惯
  - ⏳ 时间胶囊 — 给未来的自己留个信
- **模块切换器（ModuleSwitcher）**：各模块内部顶部显示横向模块标签栏，可快速切换到其他模块

### 2.3 导航结构

```
NavigationContainer
└── Tab.Navigator (底部三 Tab)
    ├── Home (Tab, 无标题栏)
    │   └── HomeStack (动态 Stack)
    │       ├── Home (首页模块网格)
    │       ├── inspiration → InspirationNavigator
    │       │   ├── BoxList (惊喜盒子首页)
    │       │   └── BoxDetail (盒子详情)
    │       ├── game → GameNavigator
    │       │   ├── GameList (游戏殿堂首页)
    │       │   ├── GameDetail (游戏详情)
    │       │   └── GameForm (新增/编辑游戏)
    │       ├── dice → DiceNavigator
    │       │   └── DiceMain (扔骰子)
    │       ├── okr → OKRNavigator
    │       │   ├── OKRList (目标管理首页)
    │       │   └── OKRDetail (目标详情)
    │       └── habit → HabitNavigator
    │           └── HabitMain (习惯打卡)
    │       └── timeCapsule → TimeCapsuleNavigator
    │           ├── TimeCapsuleMain (时间胶囊列表)
    │           ├── TimeCapsuleForm (新建/编辑胶囊)
    │           └── TimeCapsuleDetail (胶囊详情)
    ├── Memoir (Tab, 标题「回忆」)
    └── Profile (Tab) → ProfileNavigator
        ├── ProfileMain (我的首页)
        ├── TagManage (标签管理)
        └── PlatformManage (游戏平台管理)
```

---

## 三、模块一：惊喜盒子

### 3.1 盒子列表首页（BoxListScreen）
- **卡片列表**：展示所有盒子，每张卡片包含：
  - 盒子图标（可选，16 种预设图标）
  - 盒子名称
  - 想法条数（如 "5 条想法"）
  - 🎲 快速随机按钮（不进入盒子即可抽取）
- **创建盒子**：弹窗输入盒子名称 + 选择图标
- **左滑操作**：PanResponder + Animated 实现左滑露出操作按钮
  - ✏️ 编辑：修改盒子名称/图标
  - 📋 复制：复制盒子及其所有想法
  - 🔄 待办模式切换：切换盒子的 todo_mode
  - 🗑️ 删除：二次确认后删除盒子及其所有想法
- **进入盒子**：点击卡片进入盒子详情页

### 3.2 盒子详情页（BoxDetailScreen）
- **想法列表**：展示当前盒子内所有想法，按存入时间倒序
- **想法卡片**：内容文本、标签小药丸、附件缩略图、权重角标
  - 已禁用的想法半透明显示，不参与抽取
  - 已完成的想法单独展示在「已完成」区域
- **添加想法**：底部输入区
  - 文本输入：回车即存
  - 图片输入：拍照或相册选取
  - 标签系统：空格分隔，支持多标签（从全局标签库选择）
- **随机抽取**：「🎲 抽一个」按钮
  - 仅从 pending + 未禁用的想法中抽取
  - 抽取弹窗展示结果卡片
  - 🔁 换一个 / 🛋️ 改天再说 / ✅ 搞定了
  - 「搞定了」→ 标记完成 + 归档到回忆录
- **每日抽取（daily_draw）**：每天自动从盒子中抽取一条想法并记录
- **左滑操作**：想法卡片支持左滑
  - ✏️ 编辑想法
  - 🚫 禁用/启用想法
  - 🗑️ 删除想法

### 3.3 导航
```
InspirationStack
├── BoxList（盒子列表首页）
└── BoxDetail（盒子详情，接收 boxId + boxName）
```

---

## 四、模块二：游戏殿堂

### 4.1 游戏列表首页（GameScreen）
- **状态 Tab**：全部 / 在玩 / 想玩 / 已通关 / 弃玩（4 种互斥状态）
- **排序**：最近更新 / 游玩时长 两种排序切换
- **视图切换**：
  - 在玩/想玩 → 3 列网格（封面图 + 游戏名）
  - 已通关/弃玩/按游玩时长排序 → 单列列表
- **随机抽取**：「🎲 今晚玩哪个」按钮，从「想玩 + 在玩」中随机抽取
- **新增游戏**：右上角 ＋ 按钮，跳转 GameFormScreen
- **进入游戏**：点击卡片进入 GameDetailScreen
- **删除游戏**：长按卡片，二次确认

### 4.2 游戏表单（GameFormScreen）
支持新增和编辑，字段如下：
- **必填**：游戏名称
- **选填**：
  - 封面图片（拍照/相册，置于游戏名称下方）
  - 平台（从全局游戏平台 标签库选择，多选）
  - 状态（在玩 / 想玩 / 已通关 / 弃玩）
  - 标签/类型（从全局标签库选择）
  - 评分（五星制，支持半星，如 4.5）
  - 游玩时长（计时器自动记录，也可手动输入秒数）
  - 锐评（一句话短评）
  - 最后游玩日期（日期选择组件：◀ 前一天 / 后一天 ▶ + 清除）

### 4.3 游戏详情页（GameDetailScreen）
包含以下板块，垂直排列：

**A. 基础信息区**
- 封面大图、游戏名称、平台标签、类型标签
- 评分（星星展示）、状态、游玩时长、锐评、最后游玩日期

**B. 计时器**
- 开始/停止计时按钮
- 计时中显示已用时间（HH:MM:SS）
- 后台通知实时显示计时（expo-notifications）
- 停止后自动累加到游戏总时长 + 记录游戏记录

**C. 进度任务**
- 每条任务：名称 + 进度条 + 备注
- 支持新增、编辑进度、删除、勾选完成
- 与 OKR 任务可双向同步（OKR 任务 → 游戏进度，通过 source_kr_id 追踪）

**D. 游戏目标（game_objectives）**
- 阶段性目标（如"全收集"、"通关困难模式"）
- 支持新增、完成/取消、删除

**E. 游戏记录（时间轴）**
- 按时间倒序展示游戏日志
- 每条记录包含内容和时间
- 支持新增和删除

### 4.4 导航
```
GameStack
├── GameList（游戏殿堂首页）
├── GameDetail（游戏详情，接收 gameId）
└── GameForm（新增/编辑游戏，可选传入 gameId）
```

---

## 五、模块三：扔骰子

### 5.1 功能说明（DiceScreen）
- **骰子数量选择**：1~6 个骰子可选
- **骰子展示**：使用 View 绘制真实骰面点数（1-6 点）
- **扔骰子**：点击大按钮触发，80ms 间隔快速滚动动画，约 0.64 秒后停止
- **结果展示**：显示每颗骰子结果 + 总计点数
- **历史记录**：保留最近 10 次投掷结果

---

## 六、模块四：目标管理（OKR）

### 6.1 目标列表首页（OKRListScreen）
- **操作按钮**：「＋ 新周期」「＋ 新目标」
- **全目标列表**：展示所有活跃周期下的全部目标（SQL JOIN 跨周期查询）
- **目标卡片**：
  - 周期名标签（橙色小标签）+ 剩余天数
  - 目标名称（全部完成时 🎉 标记）
  - ✏️ 编辑按钮 → 弹出编辑弹窗修改名称
  - 🗑️ 删除按钮 → 二次确认后删除目标及所有任务
  - 长按也可触发删除
  - 任务完成数（x/y）+ 进度条 + 进度百分比
- **新建周期弹窗**：周期名称 + 开始日期 + 结束日期（日期选择组件）
- **新建目标弹窗**：目标名称 + 所属周期选择器（横向芯片）+ 关联游戏选择器（可选）

### 6.2 目标详情页（OKRDetailScreen）

**A. 顶部进度区**
- 进度百分比 + x/y 任务已完成 + 进度条
- 「＋1 进度」大按钮（自动给第一个未完成的重复任务 +1，或完成第一个普通任务）
- 全部完成时显示「🎉 全部完成」

**B. 目标操作按钮行**
- ✏️ 编辑 — 修改目标名称
- ⏸ 暂停 / ▶️ 继续 — 切换暂停状态
- ✅ 完成 — 标记目标已完成
- 🗑️ 删除 — 删除目标及所有任务，返回列表

**C. 任务列表**
- 父任务卡片：勾选完成 / 重复模式（🔁 + 进度数值 + 单位）/ +1 按钮 / 删除
- **子任务**：每个父任务下可添加子任务（＋ 子任务 按钮）
  - 显示子任务计数（🔗 x/y 子任务）
  - 展开/折叠查看子任务列表
  - 子任务可单独完成/删除
  - **子任务创建界面与主任务一致**：点击“＋ 子任务”跳转到 OKRTaskFormScreen，支持配置日期、循环、目标值等所有字段
- **任务排序**：默认 / 名称 / 进度 三种模式切换
- **任务上下移动**：每个任务卡片支持手动调整顺序

**D. 日历活动区**
- 月历视图，标记有活动的日期
- 点击日期查看当天活动详情

**E. 状态影响 UI**
- 暂停时：标题旁显示「⏸ 已暂停」标签，＋1 按钮变灰
- 完成时：标题旁显示「✅ 已完成」标签，隐藏「完成」按钮

### 6.3 OKR 数据模型
```
周期（okr_periods）
  └── 目标（okr_objectives）—— 可关联游戏（game_id）
        └── 关键结果/任务（okr_key_results）
              ├── parent_id → 支持子任务
              ├── repeat_mode → 重复任务（每日 +N 模式）
              ├── sort_order → 手动排序
              └── source_type/source_id → 游戏同步追踪
```

### 6.4 游戏同步
- 目标关联游戏后，创建任务自动同步到 game_progress
- 通过 source_kr_id 追踪来源，避免重复
- 删除任务时自动清理对应的游戏进度

### 6.5 导航
```
OKRStack
├── OKRList（目标管理首页）
└── OKRDetail（目标详情，接收 objectiveId + objectiveTitle）
```

---

## 七、模块五：习惯打卡

### 7.1 功能说明（HabitScreen）
- **习惯列表**：展示所有习惯，每个习惯显示名称 + 图标 + 累计打卡次数
- **创建习惯**：弹窗输入名称 + 选择图标（16 种预设图标）
- **每日打卡**：点击习惯卡片上的按钮完成今日打卡
- **日历视图**：月历展示打卡记录，标记已打卡的日期
- **删除习惯**：二次确认后删除习惯及其所有打卡记录

---

## 八、模块六：时间胶囊

### 8.1 功能说明（TimeCapsuleScreen）
- **胶囊列表**：展示所有时间胶囊，按开启日期排序
- **胶囊卡片**：
  - 标题 + 状态徽章（🔒 X天后开启 / 🔓 可开启 / ✅ 已开启）
  - 开启日期 + 内容预览（前50字）
  - 语音提示（🎤 包含语音）
- **新建胶囊**：右上角 ＋ 按钮，跳转 TimeCapsuleFormScreen
- **进入详情**：点击卡片进入 TimeCapsuleDetailScreen
- **删除胶囊**：长按卡片，二次确认

### 8.2 胶囊表单（TimeCapsuleFormScreen）
支持新建和编辑，字段如下：
- **必填**：胶囊标题
- **选填**：
  - 文字内容（多行文本输入）
  - 语音留言（录音功能）
    - 🎙 开始录音 → 录音中显示时长 → ⏹ 停止
    - 录音完成后可 ▶️ 播放预览 / 🗑️ 删除重录
  - 开启日期（日期选择组件，默认7天后，不能早于今天）

### 8.3 胶囊详情页（TimeCapsuleDetailScreen）
包含以下板块：

**A. 头部信息区**
- 胶囊标题
- 未到期时：倒计时卡片（大数字 + “天后开启”）
- 可开启时：🔓 开启胶囊 按钮
- 已开启时：✅ 已开启 标记

**B. 元数据区**
- 创建日期、开启日期、状态

**C. 内容区**（仅开启后可见）
- 💌 文字内容（完整显示）
- 🎤 语音留言（▶️ 播放语音 按钮）

**D. 操作按钮**
- 未开启时：✏️ 编辑 按钮（可修改内容和开启日期）

### 8.4 技术实现
- **音频录制**：expo-av（Audio.Recording）
- **音频播放**：expo-av（Audio.Sound）
- **文件存储**：expo-file-system/legacy（cacheDirectory）
- **录音格式**：m4a 高质量格式
- **权限请求**：Audio.requestPermissionsAsync()

### 8.5 导航
```
TimeCapsuleStack
├── TimeCapsuleMain (时间胶囊列表)
├── TimeCapsuleForm (新建/编辑胶囊，可选传入 capsuleId)
└── TimeCapsuleDetail (胶囊详情，接收 capsuleId)
```

---

## 九、回忆录（MemoirScreen）

### 9.1 数据来源
自动汇集两处数据：
- 惊喜盒子中点击「✅ 搞定了」的条目（source_type = 'life'）
- 游戏殿堂中状态切换为「已通关」的游戏条目（source_type = 'game'）

### 9.2 展示形式
- **日历视图**：月历展示，标记有记录的日期
- **点击日期**：展示当天的回忆条目
- **未选日期时**：展示全部回忆条目
- **条目卡片**：生活成就用 🎯 标识；游戏通关用 🎮 标识
- **删除记录**：长按条目可删除（游戏类型调用 unclearGame 恢复为非通关状态）

---

## 十、我的（ProfileScreen）

### 10.1 自定义首页应用
- 展示所有 6 个模块的开关列表
- 支持启用/禁用模块（至少保留 1 个）
- 支持上移/下移调整顺序
- 保存后立即生效，首页网格实时更新
- 提供「恢复默认」按钮（默认启用：惊喜盒子、游戏殿堂、扔骰子、目标管理）

### 10.2 标签管理（TagManageScreen）
- 管理全局标签（global_tags 表）
- 按模块分组：惊喜盒子 / 游戏殿堂 / 目标管理
- 支持新增和删除标签
- 各模块的输入框可从中选择标签

### 10.3 游戏平台管理（PlatformManageScreen）
- 管理游戏平台标签（game_platform 模块）
- 预设平台：NS / PS5 / Xbox / PC / 手机
- 支持自定义新增和删除

### 10.4 数据备份（BackupScreen）
**功能说明：**
提供完整的数据导出和导入功能，确保用户数据安全。

**A. 导出数据**
- **操作方式**：点击“开始导出”按钮
- **导出内容**：所有模块的完整数据（17个表）
  - 惊喜盒子：boxes, life_items, daily_draw
  - 游戏殿堂：game_items, game_progress, game_records, game_objectives
  - OKR目标：okr_periods, okr_objectives, okr_key_results, okr_activity_log
  - 习惯打卡：habits, habit_logs
  - 时间胶囊：time_capsules
  - 回忆录：archived_items
  - 系统设置：app_settings, global_tags
- **文件格式**：JSON 格式，UTF-8 编码
- **文件命名**：`oneday_backup_YYYY-MM-DD.json`（如 oneday_backup_2026-09-02.json）
- **分享方式**：使用 expo-sharing 调用系统分享面板
  - 可保存到本地文件管理器
  - 可发送到邮箱、微信、QQ等
  - 可上传到云盘（百度网盘、iCloud等）
- **状态提示**：导出中显示“导出中...”，完成后弹出成功提示

**B. 导入数据**
- **操作方式**：点击“选择文件导入”按钮
- **安全确认**：二次确认对话框框，明确提示“此操作不可恢复”
- **文件选择**：使用 expo-document-picker 选择 JSON 备份文件
  - 仅接受 .json 格式文件
  - 自动复制到缓存目录处理
- **导入过程**：
  1. 解析 JSON 文件
  2. 清空现有数据库中的所有表
  3. 逐表插入新数据
  4. 错误处理：任一表导入失败则中断并提示具体错误
- **状态提示**：导入中显示“导入中...”，完成后提示“请重启应用以查看更改”
- **警告标识**：红色主题卡片，醒目显示危险警告

**C. 使用提示**
- 💡 建议定期备份数据，特别是添加重要内容后
- 💡 备份文件为 JSON 格式，可用文本编辑器查看
- 💡 导入前请确认备份文件来自同一版本的应用
- 💡 导入后将完全替换当前数据，无法撤销

**技术实现：**
- **导出函数**：`exportDatabase()` → 遍历所有表 → 生成 JSON 字符串
- **导入函数**：`importDatabase(jsonData)` → 解析 JSON → 清空表 → 批量插入
- **文件存储**：expo-file-system/legacy（cacheDirectory）
- **文件分享**：expo-sharing（跨应用分享）
- **文件选择**：expo-document-picker（系统文件选择器）

**UI 设计：**
- **头部卡片**：💾 图标 + 标题 + 功能说明
- **导出卡片**：绿色主题，安全操作，包含操作说明和按钮
- **导入卡片**：红色警告主题，包含警告文本和二次确认
- **提示卡片**：灰色背景，4条使用建议

---

## 十、通用规则

### 10.1 数据存储
- **全本地存储**：expo-sqlite 本地数据库，图片存入 App 本地 Documents 目录
- **数据安全**：本地优先，无网络依赖

### 10.2 交互与视觉
- **配色**：温暖治愈（奶油黄 #FAFAF7、日落橙 #E8886F、毛玻璃白 #FFFFFF）
- **响应式**：优先适配手机竖屏

---

## 十一、技术实现

### 11.1 技术栈
- React Native + Expo SDK 57
- TypeScript
- expo-sqlite（本地数据库）
- expo-image-picker（拍照/相册）
- expo-notifications（游戏计时通知）
- expo-file-system（图片文件复制、备份文件读写）
- expo-sharing（备份文件分享）
- expo-document-picker（备份文件选择）
- expo-av（时间胶囊音频录制/播放）
- @react-navigation/native + bottom-tabs + native-stack（导航）
- react-native-safe-area-context

### 11.2 数据库表结构

**boxes（盒子）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| name | TEXT | 盒子名称 |
| icon | TEXT | 盒子图标（默认 📦） |
| todo_mode | INTEGER | 待办模式（0/1） |
| created_at | TEXT | 创建时间 |

**life_items（想法）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| box_id | INTEGER FK | 所属盒子 |
| content | TEXT | 想法内容 |
| tags | TEXT | JSON 数组 |
| image_uri | TEXT | 图片本地 URI |
| weight | INTEGER | 权重（默认 1） |
| status | TEXT | pending / completed |
| disabled | INTEGER | 是否禁用（0/1） |
| completed_at | TEXT | 完成时间 |
| created_at | TEXT | 创建时间 |

**game_items（游戏）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| name | TEXT | 游戏名称 |
| platform | TEXT | 平台（JSON 数组） |
| status | TEXT | wish / playing / cleared / dropped |
| rating | REAL | 评分（0-5，支持 0.5） |
| comment | TEXT | 短评 |
| tags | TEXT | JSON 数组 |
| image_uri | TEXT | 封面图片 URI |
| play_time | INTEGER | 总游玩时长（秒） |
| sharp_comment | TEXT | 锐评 |
| last_played | TEXT | 最后游玩日期 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

**game_progress（游戏进度）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| game_id | INTEGER FK | 所属游戏 |
| name | TEXT | 任务名称 |
| note | TEXT | 备注 |
| progress | INTEGER | 进度（0-100） |
| completed | INTEGER | 是否完成（0/1） |
| source_kr_id | INTEGER | OKR 同步来源 ID |
| created_at | TEXT | 创建时间 |

**game_records（游戏记录）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| game_id | INTEGER FK | 所属游戏 |
| content | TEXT | 记录内容 |
| created_at | TEXT | 创建时间 |

**game_objectives（游戏目标）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| game_id | INTEGER FK | 所属游戏 |
| name | TEXT | 目标名称 |
| completed | INTEGER | 是否完成（0/1） |
| completed_at | TEXT | 完成时间 |
| created_at | TEXT | 创建时间 |

**archived_items（回忆录归档）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| source_type | TEXT | life / game |
| ref_id | INTEGER | 原始记录 ID |
| title | TEXT | 标题 |
| rating | REAL | 评分 |
| diary | TEXT | 日记 |
| completed_at | TEXT | 完成时间 |
| archived_at | TEXT | 归档时间 |

**daily_draw（每日抽取）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| item_id | INTEGER FK | 抽取的想法 ID |
| drawn_at | TEXT | 抽取日期 |

**okr_periods（OKR 周期）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| name | TEXT | 周期名称 |
| start_date | TEXT | 开始日期 |
| end_date | TEXT | 结束日期 |
| archived | INTEGER | 是否归档（0/1） |
| created_at | TEXT | 创建时间 |

**okr_objectives（OKR 目标）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| period_id | INTEGER FK | 所属周期 |
| title | TEXT | 目标名称 |
| description | TEXT | 描述 |
| status | TEXT | active / paused / completed |
| game_id | INTEGER | 关联游戏 ID |
| created_at | TEXT | 创建时间 |

**okr_key_results（OKR 关键结果/任务）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| objective_id | INTEGER FK | 所属目标 |
| parent_id | INTEGER | 父任务 ID（子任务用） |
| title | TEXT | 任务名称 |
| target_value | REAL | 目标值 |
| current_value | REAL | 当前值 |
| unit | TEXT | 单位 |
| repeat_mode | INTEGER | 重复模式（0=普通, 1=重复） |
| sort_order | INTEGER | 排序序号 |
| source_type | TEXT | game / life |
| source_id | INTEGER | 来源 ID |
| created_at | TEXT | 创建时间 |

**okr_activity_log（OKR 活动日志）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| objective_id | INTEGER FK | 所属目标 |
| key_result_id | INTEGER | 关联任务 ID |
| date | TEXT | 活动日期 |
| created_at | TEXT | 创建时间 |

**habits（习惯）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| name | TEXT | 习惯名称 |
| icon | TEXT | 图标（默认 ✅） |
| created_at | TEXT | 创建时间 |

**habit_logs（习惯打卡记录）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| habit_id | INTEGER FK | 所属习惯 |
| date | TEXT | 打卡日期 |
| created_at | TEXT | 创建时间 |

**app_settings（应用设置）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | TEXT PK | 设置键名 |
| value | TEXT | 设置值（JSON 字符串） |

**global_tags（全局标签）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| name | TEXT | 标签名称 |
| module | TEXT | 所属模块（inspiration/game/okr/game_platform） |
| created_at | TEXT | 创建时间 |

**time_capsules（时间胶囊）**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| title | TEXT | 胶囊标题 |
| content | TEXT | 文字内容 |
| audio_uri | TEXT | 语音文件 URI |
| open_date | TEXT | 开启日期 |
| is_opened | INTEGER | 是否已开启（0/1） |
| created_at | TEXT | 创建时间 |

### 11.3 项目文件结构

```
oneday/
├── App.tsx                              # 入口，底部 Tab + 动态 HomeStack
├── app.json                             # Expo 配置（SDK 57）
├── package.json                         # 依赖管理
├── src/
│   ├── theme.ts                         # 配色主题
│   ├── db/
│   │   └── database.ts                  # SQLite 初始化 + 全部 CRUD（~1500 行）
│   ├── components/
│   │   └── ModuleSwitcher.tsx           # 模块切换器组件
│   ├── screens/
│   │   ├── HomeScreen.tsx               # 首页模块网格
│   │   ├── BoxListScreen.tsx            # 惊喜盒子：盒子列表
│   │   ├── BoxDetailScreen.tsx          # 惊喜盒子：盒子详情 + 想法管理
│   │   ├── GameScreen.tsx               # 游戏殿堂：游戏列表
│   │   ├── GameDetailScreen.tsx         # 游戏殿堂：游戏详情 + 计时器 + 进度 + 记录
│   │   ├── GameFormScreen.tsx           # 游戏殿堂：新增/编辑游戏表单
│   │   ├── DiceScreen.tsx               # 扔骰子
│   │   ├── OKRListScreen.tsx            # 目标管理：全目标列表
│   │   ├── OKRDetailScreen.tsx          # 目标管理：目标详情 + 任务 + 子任务 + 日历
│   │   ├── HabitScreen.tsx              # 习惯打卡
│   │   ├── TimeCapsuleScreen.tsx        # 时间胶囊：胶囊列表
│   │   ├── TimeCapsuleFormScreen.tsx    # 时间胶囊：新建/编辑胶囊
│   │   ├── TimeCapsuleDetailScreen.tsx  # 时间胶囊：胶囊详情
│   │   ├── MemoirScreen.tsx             # 回忆录
│   │   ├── ProfileScreen.tsx            # 我的：模块管理
│   │   ├── TagManageScreen.tsx          # 标签管理
│   │   └── PlatformManageScreen.tsx     # 游戏平台管理
│   └── utils/
│       ├── imageStorage.ts              # 图片存储工具
│       └── gameTimer.ts                 # 游戏计时器（通知 + 后台运行）
└── docs/
    └── PRD.md                           # 本文档
```

### 11.4 核心数据流

**惊喜盒子**
- 创建盒子 → `addBox(name, icon)` → 刷新列表
- 添加想法 → `addThought(boxId, content, tags, imageUri)` → 刷新
- 搞定了 → `completeLifeItem(item)` → 插入 archived_items + 标记 completed
- 每日抽取 → `saveDailyDraw(itemId)` / `getDailyDraw()` / `clearDailyDraw()`

**游戏殿堂**
- 新增游戏 → `addGame(...)` → 刷新列表
- 计时器 → `startTimer(gameId, name)` → 通知栏实时计时 → `stopTimer()` → 累加 play_time + 创建 game_record
- OKR 同步 → `syncOKRKeyResultToGame()` → 通过 source_kr_id 追踪

**目标管理**
- 创建目标 → `addOKRObjective(periodId, title, desc, gameId)` → 刷新
- 添加任务 → `addKeyResult(objectiveId, title, ...)` → 自动同步到游戏进度
- 子任务 → `addKeyResult(objectiveId, title, ..., parentId)` → parent_id 建立父子关系
- 快速进度 → `incrementKR(id)` / `updateKRProgress(id, value)` → 记录活动日志

**习惯打卡**
- 创建习惯 → `addHabit(name, icon)` → 刷新
- 打卡 → `checkInHabit(habitId, date)` → 刷新日历

**时间胶囊**
- 创建胶囊 → `addTimeCapsule(title, content, audioUri, openDate)` → 刷新列表
- 开启胶囊 → `openTimeCapsule(capsuleId)` → 更新 is_opened 状态
- 录音功能 → Audio.Recording.createAsync() → 保存到 cacheDirectory
- 播放语音 → Audio.Sound.createAsync({ uri }) → playAsync()
