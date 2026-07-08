# 骰

基于 Three.js + cannon-es 的 骰子模拟器

## 技术栈

| 技术 | 用途 |
|------|------|
| [Three.js](https://threejs.org/) (r185) | 3D 渲染 — 骰子、地面、灯光、相机 |
| [cannon-es](https://github.com/pmndrs/cannon-es) (v0.20) | 物理引擎 — 重力、碰撞、摩擦力 |
| [Vite](https://vitejs.dev/) (v8) | 构建工具 — 开发服务器 + 生产构建 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（热更新）
npm run dev
# → http://localhost:5173

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
# → http://localhost:4174
```

## 远程分享

使用 Cloudflare Tunnel 将本地服务暴露到公网：

```bash
npx cloudflared tunnel --url http://localhost:4174
```

会自动生成一个 `https://xxx.trycloudflare.com` 地址，分享给他人即可访问。

> **注意**：每次 `npm run build` 后刷新远程页面即可看到更新。

## 长期部署（设计完成后）

使用 [Vercel](https://vercel.com) 免费部署，全球 CDN、自动 HTTPS，push 即部署：

```bash
# 1. 将代码推送到 GitHub
git init
git add .
git commit -m "init"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main

# 2. 去 https://vercel.com 用 GitHub 登录
# 3. 点击 "Add New → Project"，导入刚推送的仓库
# 4. Framework Preset 选择 Vite
# 5. Build Command 填 npm run build
# 6. Output Directory 填 dist
# 7. 点击 Deploy，等待 1 分钟
```

部署完成后得到一个 `xxx.vercel.app` 永久地址。之后每次 `git push` 自动重新部署，无需手动构建。

> ⚠️ 当前项目尚在设计阶段，部署地址为临时 Tunnel，待设计完成后再执行上述步骤正式部署。

## 操作说明

| 操作 | 效果 |
|------|------|
| 点击/轻触画面 | 投掷 5 个骰子 |
| 长按画面 2 秒 | 显示/隐藏 🎲 外挂面板 |
| 点击外挂面板数字按钮 | 选择作弊点数 |
| 再次点击同一数字 | 关闭外挂 |

**外挂功能**：选中点数后投掷，所有骰子在半空自动翻成指定点数，且每个骰子有随机朝向，效果自然。

## 骰子视觉

- **白底** — 传统风格，纯白底色配合极淡径向渐变
- **点数颜色** — 1 点和 4 点为红色，其余为黑色
- **圆角造型** — 高分段 BoxGeometry + 顶点球面拉回算法
- **镜面质感** — `roughness: 0.05` + `clearcoat: 0.5`，表面光滑亮泽
- **凹坑效果** — 每点三层绘制（阴影 + 线性渐变 + 高光），模拟半球形凹坑

## 物理系统

| 参数 | 值 | 说明 |
|------|-----|------|
| gravity | -8 | 重力加速度 |
| solver.iterations | 30 | 碰撞解算精度 |
| friction（骰↔墙） | 0.01 | 极低摩擦，不粘墙 |
| friction（骰↔骰） | 0.01 | 极低摩擦，不互相撑住 |
| restitution | 0.3 | 适度弹性 |
| mass | 8 | 较高惯性 |
| angular velocity | 5~15 rad/s | 初始自旋速度 |
| 落地检测 | 连续 30 帧速度 < 1 | 帧计数方式，避免抖动误判 |

- 视觉几何用高分段 `BoxGeometry`（分段数 16，圆角半径 0.2）
- 物理碰撞体用 `CANNON.ConvexPolyhedron`（仅 8 顶点内缩 3%），比复合体更稳定，比 Trimesh 性能更好

## 项目结构

```
shai/
├── index.html          # 入口页面
├── main.js             # 核心代码（Three.js + cannon-es）
├── package.json        # npm 配置
├── vite.config.js      # Vite 配置（允许 tunnel 域名）
├── CLAUDE.md           # 项目开发指南
└── README.md           # 本文件
```

## 开发参考

`main.js` 结构：

1. **场景与相机** — 透视相机自适应宽高比，up 朝向 (0,0,-1)
2. **渲染器** — WebGL 渲染，裁剪到地面区域，外部清黑
3. **灯光** — 主光 (-5,10,5) 强度 3 + 环境光 强度 1 + 背光 (0,-2,-5) 色 #eef2ff 强度 0.5
4. **骰子纹理** — Canvas 2D 绘制，2048px，每面 6 种点数
5. **物理世界** — cannon-es 引擎，四墙 + 地面
6. **圆角几何体** — sub-cube 顶点拉回算法
7. **交互** — canvas pointerup 投掷 + 长按检测外挂面板
8. **动画循环** — 物理步进 → 同步 mesh → 稳定检测 → 渲染
