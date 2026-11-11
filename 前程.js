// ==UserScript==
// @name         51job 前程无忧智能自动投递助手 (2026 UI旗舰版)
// @namespace    https://github.com/TianMingXTU/51job-auto-apply
// @version      2.3.0
// @description  全网最强 51job 自动投递脚本。支持黑白名单、AI 大模型精准匹配评估。2026全新高定UI，日志沉浸式自动展开，AI强降级机制，完全开源无限制。
// @author       TianMingXTU
// @license      MIT
// @match        *://*.51job.com/*
// @match        *://*.51job.com.cn/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// 本地魔改版：已移除 @downloadURL/@updateURL，防止 Tampermonkey 检查更新时用 greasyfork 官方 v2.2.0 覆盖本次及后续全部本地修改
// ==/UserScript==

(function () {
    'use strict';

    /********************************************************
     * 1. 2026 现代 CSS 样式注入 (Scoped)
     ********************************************************/
    const style = `
        :root {
            --w-bg: rgba(255, 255, 255, 0.85);
            --w-bg-dark: rgba(17, 24, 39, 0.85);
            --w-blur: blur(20px) saturate(180%);
            --w-primary: #3b82f6;
            --w-primary-hover: #2563eb;
            --w-danger: #ef4444;
            --w-text: #1f2937;
            --w-text-muted: #6b7280;
            --w-radius: 16px;
            --w-radius-sm: 10px;
            --w-shadow: 0 20px 40px -10px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05);
        }
        
        /* 面板主容器 */
        #wohz-app {
            position: fixed; right: 24px; bottom: 24px; width: 320px;
            background: var(--w-bg); backdrop-filter: var(--w-blur); -webkit-backdrop-filter: var(--w-blur);
            border: 1px solid rgba(255,255,255,0.5); box-shadow: var(--w-shadow);
            border-radius: var(--w-radius); z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif; color: var(--w-text);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; flex-direction: column; overflow: hidden;
        }

        /* 顶部控制台 */
        .w-header { padding: 16px 20px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .w-title { font-weight: 800; font-size: 16px; letter-spacing: -0.3px; background: linear-gradient(135deg, #111827, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .w-badge { font-size: 11px; font-weight: 600; background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 20px; }

        /* 数据网格 */
        .w-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 16px 20px; }
        .w-stat-card { background: rgba(0,0,0,0.03); border-radius: var(--w-radius-sm); padding: 10px 12px; transition: transform 0.2s; }
        .w-stat-card:hover { transform: translateY(-2px); background: rgba(0,0,0,0.05); }
        .w-stat-val { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
        .w-stat-label { font-size: 11px; color: var(--w-text-muted); font-weight: 500; }

        /* 按钮组 */
        .w-actions { padding: 0 20px 16px; display: flex; flex-direction: column; gap: 8px; }
        .w-btn { 
            width: 100%; border: none; border-radius: var(--w-radius-sm); padding: 12px; 
            font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; 
            display: flex; justify-content: center; align-items: center; gap: 6px;
        }
        .w-btn-primary { background: var(--w-primary); color: white; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
        .w-btn-primary:hover { background: var(--w-primary-hover); transform: scale(0.98); }
        .w-btn-danger { background: var(--w-danger); color: white; box-shadow: 0 4px 12px rgba(239,68,68,0.3); }
        .w-btn-danger:hover { background: #dc2626; transform: scale(0.98); }
        .w-btn-row { display: flex; gap: 8px; }
        .w-btn-sub { flex: 1; background: white; border: 1px solid rgba(0,0,0,0.1); color: var(--w-text); }
        .w-btn-sub:hover { background: #f9fafb; border-color: rgba(0,0,0,0.2); }

        /* 沉浸式终端日志 (默认隐藏，开启时展开) */
        .w-log-section { 
            height: 0; opacity: 0; background: #0f172a; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; flex-direction: column;
        }
        .w-log-section.open { height: 260px; opacity: 1; }
        .w-log-header { padding: 8px 16px; font-size: 12px; font-weight: 600; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); display:flex; justify-content: space-between; }
        .w-log-content { flex: 1; overflow-y: auto; padding: 12px 16px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px; line-height: 1.6; }
        .w-log-content::-webkit-scrollbar { width: 4px; }
        .w-log-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .w-log-item { margin-bottom: 6px; word-wrap: break-word; }

        /* 现代化设置 Modal */
        .w-modal-mask { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); z-index: 2147483648; display: none; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s; }
        .w-modal-mask.show { opacity: 1; }
        .w-modal { background: white; width: 600px; max-height: 85vh; border-radius: 24px; padding: 32px; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transform: translateY(20px); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .w-modal-mask.show .w-modal { transform: translateY(0); }
        
        .w-form-group { background: #f8fafc; border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 1px solid #f1f5f9; }
        .w-form-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; display:flex; align-items:center; justify-content:space-between; }
        
        .w-input { width: 100%; background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font-size: 13px; outline: none; transition: all 0.2s; box-sizing: border-box; margin-bottom: 12px; }
        .w-input:focus { border-color: var(--w-primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        
        /* iOS 风格 Switch */
        .w-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .w-switch input { opacity: 0; width: 0; height: 0; }
        .w-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; border-radius: 24px; }
        .w-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        input:checked + .w-slider { background-color: var(--w-primary); }
        input:checked + .w-slider:before { transform: translateX(20px); }
    `;
    if (typeof GM_addStyle !== 'undefined') { GM_addStyle(style); } 
    else { const s = document.createElement('style'); s.innerHTML = style; document.head.appendChild(s); }

    /********************************************************
     * 2. 状态、配置与日志系统
     ********************************************************/
    const STORAGE_KEY_CONFIG = 'wohz_51job_config_v22';
    const STORAGE_KEY_STATE = 'wohz_51job_state_v22';
    const MAX_LOG_SIZE = 150;
    // 分页时间阈值只用于告警和退避，不再因等待时间过长而停止任务。
    const SCRIPT_VERSION = '2.3.0';
    const PAGE_WAIT_WARNING = 10000;
    const PAGE_POLL_INTERVAL = 300;
    const PAGE_STABLE_INTERVAL = 900;
    const PAGE_RECOVERY_INTERVAL = 1500;
    const PAGE_RETRY_LIMIT = 2;
    let runGeneration = 0;
    let runController = null;
    let runtimeStatus = { phase: '已停止', reason: '尚未启动' };
    let recoveryRequest = null;
    let recoveryApprovals = [];
    let runtimeLogs = [];
    // 本轮会话内同岗位投递次数记录（键：职位名|公司名），startRun 时重置；兜底收集将同一卡片收入多次时，同岗位至多投 maxApplyPerJob 次
    let sessionApplyCounts = new Map();
    // 本轮运行起始路径哨兵：runLoop 每轮校验 location.pathname，一旦离开初始列表页立即停机（query 变化不误杀）
    let runStartPathname = '';

    const defaultConfig = {
        maxApplyTotal: 100, maxApplyPerJob: 2, minDelay: 2000, maxDelay: 4500, popupWait: 4000,
        includeKeywords: '前端,Web,JavaScript,React,Vue', excludeKeywords: '实习,兼职,外包,在校生,外派',               
        companyBlacklist: '某某科技,外包巨头', titleBlacklist: '销售,客服,讲师,经理',                           
        enableAI: false, aiApiUrl: 'https://api.deepseek.com/chat/completions', aiApiKey: '',
        aiModel: 'deepseek-chat', aiMinScore: 70, 
        userResume: '3年前端开发经验，熟练掌握 Vue3/React 框架，拥有复杂后台与 H5 性能优化经验。',
    };

    const defaultState = { running: false, applied: 0, filteredCount: 0 };

    function getConfig() { return Object.assign({}, defaultConfig, GM_getValue(STORAGE_KEY_CONFIG, {})); }
    function setConfig(cfg) { GM_setValue(STORAGE_KEY_CONFIG, cfg); }
    // 运行状态属于当前页面，持久化的旧状态或其他标签页不能复活本页循环。
    function getState() { return { ...defaultState, ...GM_getValue(STORAGE_KEY_STATE, {}), running: !!runController && !runController.signal.aborted }; }
    function setState(st) { GM_setValue(STORAGE_KEY_STATE, st); }

    /********************************************************
     * 3. 核心工具与日志
     ********************************************************/
    function log(msg, type = 'info') {
        const timeStr = new Date().toTimeString().split(' ')[0];
        runtimeLogs.push({ time: timeStr, msg, type });
        if (runtimeLogs.length > MAX_LOG_SIZE) runtimeLogs.shift();
        renderLogs();
    }

    // 停止时立即唤醒等待；分页等待还可在页面恢复可见时立即复核。
    function sleep(ms, signal, wakeOnVisible = false) {
        return new Promise(resolve => {
            if (signal?.aborted) { resolve(); return; }
            const finish = () => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', finish);
                document.removeEventListener('visibilitychange', onVisible);
                resolve();
            };
            const onVisible = () => { if (!document.hidden) finish(); };
            const timer = setTimeout(finish, ms);
            signal?.addEventListener('abort', finish, { once: true });
            if (wakeOnVisible) document.addEventListener('visibilitychange', onVisible);
        });
    }
    function isRunActive(run) {
        return !!run && run.id === runGeneration && !run.signal.aborted;
    }
    function canContinueRun(run) {
        if (!isRunActive(run)) return false;
        if (location.pathname === run.path) return true;
        stopRun('页面已离开初始列表页，引擎停止', run.id);
        return false;
    }
    function setRuntimeStatus(phase, reason) {
        if (runtimeStatus.phase === phase && runtimeStatus.reason === reason) return;
        runtimeStatus = { phase, reason };
        updateUI();
        log(`${phase}：${reason}`, phase === '处理中' ? 'info' : 'warn');
    }
    // 更加人性化的随机延迟
    function randDelay(min, max) {
        const cfg = getConfig();
        const low = min || cfg.minDelay;
        const high = max || cfg.maxDelay;
        // 加入非线性抖动 (模拟人手的偶尔发呆)
        const jitter = Math.random() > 0.9 ? 1500 : 0; 
        return low + Math.floor(Math.random() * (high - low)) + jitter;
    }

    function cleanText(str) { return (str || '').replace(/\s+/g, ' ').trim(); }
    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 2 && rect.height > 2;
    }
    function safeClick(el) {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.click();
    }

    /********************************************************
     * 4. 强大的解析与评估引擎
     ********************************************************/
    function evaluateJob(jobInfo) {
        const cfg = getConfig();
        const title = cleanText(jobInfo.title).toLowerCase();
        const company = cleanText(jobInfo.company).toLowerCase();
        const tags = cleanText(jobInfo.tags).toLowerCase();
        const fullContent = `${title} ${company} ${tags}`;
        const splitKeywords = (value) => value.split(/[,，]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const companyBlacklist = splitKeywords(cfg.companyBlacklist || '');
        const titleBlacklist = splitKeywords(cfg.titleBlacklist || '');
        const excludeKeywords = splitKeywords(cfg.excludeKeywords || '');
        const includeKeywords = splitKeywords(cfg.includeKeywords || '');

        if (companyBlacklist.length > 0 && !company) 
            return { pass: false, reason: `公司名称未识别，拒绝投递` };
        if (companyBlacklist.some(w => company.includes(w))) 
            return { pass: false, reason: `黑名单公司` };
        
        if (titleBlacklist.length > 0 && !title) 
            return { pass: false, reason: `职位名称未识别，拒绝投递` };
        if (titleBlacklist.some(w => title.includes(w))) 
            return { pass: false, reason: `黑名单职位` };
        
        if (excludeKeywords.length > 0) {
            const hit = excludeKeywords.find(w => fullContent.includes(w));
            if (hit) return { pass: false, reason: `命中排除词(${hit})` };
        }
        
        if (includeKeywords.length > 0) {
            if (!title) return { pass: false, reason: `职位名称未识别，拒绝投递` };
            if (!includeKeywords.some(w => title.includes(w))) 
                return { pass: false, reason: `缺核心关键词` };
        }
        
        return { pass: true, reason: '基础通过' };
    }

    async function analyzeJobWithAI(jobInfo, run) {
        const cfg = getConfig();
        if (!cfg.enableAI || !cfg.aiApiKey || !cfg.aiApiUrl) return { pass: true, score: 100, reason: 'AI未启(跳过)' };

        log(`[AI 思考中] 分析: ${jobInfo.title} | ${jobInfo.company}...`, 'warn');
        const prompt = `你是求职助手。评估候选人与岗位匹配度。\n候选人:${cfg.userResume}\n岗位:${jobInfo.title}|${jobInfo.company}|要求:${jobInfo.description}\n输出0-100分数及10字内原因。仅输出JSON，如:{"score":85,"reason":"高度匹配"}`;

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST', url: cfg.aiApiUrl, timeout: 20000,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.aiApiKey}` },
                data: JSON.stringify({
                    model: cfg.aiModel || 'gpt-3.5-turbo',
                    messages: [{ role: 'system', content: '严格输出JSON' }, { role: 'user', content: prompt }],
                    temperature: 0.1
                }),
                onload: (res) => {
                    // 旧会话的迟到响应只结束自身等待，不影响新运行的日志和流程。
                    if (!isRunActive(run)) return resolve({ pass: false, reason: '运行已结束' });
                    if (res.status !== 200) { log(`[AI 降级] API HTTP ${res.status}`, 'error'); return resolve({ pass:true, reason:'接口错放行' }); }
                    try {
                        const content = JSON.parse(res.responseText).choices[0].message.content;
                        const aiRes = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
                        const pass = aiRes.score >= cfg.aiMinScore;
                        log(`[AI 裁决] ${aiRes.score}分 (${pass?'通过':'拦截'}) - ${aiRes.reason}`, pass ? 'success' : 'warn');
                        resolve({ pass, reason: `AI(${aiRes.score}分): ${aiRes.reason}` });
                    } catch (e) {
                        log(`[AI 降级] 解析失败放行`, 'error'); resolve({ pass:true, reason:'解析异常' });
                    }
                },
                onerror: () => { if (isRunActive(run)) log('[AI 降级] 网络错误放行', 'error'); resolve({ pass:true, reason:'网络异常' }); },
                ontimeout: () => { if (isRunActive(run)) log('[AI 降级] 请求超时放行', 'error'); resolve({ pass:true, reason:'请求超时' }); }
            });
        });
    }

    /********************************************************
     * 5. 核心 DOM 交互
     ********************************************************/
    // ---------------- 零破坏守卫层：所有点击动作的统一防御闸，判定与引擎流程分离 ----------------
    // 导航闸：判定点击该元素是否会触发页面跳转（真实 <a href> 会定向离开当前页，一律视为不可点击）
    function isNavigatingElement(el) {
        if (!el || el.tagName !== 'A') return false;
        const href = (el.getAttribute('href') || '').trim();
        if (!href || href.startsWith('#')) return false; // 空锚点/纯锚点仅定位本页内位置，不构成跳转
        return !href.toLowerCase().startsWith('javascript:');
    }

    // 语义闸：判定弹窗文本是否确证含投递语义，仅此白名单弹窗允许交互；登录、公告、筛选浮层等一律零接触
    function isApplyDialog(el) {
        if (!el || !isVisible(el)) return false;
        return /投递|申请|简历/.test(cleanText(el.innerText));
    }

    function getJobCards(root = document) {
        // 分页期间只读取已确认列表容器中的岗位，避免混入推荐区。
        const items = Array.from(root.querySelectorAll('.sensors_jp_list, .joblist-item, .j_joblist .e, .job-list-item'));
        if (items.length > 0) return items;
        const applyBtns = Array.from(root.querySelectorAll('button, a')).filter(el => isApplyText(cleanText(el.innerText)) && isVisible(el));
        return applyBtns.map(btn => btn.closest('.sensors_jp_list, .joblist-item, div[class*="item"]') || btn.parentElement);
    }

    // 投递按钮文案判定：含"申请/投递"即视为投递入口（排除"已投递/已申请"等已完成状态）
    function isApplyText(t) {
        return (t.includes('申请') || t.includes('投递')) && !t.startsWith('已');
    }

    // 诊断辅助：列出卡片内可见按钮文案（截断），未命中时随日志输出，用于快速定位词表缺口
    function describeCardButtons(cardEl) {
        return Array.from(cardEl.querySelectorAll('button, a, [role="button"]'))
            .filter(isVisible)
            .slice(0, 5)
            .map(el => cleanText(el.innerText).slice(0, 12))
            .filter(Boolean)
            .join(' / ') || '无可见按钮';
    }

    function parseJobInfoFromCard(cardEl) {
        if (!cardEl) return null;
        // 优先读取名称本身，避免漏掉新版 .jname/.cname 或误取包含行业、标签的外层容器。
        const titleEl = cardEl.querySelector('.jname, .j_name, .job_name, .job-name')
            || cardEl.querySelector('[class*="title"], .name');
        const companyEl = cardEl.querySelector('.cname, .c_name, .comp_name, .company-name')
            || cardEl.querySelector('[class*="company"]');
        // 名称元素的 title 保存完整名称，优先使用，兼容仅在属性中提供完整文本的卡片。
        const title = cleanText(titleEl?.getAttribute('title') || titleEl?.innerText);
        const company = cleanText(companyEl?.getAttribute('title') || companyEl?.innerText);
        const salary = cleanText(cardEl.querySelector('.sal, .salary, [class*="salary"]')?.innerText);
        const tags = cleanText(cardEl.querySelector('.tags, .info_tag, .job_tag, .job-tags')?.innerText);
        // 投递按钮识别改为语义包含匹配（申请/投递，排除已投递/已申请状态），天然覆盖新旧版全部文案变体
        const applyBtn = Array.from(cardEl.querySelectorAll('button, a, [role="button"]')).find(el => isApplyText(cleanText(el.innerText)) && isVisible(el));
        return { title, company, salary, tags, description: tags, applyBtn };
    }

    async function handlePopups(run) {
        let start = Date.now();
        while (canContinueRun(run)) {
            // 登录或验证阻塞期间保留当前投递等待，绝不替用户处理验证。
            const blocker = readPageBlocker();
            if (blocker) {
                setRuntimeStatus('需要人工处理', blocker);
                await sleep(PAGE_RECOVERY_INTERVAL, run.signal, true);
                start = Date.now();
                continue;
            }
            if (Date.now() - start >= getConfig().popupWait) return;
            // 语义闸：仅文本确证含"投递/申请/简历"语义的弹窗允许交互；登录、公告、筛选浮层等语义外弹窗静默零接触
            const dialogs = Array.from(document.querySelectorAll('.ant-modal, .el-dialog, .modal, .popup, [role="dialog"]')).filter(isApplyDialog);
            if (dialogs.length === 0) { await sleep(400, run.signal); continue; }
            for (const dialog of dialogs) {
                if (!canContinueRun(run)) return;
                if (readPageBlocker()) break;
                const btns = Array.from(dialog.querySelectorAll('button, a')).filter(isVisible);
                // 确认词表均为投递语境安全词（覆盖"确认/投递简历"等新版弹窗文案变体），且逐一过导航闸——弹窗内绝不点击任何链接型按钮
                const confirmBtn = btns.find(b => !isNavigatingElement(b) && ['确认投递', '立即投递', '使用此简历', '确定', '确认', '投递简历', '我知道了', '好的'].some(k => cleanText(b.innerText).includes(k)));
                // 命中确认词才点击并等待；确认后弹窗自会关闭。零破坏原则：若未命中确认词则对该弹窗不做任何动作，绝不执行零语义关闭点击("关闭"/"取消"/X 按钮)
                if (confirmBtn?.isConnected) { safeClick(confirmBtn); log(`弹窗处理: [确认投递]`); await sleep(1000, run.signal); continue; }
            }
            await sleep(500, run.signal);
        }
    }

    async function processCurrentPage(run, page) {
        let state = getState();
        const cfg = getConfig();
        const cards = page.cards;
        // 本页处理统计：每页结束后输出，过滤数量不会影响是否继续翻页。
        const pageStat = { scanned: cards.length, applied: 0, filtered: 0, noBtn: 0, navSkip: 0, other: 0 };
        
        log(`📍 本页检测到 ${cards.length} 个职位`);
        for (let index = 0; index < cards.length; index++) {
            // 每次恢复都重新取得本页 DOM，不继续点击已经被官网替换的旧卡片。
            const readyPage = await waitForPageReady(run, page);
            if (!readyPage || !canContinueRun(run)) break;
            page = resolvePageContext(run, page);
            let card = readyPage.cards[index];
            state = getState();
            if (state.applied >= cfg.maxApplyTotal) { stopRun('达到最大投递量', run.id, '已完成'); return pageStat; }

            let job = parseJobInfoFromCard(card);
            if (!job) { log('[跳过] 岗位卡片解析失败（容器异常或为空）', 'warn'); pageStat.other++; continue; }
            // 名称或按钮尚未就绪时悬停重试，并刷新完整信息，避免沿用首次读取的空名称而误过滤。
            if (!job.applyBtn || !job.title || !job.company) {
                card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                await sleep(250, run.signal);
                const refreshedPage = await waitForPageReady(run, page);
                if (!refreshedPage || !canContinueRun(run)) break;
                page = resolvePageContext(run, page);
                card = refreshedPage.cards[index];
                job = parseJobInfoFromCard(card);
            }
            // 观测日志：仍未命中则显形具体原因，并列出卡内可见按钮文案（词表缺口的直接证据）
            if (!job.applyBtn) { log(`[跳过] ${job.title || '未识别岗位'} | ${job.company || '未识别公司'} - 未命中投递按钮；卡内可见按钮: [${describeCardButtons(card)}]`, 'warn'); pageStat.noBtn++; continue; }

            // 同岗位限投：以"职位名|公司名"为本轮会话键，达到上限即跳过（位于规则/AI 评估之前，节省评估开销）
            const jobKey = `${job.title}|${job.company}`;
            const appliedTimes = sessionApplyCounts.get(jobKey) || 0;
            if (appliedTimes >= cfg.maxApplyPerJob) {
                log(`[跳过] ${job.title} | ${job.company} - 本轮已投 ${appliedTimes} 次（上限 ${cfg.maxApplyPerJob}）`, 'warn');
                pageStat.other++;
                continue;
            }

            const ruleRes = evaluateJob(job);
            if (!ruleRes.pass) {
                log(`[本地过滤] ${job.title} | ${job.company} - ${ruleRes.reason}`);
                state.filteredCount++; setState(state); updateUI();
                pageStat.filtered++;
                continue;
            }

            if (cfg.enableAI) {
                const aiRes = await analyzeJobWithAI(job, run);
                if (!canContinueRun(run)) break;
                if (!aiRes.pass) {
                    state = getState(); // 异步返回后读取新统计，避免覆盖等待期间的手动重置。
                    state.filteredCount++; setState(state); updateUI();
                    pageStat.filtered++;
                    continue;
                }
            }

            // 导航闸：链接型投递入口（真实 <a href>，如跳详情页的"申请职位"）绝不点击——宁可漏投也不离开当前列表页
            if (isNavigatingElement(job.applyBtn)) {
                log(`[防跳转跳过] ${job.title} | ${job.company} - 投递入口为页面跳转链接，为保护当前页面与筛选不予点击`, 'warn');
                pageStat.navSkip++;
                continue;
            }

            const confirmedPage = await waitForPageReady(run, page);
            if (!confirmedPage || !canContinueRun(run)) break;
            page = resolvePageContext(run, page);
            // 点击前同步复核，避免异步等待期间的重渲染或手动翻页使目标失效。
            const currentPage = readPaginationState();
            if (!sameJobPage(currentPage, page)) { index--; continue; }
            const latestJob = parseJobInfoFromCard(currentPage.cards[index]);
            if (!latestJob?.applyBtn?.isConnected || isNavigatingElement(latestJob.applyBtn)
                || ['title', 'company', 'salary', 'tags'].some(key => latestJob[key] !== job[key])) {
                // 信息改变则重新评估同一岗位；让出事件循环，避免失效节点造成空转。
                index--;
                await sleep(PAGE_POLL_INTERVAL, run.signal);
                continue;
            }
            job = latestJob;
            setRuntimeStatus('处理中', `正在处理第 ${page.page} 页`);
            log(`✅ [投递成功] ${job.title} | ${job.company} | ${job.salary}`, 'success');
            safeClick(job.applyBtn);
            await sleep(1500, run.signal);
            if (!canContinueRun(run)) break;
            await handlePopups(run);
            if (!canContinueRun(run)) break;

            state = getState();
            state.applied++; setState(state); updateUI();
            pageStat.applied++; // 本页成功投递计数（供停机文案统计）
            sessionApplyCounts = new Map(sessionApplyCounts).set(jobKey, (sessionApplyCounts.get(jobKey) || 0) + 1);
            await sleep(randDelay(), run.signal);
        }
        return pageStat; // 全部卡片处理完毕，交由 runLoop 输出统计并继续下一页。
    }

    function readJobIdentity(card) {
        // 官网 JobList 将稳定 jobId、pageNum 和查询信息写入该属性；不依赖展示文本。
        const sensor = card.matches('[sensorsname="JobShortExposure"][sensorsdata]')
            ? card : card.querySelector('[sensorsname="JobShortExposure"][sensorsdata]');
        if (!sensor) return { id: '', error: '未识别官网岗位身份属性，请核对当前页面结构' };
        try {
            const data = JSON.parse(sensor.getAttribute('sensorsdata'));
            const validId = typeof data?.jobId === 'string' || Number.isSafeInteger(data?.jobId);
            const page = Number(data?.pageNum);
            if (!validId || !String(data.jobId).trim() || !Number.isSafeInteger(page) || page < 1) {
                return { id: '', error: '岗位身份或所属页码无效，等待核实' };
            }
            return { id: String(data.jobId), page, context: JSON.stringify([data.keyword, data.searchType, data.requestId]) };
        } catch {
            return { id: '', error: '岗位身份属性不是有效 JSON，请核对官网页面结构' };
        }
    }
    function getJobPageSignature(identities) {
        return identities.length && identities.every(job => job.id) ? JSON.stringify(identities.map(job => job.id)) : '';
    }
    function getPageNumber(pager) {
        for (const selector of ['[aria-current="page"]', '.el-pager .number.active', '.c_orange']) {
            const page = Number(cleanText(pager?.querySelector(selector)?.textContent));
            if (Number.isSafeInteger(page) && page > 0) return page;
        }
        return null;
    }
    function getNextButtonState(button) {
        if (!button?.isConnected || !isVisible(button)) return '缺失或不可见';
        if (button.matches(':disabled, .disabled, .is-disabled, [aria-disabled="true"]')) return '禁用';
        if (button.matches('[aria-busy="true"], .is-loading, .loading')) return '加载中';
        return '可用';
    }
    function readPageBlocker() {
        // 只观察明确的登录、验证或网络提示，不自动关闭、绕过或提交这些弹窗。
        const dialogs = document.querySelectorAll('.el-dialog, .el-message-box, .ant-modal, .van-popup, .modal, .popup, [role="dialog"]');
        const blocked = Array.from(dialogs).find(el => isVisible(el)
            && /请先登录|登录后|手机登录|扫码登录|验证码登录|安全验证|滑动验证|人机验证|访问过于频繁|网络异常|请求失败/.test(cleanText(el.innerText)));
        return blocked ? '官网有登录、验证或请求异常提示，请人工处理后等待恢复' : '';
    }
    function readPaginationState() {
        // 已核实 PCSearch：请求开始会清空列表和 total，分页器暂时销毁，JobList 显示 skeleton。
        const root = Array.from(document.querySelectorAll('.j_result')).find(isVisible);
        const list = root?.querySelector('.joblist');
        const cards = list ? getJobCards(list) : [];
        const identities = cards.map(readJobIdentity);
        const signature = getJobPageSignature(identities);
        const pagers = Array.from(root?.querySelectorAll('.el-pagination, .samll_page') || []).filter(isVisible);
        const pager = pagers.find(el => el.matches('.el-pagination')) || pagers[0];
        const page = getPageNumber(pager);
        // 官网 Element 分页器始终展示末页数字；小分页直接展示“当前页 / 总页数”。
        const numbers = Array.from(pager?.querySelectorAll('.el-pager .number') || []).map(el => Number(cleanText(el.textContent)));
        const smallTotal = cleanText(pager?.textContent).match(/^\d+\s*\/\s*(\d+)$/);
        const totalPages = numbers.length ? Math.max(...numbers) : Number(smallTotal?.[1]) || null;
        const nextButton = pager?.querySelector('.btn-next, .next');
        const nextButtonState = getNextButtonState(nextButton);
        // 禁用和忙碌可以同时存在，加载判定不能被“禁用”状态遮蔽。
        const loading = !!Array.from(list?.querySelectorAll('.skeleton') || []).find(isVisible)
            || root?.getAttribute('aria-busy') === 'true' || list?.getAttribute('aria-busy') === 'true'
            || pager?.getAttribute('aria-busy') === 'true' || !!nextButton?.matches('[aria-busy="true"], .is-loading, .loading');
        const blocker = readPageBlocker();
        const identityError = identities.find(job => job.error)?.error || '';
        const pageMatches = page !== null && pagers.every(el => getPageNumber(el) === page)
            && identities.every(job => job.page === page);
        const query = Array.from(new URLSearchParams(location.search)).filter(([key]) => key !== 'pageNum')
            .sort(([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB));
        const context = JSON.stringify([query, cleanText(root?.querySelector('.j_tlc .ss.on')?.textContent), identities[0]?.context]);
        const sameContext = identities.every(job => job.context === identities[0]?.context);
        const empty = !!root && !loading && !blocker && !cards.length
            && Array.from(root.querySelectorAll('.j_nolist')).some(el => isVisible(el) && cleanText(el.textContent) === '暂无相关职位');
        const ready = !!list && !!signature && !loading && !blocker && pageMatches && sameContext
            && Number.isSafeInteger(totalPages) && totalPages >= page;
        let reason = '等待页面稳定';
        if (blocker || identityError) reason = blocker || identityError;
        else if (!root || !list) reason = '等待官网搜索列表结构';
        else if (loading) reason = '官网列表正在加载';
        else if (!page) reason = '分页器暂未就绪';
        else if (!signature) reason = '岗位列表暂未就绪';
        else if (!pageMatches || !sameContext) reason = '页码与岗位所属页面或查询尚未一致';
        else if (!ready) reason = '总页数尚未确认';
        return { ready, empty, page, totalPages, signature, context, cards, pager, nextButton, nextButtonState, blocker, identityError, reason };
    }
    function pageStateKey(state) {
        return state.ready ? JSON.stringify([state.page, state.totalPages, state.signature, state.context, state.nextButtonState]) : '';
    }
    function sameJobPage(state, expected) {
        return state.ready && state.page === expected.page && state.signature === expected.signature && state.context === expected.context;
    }
    function reportPageWait(state, elapsed, reason = '', needsAction = false) {
        const phase = needsAction || state.blocker || state.identityError ? '需要人工处理'
            : elapsed >= PAGE_WAIT_WARNING ? '等待恢复' : '等待页面就绪';
        setRuntimeStatus(phase, `${reason || state.reason}；当前页=${state.page ?? '未知'}，岗位数=${state.cards.length}，下一页=${state.nextButtonState}`);
    }
    function offerContextRecovery(run, source, state, targetPage = source.page) {
        // 重新搜索会产生新 requestId；只能由用户确认，且不能接续到无关页或重投旧列表。
        const eligible = state.ready && state.context !== source.context
            && ((state.page === source.page && state.signature === source.signature)
                || (targetPage !== source.page && state.page === targetPage && state.signature !== source.signature));
        const request = eligible ? { runId: run.id, fromContext: source.context, context: state.context, page: state.page, signature: state.signature } : null;
        if (JSON.stringify(request) === JSON.stringify(recoveryRequest)) return;
        recoveryRequest = request;
        updateUI();
    }
    function acceptContextRecovery() {
        const request = recoveryRequest;
        if (!request || request.runId !== runGeneration || !getState().running || location.pathname !== runStartPathname) return;
        const state = readPaginationState();
        // 用户点击确认时再次核对页面，拒绝使用已经过期的恢复请求。
        if (!state.ready || state.page !== request.page || state.signature !== request.signature || state.context !== request.context) {
            recoveryRequest = null;
            updateUI();
            log('页面状态已变化，恢复确认未生效，请等待重新核实', 'warn');
            return;
        }
        recoveryApprovals = [...recoveryApprovals, { runId: request.runId, fromContext: request.fromContext, context: request.context }];
        recoveryRequest = null;
        setRuntimeStatus('等待页面就绪', '已确认当前查询，正在复核保留的岗位进度');
    }
    function resolvePageContext(run, source) {
        if (!source) return source;
        // 确认结果供当前岗位、等待器和外层翻页共同读取，避免每个调用层重复要求确认。
        const context = recoveryApprovals.reduce((value, approval) =>
            approval.runId === run.id && approval.fromContext === value ? approval.context : value, source.context);
        return context === source.context ? source : { ...source, context };
    }
    async function waitForPageReady(run, expected = null) {
        // 已确认页的短暂消失只暂停动作；恢复后仍处理同一页，不重启整轮。
        const started = performance.now();
        let candidate = { key: '', since: 0 };
        let waited = false;
        while (canContinueRun(run)) {
            expected = resolvePageContext(run, expected);
            const state = readPaginationState();
            const now = performance.now();
            if (state.empty && !expected) return state;
            const mismatch = state.ready && expected && !sameJobPage(state, expected);
            if (expected) offerContextRecovery(run, expected, state);
            const key = !mismatch ? pageStateKey(state) : '';
            if (key && expected && !waited) return state;
            if (!key || key !== candidate.key) candidate = { key, since: now };
            if (key && now - candidate.since >= PAGE_STABLE_INTERVAL) {
                if (expected) setRuntimeStatus('处理中', `第 ${expected.page} 页已恢复，继续原岗位进度`);
                return state;
            }
            reportPageWait(state, now - started, mismatch ? `页面或查询已改变，请恢复第 ${expected.page} 页后继续` : '', !!mismatch);
            waited = true;
            await sleep(now - started >= PAGE_WAIT_WARNING ? PAGE_RECOVERY_INTERVAL : PAGE_POLL_INTERVAL, run.signal, true);
        }
        return null;
    }
    function getPageClickTarget(state, targetPage, allowNext) {
        // 重试只选择固定目标页；禁止再次点击相对“下一页”而误跳页。
        const number = Array.from(state.pager?.querySelectorAll('.el-pager .number') || [])
            .find(el => Number(cleanText(el.textContent)) === targetPage && getNextButtonState(el) === '可用');
        const button = number || (allowNext && state.nextButtonState === '可用' ? state.nextButton : null);
        return button && !isNavigatingElement(button) ? button : null;
    }
    async function goToNextPage(run, source) {
        const expectedPage = source.page + 1;
        const started = performance.now();
        // 来源页已经通过稳定确认；状态未变时无需再人为等待一个窗口。
        let transition = { attempts: 0, candidateKey: pageStateKey(source), candidateSince: started - PAGE_STABLE_INTERVAL, lastProgress: started };
        while (canContinueRun(run)) {
            source = resolvePageContext(run, source);
            const state = readPaginationState();
            offerContextRecovery(run, source, state, expectedPage);
            const now = performance.now();
            const changedContext = state.ready && state.context !== source.context;
            const unexpectedPage = state.page !== null && state.page !== source.page && state.page !== expectedPage;
            const changedSource = state.ready && state.page === source.page && state.signature !== source.signature;
            const key = !changedContext && !unexpectedPage && !changedSource ? pageStateKey(state) : '';
            if (key !== transition.candidateKey) {
                transition = { ...transition, candidateKey: key, candidateSince: now, lastProgress: now };
            }
            const stable = !!key && now - transition.candidateSince >= PAGE_STABLE_INTERVAL;
            const elapsed = now - transition.lastProgress;
            if (stable && state.page === expectedPage && state.signature !== source.signature) {
                log(`已自动翻至第 ${expectedPage} 页，继续处理岗位`, 'success');
                return state;
            }
            const stillSource = sameJobPage(state, source);
            if (stable && stillSource && state.page === state.totalPages && state.nextButtonState === '禁用') {
                stopRun('已到最后一页，全部页面处理完成', run.id, '已完成');
                return null;
            }
            // 每次点击重置进展时间，至少等待一个无进展告警周期才可再次尝试。
            const canRetry = transition.attempts > 0 && transition.attempts <= PAGE_RETRY_LIMIT && elapsed >= PAGE_WAIT_WARNING;
            const button = stable && stillSource && state.nextButtonState === '可用'
                ? getPageClickTarget(state, expectedPage, transition.attempts === 0) : null;
            if (button && (!transition.attempts || canRetry)) {
                if (!canContinueRun(run)) return null;
                transition = { ...transition, attempts: transition.attempts + 1, lastProgress: now, candidateKey: '', candidateSince: now };
                setRuntimeStatus('等待页面就绪', `正在前往第 ${expectedPage} 页（第 ${transition.attempts} 次尝试）`);
                // 官网分页器接收原生 click；不改动投递按钮原有的鼠标交互行为。
                button.click();
            } else {
                const exhausted = transition.attempts > PAGE_RETRY_LIMIT && stillSource && elapsed >= PAGE_WAIT_WARNING;
                const unsafeRetry = stable && stillSource && transition.attempts > 0 && !button && elapsed >= PAGE_WAIT_WARNING;
                let reason = `目标第 ${expectedPage} 页：${state.reason}`;
                if (changedContext || unexpectedPage || changedSource) reason = `页面或查询已改变，目标仍为第 ${expectedPage} 页，请核实后恢复`;
                else if (exhausted) reason = `第 ${expectedPage} 页已用完安全重试次数，保留进度等待恢复`;
                else if (unsafeRetry) reason = `没有可用的固定第 ${expectedPage} 页入口，不重复点击下一页`;
                else if (state.ready && state.page === expectedPage && state.signature === source.signature) reason = `第 ${expectedPage} 页列表身份未改变，等待核实，不重复投递`;
                else if (stillSource && state.nextButtonState !== '可用') reason = `目标第 ${expectedPage} 页：下一页尚不可操作，不能据此认定末页`;
                reportPageWait(state, elapsed, reason, changedContext || unexpectedPage || changedSource || exhausted || unsafeRetry);
            }
            await sleep(elapsed >= PAGE_WAIT_WARNING ? PAGE_RECOVERY_INTERVAL : PAGE_POLL_INTERVAL, run.signal, true);
        }
        return null;
    }

    async function runLoop(run) {
        // 翻页等待保持在原调用中；只有新页确认后才进入下一轮岗位处理。
        try {
            let page = await waitForPageReady(run);
            while (canContinueRun(run) && page) {
                if (page.empty) { stopRun('官网明确显示暂无相关职位', run.id, '已完成'); return; }
                setRuntimeStatus('处理中', `正在处理第 ${page.page} 页`);
                const stat = await processCurrentPage(run, page);
                if (!canContinueRun(run)) return;
                log(`当前页处理完成（检测 ${stat.scanned} / 投递 ${stat.applied} / 过滤 ${stat.filtered} / 无按钮 ${stat.noBtn} / 防跳转 ${stat.navSkip} / 其他 ${stat.other}）`);
                if (getState().applied >= getConfig().maxApplyTotal) { stopRun('达到最大投递量', run.id, '已完成'); return; }
                page = await goToNextPage(run, page);
            }
        } catch (error) {
            // 程序异常仍明确报错；旧会话迟到的异常不能停止新运行。
            if (isRunActive(run)) stopRun(`自动投递异常：${error?.message || String(error)}`, run.id);
        }
    }

    /********************************************************
     * 6. UI 呈现与交互控制
     ********************************************************/
    function startRun() {
        // 每轮独立取消信号；旧定时器、AI 响应和等待循环不能加入新一轮。
        if (getState().running) return;
        runGeneration++;
        runController = new AbortController();
        recoveryRequest = null;
        recoveryApprovals = [];
        runStartPathname = location.pathname; // 离页哨兵锚点：锁定本轮起始路径，离开初始列表页即停机（query 变化不误杀）
        const run = { id: runGeneration, signal: runController.signal, path: runStartPathname };
        sessionApplyCounts = new Map(); // 每轮启动清空同岗位投递记录，新一轮重新获得投递与重试额度
        setState({ ...getState(), running: true });
        runtimeStatus = { phase: '等待页面就绪', reason: '正在读取官网搜索列表' };
        log(`🚀 自动投递引擎 V${SCRIPT_VERSION} 已点火（会话 ${run.id}）`, 'success');
        updateUI();
        document.querySelector('.w-log-section').classList.add('open'); // 运行时自动展开日志
        setTimeout(() => { if (isRunActive(run)) runLoop(run); }, 800);
    }
    
    function stopRun(reason = '任务已挂起', runId = runGeneration, phase = '已停止') {
        if (runId !== runGeneration) return;
        runController?.abort();
        recoveryRequest = null;
        recoveryApprovals = [];
        runtimeStatus = { phase, reason };
        setState({ ...getState(), running: false });
        log(`🛑 ${reason}`, 'warn');
        updateUI();
    }

    function renderLogs() {
        const box = document.querySelector('.w-log-content');
        if (!box) return;
        box.innerHTML = runtimeLogs.map(l => {
            const color = l.type === 'error' ? '#ef4444' : l.type === 'success' ? '#10b981' : l.type === 'warn' ? '#f59e0b' : '#94a3b8';
            return `<div class="w-log-item"><span style="color:#475569;">[${l.time}]</span> <span style="color:${color};">${l.msg}</span></div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
    }

    function updateUI() {
        const st = getState(), cfg = getConfig();
        const btn = document.querySelector('#btn-toggle');
        
        document.querySelector('#val-applied').innerText = `${st.applied} / ${cfg.maxApplyTotal}`;
        document.querySelector('#val-filtered').innerText = st.filteredCount;
        // 使用纯文本展示等待原因，不把等待或需要人工处理冒充“仍在投递”。
        const status = document.querySelector('#w-run-status');
        if (status) status.textContent = `${runtimeStatus.phase}：${runtimeStatus.reason}`;
        const resume = document.querySelector('#btn-resume-context');
        if (resume) resume.style.display = st.running && recoveryRequest && runtimeStatus.phase === '需要人工处理' ? '' : 'none';
        
        if (st.running) {
            btn.className = 'w-btn w-btn-danger'; btn.innerHTML = '🛑 停止运行';
        } else {
            btn.className = 'w-btn w-btn-primary'; btn.innerHTML = '🚀 启动智能投递';
        }
    }

    function initUI() {
        if (document.querySelector('#wohz-app')) return;

        // 1. 主控制面板
        const app = document.createElement('div');
        app.id = 'wohz-app';
        app.innerHTML = `
            <div class="w-header">
                <span class="w-title">51job 投递助手</span>
                <span class="w-badge">v${SCRIPT_VERSION} 稳定翻页</span>
            </div>
            
            <div class="w-stats-grid">
                <div class="w-stat-card"><div class="w-stat-val" id="val-applied" style="color:#10b981;">0/0</div><div class="w-stat-label">成功投递</div></div>
                <div class="w-stat-card"><div class="w-stat-val" id="val-filtered" style="color:#f59e0b;">0</div><div class="w-stat-label">规则/AI过滤</div></div>
                <div class="w-stat-card" style="cursor:pointer;" id="btn-reset">
                    <div class="w-stat-val" style="color:#64748b; font-size:14px; margin-top:3px;">↺ 重置</div>
                    <div class="w-stat-label">清空统计数据</div>
                </div>
            </div>

            <div id="w-run-status" role="status" style="padding:0 20px 12px;font-size:12px;line-height:1.5;word-break:break-word;"></div>
            <div class="w-actions">
                <button id="btn-toggle" class="w-btn w-btn-primary">🚀 启动智能投递</button>
                <button id="btn-resume-context" class="w-btn w-btn-sub" style="display:none;">确认当前查询并保留进度恢复</button>
                <div class="w-btn-row">
                    <button id="btn-settings" class="w-btn w-btn-sub">⚙️ 偏好设置</button>
                    <button id="btn-log-toggle" class="w-btn w-btn-sub">📝 终端视图</button>
                </div>
            </div>

            <div class="w-log-section">
                <div class="w-log-header"><span>Terminal Output</span><span style="color:#10b981;">● Online</span></div>
                <div class="w-log-content"></div>
            </div>
        `;
        document.body.appendChild(app);

        // 2. 现代化设置 Modal
        const cfg = getConfig();
        const modalWrap = document.createElement('div');
        modalWrap.className = 'w-modal-mask';
        modalWrap.innerHTML = `
            <div class="w-modal">
                <h2 style="margin:0 0 24px; font-size:20px; font-weight:800; color:#0f172a;">⚙️ 引擎配置中心</h2>
                
                <!-- 任务执行限额：连续自动翻页直至末页，仍遵守成功投递与同岗位投递上限。 -->
                <div class="w-form-group">
                    <div class="w-form-title">任务执行限额 (份 / 次)</div>
                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;"><div style="font-size:12px; color:#64748b; margin-bottom:4px;">成功投递上限</div><input type="number" id="c-maxapply" class="w-input" min="1" step="1" value="${cfg.maxApplyTotal}"></div>
                        <div style="flex:1;"><div style="font-size:12px; color:#64748b; margin-bottom:4px;">同岗位投递上限</div><input type="number" id="c-perjob" class="w-input" min="1" step="1" value="${cfg.maxApplyPerJob}"></div>
                    </div>
                </div>

                <div class="w-form-group">
                    <div class="w-form-title">词法安全网 (逗号分隔)</div>
                    <input type="text" id="c-inc" class="w-input" placeholder="必须包含其一 (如: 前端, React)" value="${cfg.includeKeywords}">
                    <input type="text" id="c-exc" class="w-input" placeholder="一票否决排除词 (如: 外包, 实习)" value="${cfg.excludeKeywords}">
                    <input type="text" id="c-cb" class="w-input" placeholder="黑名单公司" value="${cfg.companyBlacklist}">
                    <input type="text" id="c-tb" class="w-input" placeholder="黑名单职位 (如: 销售, 客服)" value="${cfg.titleBlacklist}">
                </div>

                <div class="w-form-group" style="border-color:#bbf7d0; background:#f0fdf4;">
                    <div class="w-form-title" style="color:#166534;">
                        <span>🧠 大模型 AI 语义过滤</span>
                        <label class="w-switch"><input type="checkbox" id="c-ai" ${cfg.enableAI ? 'checked' : ''}><span class="w-slider"></span></label>
                    </div>
                    <input type="text" id="c-apiUrl" class="w-input" placeholder="OpenAI 兼容接口 (如: DeepSeek API)" value="${cfg.aiApiUrl}">
                    <input type="password" id="c-apiKey" class="w-input" placeholder="Bearer API Key (sk-...)" value="${cfg.aiApiKey}">
                    <div style="display:flex; gap:12px;">
                        <div style="flex:2;"><input type="text" id="c-model" class="w-input" placeholder="模型版本" value="${cfg.aiModel}"></div>
                        <div style="flex:1;"><input type="number" id="c-score" class="w-input" placeholder="及格分(0-100)" value="${cfg.aiMinScore}"></div>
                    </div>
                    <textarea id="c-resume" class="w-input" style="height:80px; resize:none;" placeholder="在此输入你的核心优势、技能与诉求，AI将以此作为打分依据">${cfg.userResume}</textarea>
                </div>

                <div style="display:flex; gap:12px; margin-top:32px;">
                    <button id="btn-save" class="w-btn w-btn-primary">保存配置并生效</button>
                    <button id="btn-cancel" class="w-btn w-btn-sub">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalWrap);

        // 3. 事件绑定
        document.querySelector('#btn-toggle').onclick = () => { getState().running ? stopRun('手动暂停') : startRun(); };
        document.querySelector('#btn-resume-context').onclick = acceptContextRecovery;
        
        // 终端视图折叠/展开
        document.querySelector('#btn-log-toggle').onclick = () => {
            const logSec = document.querySelector('.w-log-section');
            logSec.classList.toggle('open');
            renderLogs(); // 展开时渲染一次
        };
        
        document.querySelector('#btn-reset').onclick = () => { 
            setState({...getState(), applied:0, filteredCount:0}); 
            updateUI(); log('数据统计已归零', 'success'); 
        };

        // Modal 控制
        document.querySelector('#btn-settings').onclick = () => { modalWrap.style.display = 'flex'; setTimeout(()=>modalWrap.classList.add('show'),10); };
        const closeModal = () => { modalWrap.classList.remove('show'); setTimeout(()=>modalWrap.style.display='none',300); };
        document.querySelector('#btn-cancel').onclick = closeModal;

        document.querySelector('#btn-save').onclick = () => {
            setConfig({
                ...getConfig(),
                // 任务执行限额：仅接受 >=1 的整数；空值/0/NaN 等非法输入回退为当前已存值，防止误存导致引擎启动即停
                maxApplyTotal: Math.max(1, parseInt(document.querySelector('#c-maxapply').value) || getConfig().maxApplyTotal),
                maxApplyPerJob: Math.max(1, parseInt(document.querySelector('#c-perjob').value) || getConfig().maxApplyPerJob),
                includeKeywords: document.querySelector('#c-inc').value, excludeKeywords: document.querySelector('#c-exc').value,
                companyBlacklist: document.querySelector('#c-cb').value, titleBlacklist: document.querySelector('#c-tb').value,
                enableAI: document.querySelector('#c-ai').checked, aiApiUrl: document.querySelector('#c-apiUrl').value,
                aiApiKey: document.querySelector('#c-apiKey').value, aiModel: document.querySelector('#c-model').value,
                aiMinScore: parseInt(document.querySelector('#c-score').value) || 70, userResume: document.querySelector('#c-resume').value
            });
            closeModal();
            log('设置已更新', 'success');
            updateUI();
        };

        updateUI();
        renderLogs();
    }

    initUI();
    log(`核心引擎 V${SCRIPT_VERSION} 挂载完毕就绪`, 'success');
})();
