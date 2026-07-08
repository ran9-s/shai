# Shai 项目指南

## 虚拟环境（venv）

本项目使用 Python 虚拟环境隔离依赖。**所有命令都在虚拟环境中运行。**

### 激活方式

```bash
# Windows (Git Bash / cmd)
source .venv/Scripts/activate

# 或直接使用 venv 内的 Python/pip
.venv/Scripts/python
.venv/Scripts/pip
```

### 首次使用

```bash
source .venv/Scripts/activate
pip install -r requirements.txt   # 如果存在
```

### 退出虚拟环境

```bash
deactivate
```

## 注意

- `.venv/` 目录已加入 `.gitignore`，不提交到版本控制
- 每次打开终端执行命令前，先激活虚拟环境

## 项目结构

```
shai/
├── .venv/              # Python 虚拟环境
├── node_modules/       # npm 依赖
├── index.html          # 入口页面
├── main.js             # 核心代码（Three.js + cannon-es）
├── package.json        # npm 配置
├── CLAUDE.md           # 本文件
├── 1.word              # 开发教程/笔记
└── .gitignore
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm run preview   # 本地预览构建结果
```

## 物理系统

### 碰撞体

- **视觉几何**: 用高分段 `BoxGeometry` + 顶点球面拉回算法（sub-cube 法），生成圆角立方体
  - `createRoundedDiceGeometry(size, radius, seg)` — `radius` 控制圆角大小（目前 0.1），`seg` 控制过渡平滑度（目前 6）
  - 原理：顶点在面区域内不动（保持 ±0.5），在棱/角区域沿方向向量拉到指定半径的圆柱/球面上
- **物理碰撞**: 用 `CANNON.ConvexPolyhedron`，仅 8 个顶点（立方体角点内缩 3%）
  - 比 Box + Sphere 复合体更稳定
  - 比 Trimesh 性能更好，且支持所有碰撞对（Trimesh 不支持 Trimesh ↔ Trimesh）

### 关键物理参数

| 参数 | 值 | 原因 |
|------|-----|------|
| `gravity` | -25 | 骰子快速落定 |
| `solver.iterations` | 30 | 多骰子互靠时精确解算接触 |
| `friction` (dice↔wall) | 0.01 | 极低摩擦 — 骰子不会粘在墙上 |
| `friction` (dice↔dice) | 0.01 | 极低摩擦 — 骰子互靠时滑开，不互相撑住 |
| `restitution` | 0.3 | 适度弹性，落地微弹有助于翻正 |
| `mass` | 8 | 较高惯性，小接触力不易卡住 |
| `linearDamping` | 0.1 | 低阻尼，骰子运动自然 |
| `angularDamping` | 0.1 | 低阻尼，骰子有足够能量自行翻正 |

这些参数参考了 [threejs-dice-es](https://www.npmjs.com/package/threejs-dice-es) 库的成熟方案（原版 friction 为 0/0.01）。

### 稳定检测

采用帧计数方式（来自 threejs-dice）：
- 每帧检查所有轴向线速度和角速度是否 < 1.0
- 需 **连续 30 帧** 全部达标才算落地
- 避免单帧阈值过早判定导致抖动期间结算

### 落地效果

- 落地时相机轻微抖动（`shakeTimer`），提供手感反馈
- 围墙内壁比骰子半径多 0.05 单位间隙，减少贴墙卡住