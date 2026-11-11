// ==UserScript==
// @name         智能求职助手 SmartJobMate (AI驱动的独立自动化投递引擎)
// @namespace    https://github.com/TianMingXTU/smart-job-mate
// @version      1.1.0
// @description  修复UI同步Bug，增加Toast反馈。基于原生化原生JS与平台适配器架构构建的自动化投递助手。支持自定义主流大模型（OpenAI协议），提供硬筛选与大模型JD语义评分双层架构。
// @author       TianMingXTU
// @match        https://www.zhipin.com/*
// @match        https://www.zhaopin.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/589690/%E6%99%BA%E8%83%BD%E6%B1%82%E8%81%8C%E5%8A%A9%E6%89%8B%20SmartJobMate%20%28AI%E9%A9%B1%E5%8A%A8%E7%9A%84%E7%8B%AC%E7%AB%8B%E8%87%AA%E5%8A%A8%E5%8C%96%E6%8A%95%E9%80%92%E5%BC%95%E6%93%8E%29.user.js
// @updateURL https://update.greasyfork.org/scripts/589690/%E6%99%BA%E8%83%BD%E6%B1%82%E8%81%8C%E5%8A%A9%E6%89%8B%20SmartJobMate%20%28AI%E9%A9%B1%E5%8A%A8%E7%9A%84%E7%8B%AC%E7%AB%8B%E8%87%AA%E5%8A%A8%E5%8C%96%E6%8A%95%E9%80%92%E5%BC%95%E6%93%8E%29.meta.js
// ==/UserScript==

(function () {
    'use strict';

    /**
     * ==========================================
     * 核心工具库 (Core Utilities)
     * ==========================================
     */
    const Utils = {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        randomSleep: (min, max) => Utils.sleep(Math.floor(Math.random() * (max - min + 1) + min)),
        qs: (selector, parent = document) => parent.querySelector(selector),
        qsa: (selector, parent = document) => Array.from(parent.querySelectorAll(selector)),
        
        async waitElement(selector, timeout = 5000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = this.qs(selector);
                if (el) return el;
                await this.sleep(200);
            }
            return null;
        },

        parseMaxSalary(salaryStr) {
            if (!salaryStr || typeof salaryStr !== 'string') return 0;
            if (/(天|时|次)/.test(salaryStr)) return 0; 

            const text = salaryStr.toUpperCase().replace(/千/g, 'K');
            let maxVal = 0;

            const rangeMatch = text.match(/[\d.]+\s*(?:K|万)?\s*(?:-|至|~)\s*([\d.]+)\s*(K|万)?/);
            if (rangeMatch) {
                const val = parseFloat(rangeMatch[1]);
                const unit = rangeMatch[2] || (text.includes('万') ? '万' : 'K');
                maxVal = unit === '万' ? val * 10 : val;
            } else {
                const aboveMatch = text.match(/([\d.]+)\s*(K|万)?\s*以上/);
                if (aboveMatch) {
                    const val = parseFloat(aboveMatch[1]);
                    const unit = aboveMatch[2] || 'K';
                    maxVal = unit === '万' ? val * 10 : val;
                }
            }
            return maxVal;
        }
    };

    /**
     * ==========================================
     * AI 引擎 (AI Engine - 第二层架构)
     * ==========================================
     */
    class AIEngine {
        constructor(config) {
            this.config = config;
        }

        async fetchLLM(systemPrompt, userPrompt, isJson = false) {
            const { baseUrl, apiKey, modelName } = this.config;
            if (!apiKey) return null;

            const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    data: JSON.stringify({
                        model: modelName || 'deepseek-chat',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: isJson ? 0.1 : 0.7
                    }),
                    timeout: 15000,
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText);
                            if(data.choices && data.choices.length > 0) {
                                resolve(data.choices[0].message.content.trim());
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        }

        async evaluateJD(jobTitle, jdText, resumeCtx, minScore) {
            const sys = "你是一个无情的AI招聘过滤机器，请只输出纯JSON结构。";
            const usr = `评估候选人与岗位的契合度。\n【岗位】:${jobTitle}\n【JD】:${jdText.substring(0, 800)}\n【候选人】:${resumeCtx.substring(0, 1000)}\n请返回JSON格式: {"score": 85, "reason": "符合要求"}`;
            
            const rawRes = await this.fetchLLM(sys, usr, true);
            let score = minScore; 
            let reason = "大模型解析异常，降级安全放行";

            if (rawRes) {
                const jsonMatch = rawRes.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    try {
                        const p = JSON.parse(jsonMatch[0]);
                        score = p.score ? parseInt(p.score) : score;
                        reason = p.reason || reason;
                    } catch (e) { /* ignore */ }
                } else {
                    const sMatch = rawRes.match(/(\d{1,3})(?:分|%)/);
                    if (sMatch) {
                        score = parseInt(sMatch[1]);
                        reason = "正则表达式模糊提取分数";
                    }
                }
            }
            return { score, reason };
        }
    }

    /**
     * ==========================================
     * 平台适配器架构 (Adapter Pattern)
     * 第一层架构：硬规则过滤
     * ==========================================
     */
    class PlatformAdapter {
        constructor(state, logger) {
            this.state = state;
            this.logger = logger;
            this.ai = new AIEngine(state.config);
        }

        checkHardRules(job) {
            const { title, location, salary, company } = job;
            const c = this.state.config;

            if (c.targetCity && location && !location.includes(c.targetCity)) return `城市不符(${location})`;
            
            if (c.includeWords) {
                const inc = c.includeWords.split(/\s+/).filter(Boolean);
                if (!inc.some(w => title.toLowerCase().includes(w.toLowerCase()))) return `缺少必须关键词`;
            }

            if (c.excludeWords) {
                const exc = c.excludeWords.split(/\s+/).filter(Boolean);
                if (exc.some(w => title.toLowerCase().includes(w.toLowerCase()))) return `触发标题排除词`;
            }

            if (c.blackCompany) {
                const blk = c.blackCompany.split(/\s+/).filter(Boolean);
                if (blk.some(w => company.toLowerCase().includes(w.toLowerCase()))) return `公司黑名单(${company})`;
            }

            if (c.minSalaryK) {
                const maxK = Utils.parseMaxSalary(salary);
                if (maxK > 0 && maxK < parseFloat(c.minSalaryK)) return `薪资上限不足(${maxK}K)`;
            }

            return null; // 通过第一层硬规则
        }
    }

    // Boss直聘 适配器
    class BossAdapter extends PlatformAdapter {
        async runJobs() {
            const loadTimeoutMs = 15000;
            const pollIntervalMs = 300;
            let processedJobIds = new Set();

            // 使用详情链接中的职位标识去重，避免重新扫描时重复处理旧岗位。
            const readPendingJobs = () => {
                const jobs = Utils.qsa('.job-card-box').map(card => {
                    const selector = 'a[href*="/job_detail/"]';
                    const link = card.matches(selector) ? card : Utils.qs(selector, card);
                    const jobId = link?.getAttribute('href')?.match(/\/job_detail\/([^/?#]+)\.html(?:[?#]|$)/)?.[1];
                    return { card, jobId };
                });
                if (jobs.some(job => !job.jobId)) {
                    this.state.stop();
                    this.logger("🛑 无法识别职位详情链接，已停止，避免重复处理岗位。");
                    return null;
                }
                return jobs.filter(job => !processedJobIds.has(job.jobId));
            };

            // 无限滚动会追加岗位，每轮都重新读取，不能只遍历启动时的列表快照。
            while (this.state.isRunning) {
                const cards = readPendingJobs();
                if (!cards) return;
                let scrollY = window.scrollY;

                for (const { card, jobId } of cards) {
                    if (!this.state.isRunning) break;
                    if (this.state.count >= this.state.config.maxCount) {
                        this.state.stop();
                        this.logger("✅ 已达到最大投递目标数量。");
                        this.state.ui.showToast('🎉 任务完成！已达最大投递目标。', 'success');
                        break;
                    }
                    if (processedJobIds.has(jobId)) continue;

                    const title = Utils.qs('.job-name', card)?.innerText || "";
                    const location = Utils.qs('.job-area', card)?.innerText || Utils.qs('.company-location', card)?.innerText || "";
                    const salary = Utils.qs('.salary', card)?.innerText || "";
                    const company = Utils.qs('.company-name', card)?.innerText || "";

                    // 拟人化点击，触发右侧JD加载
                    card.click();
                    await Utils.randomSleep(1000, 1500);

                    const jdEl = Utils.qs('.job-sec-text');
                    const jdText = jdEl ? jdEl.innerText : "";

                    const jobObj = { title, location, salary, company, jdText };
                    const hardReject = this.checkHardRules(jobObj);

                    if (hardReject) {
                        this.logger(`[硬核过滤] ${title} - ${hardReject}`);
                        card.style.opacity = '0.3';
                    } else {
                        let aiPass = true;
                        // 进入第二层 AI 语义判断
                        if (this.state.config.enableAI && this.state.config.apiKey) {
                            this.logger(`[AI评估中] 正在深度分析JD语义：${title}...`);
                            const evalRes = await this.ai.evaluateJD(title, jdText, this.state.config.resumeCtx, this.state.config.minScore);
                            if (evalRes.score < this.state.config.minScore) {
                                aiPass = false;
                                this.logger(`[AI淘汰] ${title} - 得分:${evalRes.score}, ${evalRes.reason}`);
                                card.style.opacity = '0.3';
                            } else {
                                this.logger(`[AI放行] ${title} - 得分:${evalRes.score}, ${evalRes.reason}`);
                            }
                        } else {
                            this.logger(`[匹配] ${title} - 硬性规则校验通过`);
                        }

                        if (aiPass) {
                            const chatBtn = await Utils.waitElement('a.op-btn.op-btn-chat', 2000);
                            if (chatBtn && chatBtn.innerText.includes("立即沟通")) {
                                chatBtn.click();
                                await Utils.randomSleep(1000, 1500);
                                const cancel = Utils.qs('a.default-btn.cancel-btn');
                                if (cancel) cancel.click();
                                this.state.increment();
                            } else {
                                this.logger(`[警告] 沟通按钮不可用，可能已投递`);
                            }
                        }
                    }

                    // 被过滤或沟通按钮不可用的岗位也已完成本次处理，不再重复扫描。
                    processedJobIds = new Set([...processedJobIds, jobId]);
                    scrollY += (card.offsetHeight + 15);
                    window.scrollTo({ top: scrollY, behavior: 'smooth' });
                    await Utils.randomSleep(2000, 4000);
                }

                if (!this.state.isRunning || this.state.count >= this.state.config.maxCount) return;

                // 从卡片祖先中定位实际滚动容器，兼容内部列表滚动与整页滚动。
                const firstCard = Utils.qs('.job-card-box');
                if (firstCard) {
                    let scrollContainer = firstCard.parentElement;
                    while (scrollContainer && scrollContainer !== document.scrollingElement) {
                        const overflowY = getComputedStyle(scrollContainer).overflowY;
                        if (/(auto|scroll|overlay)/.test(overflowY) && scrollContainer.scrollHeight > scrollContainer.clientHeight) break;
                        scrollContainer = scrollContainer.parentElement;
                    }
                    if (!scrollContainer) {
                        this.state.stop();
                        this.logger("🛑 无法识别职位列表滚动容器，已停止加载。");
                        return;
                    }
                    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
                }

                this.logger("正在等待列表加载更多岗位...");
                const waitStart = Date.now();
                let hasNewJobs = false;
                // 等待新职位标识，而非固定延时后假定加载成功；空列表也进入此等待。
                while (this.state.isRunning && Date.now() - waitStart < loadTimeoutMs) {
                    await Utils.sleep(pollIntervalMs);
                    if (!this.state.isRunning) return;
                    const pendingJobs = readPendingJobs();
                    if (!pendingJobs) return;
                    if (pendingJobs.length > 0) {
                        hasNewJobs = true;
                        break;
                    }
                }
                if (!this.state.isRunning) return;
                if (!hasNewJobs) {
                    this.state.stop();
                    this.logger(`🛑 等待 ${loadTimeoutMs / 1000} 秒仍未检测到新岗位，已停止；未确认列表是否到底，请检查页面加载状态。`);
                    return;
                }
            }
        }
    }

    // 智联招聘 适配器
    class ZhilianAdapter extends PlatformAdapter {
        async runJobs() {
            const items = Utils.qsa('.positionlist__list .joblist-box__item');
            for (const item of items) {
                if (!this.state.isRunning) break;
                if (this.state.count >= this.state.config.maxCount) {
                    this.state.stop();
                    this.state.ui.showToast('🎉 任务完成！已达最大投递目标。', 'success');
                    break;
                }

                const jobObj = {
                    title: Utils.qs('.jobinfo__name', item)?.innerText || "",
                    location: Utils.qs('.jobinfo__other-info-item span', item)?.innerText || "",
                    salary: Utils.qs('.jobinfo__salary', item)?.innerText || "",
                    company: Utils.qs('.companyinfo__name', item)?.innerText || ""
                };

                const reject = this.checkHardRules(jobObj);
                if (reject) {
                    this.logger(`[跳过] ${jobObj.title} - ${reject}`);
                    item.style.opacity = '0.3';
                } else {
                    this.logger(`[投递] ${jobObj.title} - 规则通过`);
                    item.style.background = '#1e293b';
                    const btn = Utils.qs('.collect-and-apply__btn', item);
                    if (btn) {
                        btn.click();
                        this.state.increment();
                    }
                }
                await Utils.randomSleep(2000, 3500);
            }

            if (this.state.isRunning && this.state.count < this.state.config.maxCount) {
                const nextBtn = Array.from(document.querySelectorAll('.btn.soupager__btn')).find(e => e.innerText.includes('下一页'));
                if (nextBtn && !nextBtn.disabled) {
                    this.logger("正在翻页...");
                    nextBtn.click();
                    await Utils.randomSleep(3000, 5000);
                    this.runJobs();
                } else {
                    this.state.stop();
                    this.logger("🛑 智联招聘列表完毕");
                }
            }
        }
    }

    /**
     * ==========================================
     * 极客暗黑风 UI 系统 (UI Generation)
     * ==========================================
     */
    class UIEngine {
        constructor(state, startFn, stopFn) {
            this.state = state;
            this.startFn = startFn;
            this.stopFn = stopFn;
            this.toastTimer = null;
            this.injectCSS();
            this.render();
            this.bindEvents();
            this.initDrag();
        }

        injectCSS() {
            const style = document.createElement('style');
            style.textContent = `
                #sjm-root { position:fixed; top:10%; right:5%; z-index:999999; font-family:-apple-system, sans-serif; font-size:13px; color:#e2e8f0; }
                .sjm-panel { width:340px; background:#0f172a; border:1px solid #334155; border-radius:10px; box-shadow:0 15px 35px rgba(0,0,0,0.5); overflow:hidden; display:flex; flex-direction:column; max-height:85vh; }
                .sjm-header { background:#1e293b; padding:12px; display:flex; justify-content:space-between; align-items:center; cursor:move; border-bottom:1px solid #334155; }
                .sjm-header-title { font-weight:700; color:#38bdf8; font-size:14px; margin:0; }
                .sjm-btn-mini { cursor:pointer; background:#334155; padding:2px 8px; border-radius:4px; font-size:12px; transition:0.2s; }
                .sjm-btn-mini:hover { background:#475569; }
                .sjm-tabs { display:flex; background:#0f172a; border-bottom:1px solid #1e293b; }
                .sjm-tab { flex:1; text-align:center; padding:10px 0; cursor:pointer; color:#94a3b8; border-bottom:2px solid transparent; }
                .sjm-tab.active { color:#38bdf8; border-bottom-color:#38bdf8; font-weight:600; }
                .sjm-body { flex:1; overflow-y:auto; padding:12px; scrollbar-width:thin; }
                .sjm-body::-webkit-scrollbar { width:4px; } .sjm-body::-webkit-scrollbar-thumb { background:#475569; border-radius:2px; }
                .sjm-content { display:none; } .sjm-content.active { display:block; }
                .sjm-group { margin-bottom:12px; }
                .sjm-label { display:block; margin-bottom:4px; color:#cbd5e1; font-weight:600; font-size:12px; }
                .sjm-input, .sjm-textarea { width:100%; box-sizing:border-box; background:#1e293b; border:1px solid #334155; color:#f8fafc; padding:8px; border-radius:6px; outline:none; }
                .sjm-input:focus { border-color:#38bdf8; }
                .sjm-textarea { height:80px; resize:vertical; }
                .sjm-btn { width:100%; padding:10px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s; }
                .sjm-btn-primary { background:#0284c7; color:#fff; } .sjm-btn-primary:hover { background:#0369a1; }
                .sjm-btn-danger { background:#dc2626; color:#fff; } .sjm-btn-danger:hover { background:#b91c1c; }
                .sjm-stats { display:flex; justify-content:space-between; background:#1e293b; padding:10px; border-radius:6px; margin-bottom:12px; }
                .sjm-stat-item { text-align:center; } .sjm-stat-val { font-size:16px; font-weight:bold; color:#38bdf8; }
                .sjm-log-box { margin-top:12px; background:#020617; border:1px solid #1e293b; border-radius:6px; height:150px; overflow-y:auto; padding:8px; font-family:monospace; font-size:11px; color:#a3b8cc; line-height:1.4; }
                .sjm-log-box div { margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;}
                #sjm-opener { display:none; position:fixed; bottom:50px; right:30px; background:#0284c7; color:#fff; padding:12px 20px; border-radius:30px; cursor:pointer; font-weight:bold; box-shadow:0 5px 15px rgba(2,132,199,0.4); z-index:999999; }
                .sjm-checkbox { display:flex; justify-content:space-between; align-items:center; }
                
                /* Toast 弹窗动画与样式 */
                .sjm-toast { position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-20px); background:#1e293b; color:#fff; padding:10px 24px; border-radius:8px; font-size:14px; font-weight:600; z-index:9999999; opacity:0; visibility:hidden; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 10px 25px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); }
                .sjm-toast.show { opacity:1; visibility:visible; transform:translateX(-50%) translateY(0); }
                .sjm-toast.success { background:#059669; border-color:#34d399; }
                .sjm-toast.error { background:#dc2626; border-color:#f87171; }
                .sjm-toast.warning { background:#d97706; border-color:#fbbf24; }
            `;
            document.head.appendChild(style);
        }

        render() {
            const root = document.createElement('div');
            root.id = 'sjm-root';
            const { config } = this.state;
            
            root.innerHTML = `
                <div class="sjm-panel" id="sjm-panel">
                    <div class="sjm-header" id="sjm-drag-handle">
                        <h3 class="sjm-header-title">⚡ SmartJobMate V1.1</h3>
                        <div class="sjm-btn-mini" id="sjm-mini">隐藏</div>
                    </div>
                    <div class="sjm-tabs">
                        <div class="sjm-tab active" data-target="tab-run">控制台</div>
                        <div class="sjm-tab" data-target="tab-rule">硬规则</div>
                        <div class="sjm-tab" data-target="tab-ai">AI配置</div>
                    </div>
                    <div class="sjm-body">
                        <!-- 控制台 -->
                        <div class="sjm-content active" id="tab-run">
                            <div class="sjm-stats">
                                <div class="sjm-stat-item"><div class="sjm-label">状态</div><div class="sjm-stat-val" id="sjm-status-text" style="color:#94a3b8">就绪</div></div>
                                <div class="sjm-stat-item"><div class="sjm-label">已投递</div><div class="sjm-stat-val" id="sjm-count-text">0</div></div>
                                <div class="sjm-stat-item"><div class="sjm-label">目标数</div><div class="sjm-stat-val" id="sjm-target-text">${config.maxCount}</div></div>
                            </div>
                            <button class="sjm-btn sjm-btn-primary" id="sjm-toggle-btn">▶ 启动自动化</button>
                            <div class="sjm-log-box" id="sjm-logs"></div>
                        </div>

                        <!-- 规则 -->
                        <div class="sjm-content" id="tab-rule">
                            <div class="sjm-group"><label class="sjm-label">包含词 (空格分隔)</label><input type="text" class="sjm-input" id="cfg-include" value="${config.includeWords}"></div>
                            <div class="sjm-group"><label class="sjm-label">排除词 (标题含此跳过)</label><input type="text" class="sjm-input" id="cfg-exclude" value="${config.excludeWords}"></div>
                            <div class="sjm-group"><label class="sjm-label">公司黑名单</label><input type="text" class="sjm-input" id="cfg-black" value="${config.blackCompany}"></div>
                            <div class="sjm-group"><label class="sjm-label">期望城市</label><input type="text" class="sjm-input" id="cfg-city" value="${config.targetCity}"></div>
                            <div class="sjm-group"><label class="sjm-label">最低薪资(K)</label><input type="number" class="sjm-input" id="cfg-salary" value="${config.minSalaryK}"></div>
                            <div class="sjm-group"><label class="sjm-label">单次运行上限</label><input type="number" class="sjm-input" id="cfg-max" value="${config.maxCount}"></div>
                            <button class="sjm-btn sjm-btn-primary sjm-save">💾 保存硬规则配置</button>
                        </div>

                        <!-- AI -->
                        <div class="sjm-content" id="tab-ai">
                            <div class="sjm-group sjm-checkbox">
                                <label class="sjm-label" style="margin:0;">启用 AI 语义过滤</label>
                                <input type="checkbox" id="cfg-ai-enable" ${config.enableAI ? 'checked' : ''}>
                            </div>
                            <div class="sjm-group"><label class="sjm-label">AI 及格分 (0-100)</label><input type="number" class="sjm-input" id="cfg-score" value="${config.minScore}"></div>
                            <div class="sjm-group"><label class="sjm-label">Base URL</label><input type="text" class="sjm-input" id="cfg-url" value="${config.baseUrl}"></div>
                            <div class="sjm-group"><label class="sjm-label">API Key</label><input type="password" class="sjm-input" id="cfg-key" value="${config.apiKey}"></div>
                            <div class="sjm-group"><label class="sjm-label">Model Name</label><input type="text" class="sjm-input" id="cfg-model" value="${config.modelName}"></div>
                            <div class="sjm-group"><label class="sjm-label">个人简历/亮点 (给大模型的Context)</label><textarea class="sjm-textarea" id="cfg-resume">${config.resumeCtx}</textarea></div>
                            <button class="sjm-btn sjm-btn-primary sjm-save">💾 保存 AI 配置</button>
                        </div>
                    </div>
                </div>
            `;
            
            const opener = document.createElement('div');
            opener.id = 'sjm-opener';
            opener.innerText = '⚙️ 唤醒助手';
            
            // Toast 挂载点
            const toast = document.createElement('div');
            toast.id = 'sjm-toast';
            toast.className = 'sjm-toast';
            
            document.body.appendChild(root);
            document.body.appendChild(opener);
            document.body.appendChild(toast);
        }

        showToast(msg, type = 'success') {
            const toast = document.getElementById('sjm-toast');
            if(!toast) return;
            if(this.toastTimer) clearTimeout(this.toastTimer);
            
            toast.className = `sjm-toast ${type} show`;
            toast.innerText = msg;
            
            this.toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        }

        bindEvents() {
            const click = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
            
            // Tabs 切换
            document.querySelectorAll('.sjm-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    document.querySelectorAll('.sjm-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.sjm-content').forEach(c => c.classList.remove('active'));
                    e.target.classList.add('active');
                    document.getElementById(e.target.dataset.target).classList.add('active');
                });
            });

            // 隐藏与唤醒
            click('sjm-mini', () => { document.getElementById('sjm-root').style.display = 'none'; document.getElementById('sjm-opener').style.display = 'block'; });
            click('sjm-opener', () => { document.getElementById('sjm-root').style.display = 'block'; document.getElementById('sjm-opener').style.display = 'none'; });

            // 保存设置
            document.querySelectorAll('.sjm-save').forEach(btn => {
                btn.addEventListener('click', () => {
                    try {
                        const c = this.state.config;
                        c.includeWords = document.getElementById('cfg-include').value.trim();
                        c.excludeWords = document.getElementById('cfg-exclude').value.trim();
                        c.blackCompany = document.getElementById('cfg-black').value.trim();
                        c.targetCity = document.getElementById('cfg-city').value.trim();
                        c.minSalaryK = document.getElementById('cfg-salary').value.trim();
                        
                        // 获取最大投递数并同步到 UI
                        const maxInput = parseInt(document.getElementById('cfg-max').value);
                        c.maxCount = isNaN(maxInput) ? 50 : maxInput;
                        document.getElementById('sjm-target-text').innerText = c.maxCount; // 【修复显示同步问题】
                        
                        c.enableAI = document.getElementById('cfg-ai-enable').checked;
                        c.minScore = parseInt(document.getElementById('cfg-score').value) || 70;
                        c.baseUrl = document.getElementById('cfg-url').value.trim();
                        c.apiKey = document.getElementById('cfg-key').value.trim();
                        c.modelName = document.getElementById('cfg-model').value.trim();
                        c.resumeCtx = document.getElementById('cfg-resume').value.trim();
                        
                        this.state.saveConfig();
                        this.showToast('✅ 配置已成功保存！'); // 【新增 Toast 弹窗反馈】
                    } catch (e) {
                        this.showToast('❌ 保存失败，请检查输入格式。', 'error');
                    }
                });
            });

            // 启动与停止控制
            const toggleBtn = document.getElementById('sjm-toggle-btn');
            const statusTxt = document.getElementById('sjm-status-text');
            toggleBtn.addEventListener('click', () => {
                if (this.state.isRunning) {
                    this.stopFn();
                    toggleBtn.className = 'sjm-btn sjm-btn-primary';
                    toggleBtn.innerText = '▶ 启动自动化';
                    statusTxt.innerText = '已停止';
                    statusTxt.style.color = '#94a3b8';
                    this.showToast('🛑 任务已被手动终止。', 'warning');
                } else {
                    if (!this.state.config.includeWords) {
                        this.showToast('⚠️ 启动失败：请先配置岗位包含词！', 'error');
                        return;
                    }
                    this.startFn();
                    toggleBtn.className = 'sjm-btn sjm-btn-danger';
                    toggleBtn.innerText = '⏸ 停止执行';
                    statusTxt.innerText = '运行中';
                    statusTxt.style.color = '#10b981';
                    this.showToast('🚀 引擎点火，开始扫描投递...', 'success');
                }
            });
        }

        initDrag() {
            const panel = document.getElementById('sjm-root');
            const handle = document.getElementById('sjm-drag-handle');
            let isDrag = false, ox = 0, oy = 0;

            handle.addEventListener('mousedown', (e) => {
                if(e.target.id === 'sjm-mini') return;
                isDrag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDrag) return;
                requestAnimationFrame(() => {
                    panel.style.left = `${Math.max(0, Math.min(e.clientX - ox, window.innerWidth - panel.offsetWidth))}px`;
                    panel.style.top = `${Math.max(0, Math.min(e.clientY - oy, window.innerHeight - panel.offsetHeight))}px`;
                });
            });
            document.addEventListener('mouseup', () => isDrag = false);
        }

        log(msg) {
            const box = document.getElementById('sjm-logs');
            if(!box) return;
            const time = new Date().toLocaleTimeString();
            const div = document.createElement('div');
            div.innerHTML = `<span style="color:#64748b">[${time}]</span> ${msg}`;
            box.appendChild(div);
            box.scrollTop = box.scrollHeight;
        }

        updateCount(val) {
            document.getElementById('sjm-count-text').innerText = val;
        }
    }

    /**
     * ==========================================
     * 核心生命周期管理 (State Management)
     * ==========================================
     */
    class JobAssistantState {
        constructor() {
            this.isRunning = false;
            this.count = 0;
            this.config = this.loadConfig();
            this.ui = null;
        }

        loadConfig() {
            const def = {
                includeWords: 'AI 大模型 Python', 
                excludeWords: '外包 驻场', 
                blackCompany: '', 
                targetCity: '广州',
                minSalaryK: '15', 
                maxCount: 50,
                enableAI: true, 
                minScore: 70, 
                baseUrl: 'https://api.deepseek.com/v1', 
                apiKey: '', 
                modelName: 'deepseek-chat', 
                resumeCtx: '本科AI专业，熟悉Python、FastAPI、LangChain框架，具备RAG系统架构、本地向量数据库(Milvus/FAISS)与爬虫工程开发经验，曾在创新中心及AI企业担任研发支持。'
            };
            try {
                return { ...def, ...JSON.parse(localStorage.getItem('sjm_config_v1_1') || '{}') };
            } catch (e) { return def; }
        }

        saveConfig() {
            localStorage.setItem('sjm_config_v1_1', JSON.stringify(this.config));
        }

        increment() {
            this.count++;
            if (this.ui) this.ui.updateCount(this.count);
        }

        stop() {
            this.isRunning = false;
            if(this.ui) {
                const btn = document.getElementById('sjm-toggle-btn');
                if(btn) { btn.className = 'sjm-btn sjm-btn-primary'; btn.innerText = '▶ 启动自动化'; }
                document.getElementById('sjm-status-text').innerText = '已停止';
                document.getElementById('sjm-status-text').style.color = '#94a3b8';
            }
        }
    }

    // 启动初始化
    function bootstrap() {
        const state = new JobAssistantState();
        let adapter = null;

        const runHook = () => {
            state.isRunning = true;
            state.ui.log("🚀 开始扫描可见岗位...");
            if (location.host.includes('zhipin.com')) {
                adapter = new BossAdapter(state, (m) => state.ui.log(m));
            } else if (location.host.includes('zhaopin.com')) {
                adapter = new ZhilianAdapter(state, (m) => state.ui.log(m));
            }
            if (adapter) adapter.runJobs();
        };

        const stopHook = () => { state.stop(); state.ui.log("🛑 引擎执行任务已挂起。"); };

        state.ui = new UIEngine(state, runHook, stopHook);
        state.ui.log("✅ SmartJobMate 初始化完毕，随时待命。");
    }

    // 延迟确保DOM加载
    setTimeout(bootstrap, 1500);

})();
