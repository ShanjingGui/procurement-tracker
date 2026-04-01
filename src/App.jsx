import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

// ─── Node Library: all possible nodes ───
const NODE_LIBRARY = [
  { id: "N01", name: "Demand Entry", nameCN: "需求进入", refDays: 2 },
  { id: "N02", name: "Clarification & Data Collection", nameCN: "需求澄清与资料收集", refDays: 5 },
  { id: "N03", name: "Strategy & Supplier Scope", nameCN: "采购策略/供应商范围确认", refDays: 3 },
  { id: "N04", name: "RFQ Preparation", nameCN: "RFQ文件准备", refDays: 5 },
  { id: "N05", name: "RFQ Issued", nameCN: "RFQ发出", refDays: 1 },
  { id: "N06", name: "Supplier Bid Confirmation", nameCN: "供应商确认参标", refDays: 3 },
  { id: "N07", name: "Q&A / Clarification", nameCN: "澄清答疑", refDays: 7 },
  { id: "N08", name: "Bid Receipt", nameCN: "收标/报价接收", refDays: 2 },
  { id: "N09", name: "Evaluation & Comparison", nameCN: "评审/比较", refDays: 5 },
  { id: "N10", name: "Negotiation & Recommendation", nameCN: "谈判/定标建议", refDays: 5 },
  { id: "N11", name: "Contract / PO Approval", nameCN: "合同/PO审批签署", refDays: 7 },
  { id: "N12", name: "Order & Handover", nameCN: "下单与执行移交", refDays: 3 },
  { id: "N13", name: "Archive & Review", nameCN: "归档与复盘", refDays: 2 },
];

// ─── Flow Templates: which nodes are pre-selected ───
const FLOW_TEMPLATES = {
  full: {
    label: "Full Technical Inquiry",
    labelCN: "完整技术询价",
    desc: "完整的招投标流程，适用于正式采购项目",
    nodeIds: ["N01","N02","N03","N04","N05","N06","N07","N08","N09","N10","N11","N12","N13"],
  },
  inquiry_only: {
    label: "Inquiry Only",
    labelCN: "仅询价（不采买）",
    desc: "仅做市场询价和技术摸底，不进入采购和合同阶段",
    nodeIds: ["N01","N02","N04","N05","N06","N07","N08"],
  },
  direct_pr: {
    label: "Direct Purchase Request",
    labelCN: "直接请购",
    desc: "跳过RFQ阶段，直接确认供应商并下单",
    nodeIds: ["N01","N02","N03","N11","N12","N13"],
  },
  custom: {
    label: "Custom",
    labelCN: "自定义流程",
    desc: "从零开始选择需要的节点",
    nodeIds: [],
  },
};

const STATUS_CONFIG = {
  not_started: { label: "Not Started", labelCN: "未开始", color: "#94A3B8", bg: "#F1F5F9", dot: "#CBD5E1" },
  in_progress: { label: "In Progress", labelCN: "进行中", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6" },
  completed: { label: "Completed", labelCN: "已完成", color: "#059669", bg: "#ECFDF5", dot: "#10B981" },
  skipped: { label: "Skipped", labelCN: "已跳过", color: "#A1A1AA", bg: "#FAFAFA", dot: "#D4D4D8" },
  blocked: { label: "Blocked", labelCN: "阻塞", color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
};

const LOG_TYPES = [
  { value: "progress", label: "Progress", labelCN: "进展", icon: "▶", color: "#2563EB", bg: "#EFF6FF" },
  { value: "issue", label: "Issue", labelCN: "问题", icon: "⚠", color: "#DC2626", bg: "#FEF2F2" },
  { value: "experience", label: "Experience", labelCN: "经验", icon: "✦", color: "#D97706", bg: "#FFFBEB" },
  { value: "deviation", label: "Deviation", labelCN: "偏离", icon: "↗", color: "#7C3AED", bg: "#F5F3FF" },
  { value: "decision", label: "Decision", labelCN: "决策", icon: "◆", color: "#059669", bg: "#ECFDF5" },
  { value: "reminder", label: "Reminder", labelCN: "提醒", icon: "⏰", color: "#DB2777", bg: "#FDF2F8" },
];

const PKG_TYPES = [
  { value: "material", label: "Material 材料" },
  { value: "equipment", label: "Equipment 设备" },
  { value: "service", label: "Service 服务" },
];

// ─── Helpers ───
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "—";
const fmtDateFull = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";
const daysBetween = (a, b) => (!a || !b) ? null : Math.round((new Date(b) - new Date(a)) / 86400000);

function buildNodes(selectedNodes, startDate) {
  let c = startDate ? new Date(startDate) : new Date();
  return selectedNodes.map((t, i) => {
    const ps = c.toISOString().slice(0, 10);
    c = new Date(c.getTime() + t.refDays * 86400000);
    return {
      ...t,
      status: "not_started",
      plannedStart: ps,
      plannedEnd: c.toISOString().slice(0, 10),
      actualStart: null,
      actualEnd: null,
      sortOrder: i + 1,
      isCustom: t.isCustom || false,
    };
  });
}

// ─── Supabase Data Layer ───
const db = {
  async loadAll() {
    const [{ data: pkgs, error: e1 }, { data: nodes, error: e2 }, { data: logs, error: e3 }] = await Promise.all([
      supabase.from("packages").select("*").order("created_at", { ascending: false }),
      supabase.from("nodes").select("*").order("sort_order", { ascending: true }),
      supabase.from("logs").select("*").order("timestamp", { ascending: false }),
    ]);
    if (e1 || e2 || e3) { console.error("Load error:", e1, e2, e3); return null; }

    const packages = pkgs.map((p) => ({
      id: p.id,
      packageNo: p.package_no,
      name: p.name,
      project: p.project,
      type: p.type,
      startDate: p.start_date,
      flowTemplate: p.flow_template || "full",
      nodes: nodes
        .filter((n) => n.package_id === p.id)
        .map((n) => ({
          id: n.node_id,
          name: n.name,
          nameCN: n.name_cn,
          refDays: n.ref_days,
          status: n.status,
          plannedStart: n.planned_start,
          plannedEnd: n.planned_end,
          actualStart: n.actual_start,
          actualEnd: n.actual_end,
          sortOrder: n.sort_order,
          isCustom: n.is_custom || false,
          _dbId: n.id,
        })),
    }));

    const formattedLogs = logs.map((l) => ({
      id: l.id, packageId: l.package_id, nodeId: l.node_id,
      type: l.type, content: l.content, timestamp: l.timestamp,
    }));

    return { packages, logs: formattedLogs };
  },

  async createPackage(pkg) {
    const { error: e1 } = await supabase.from("packages").insert({
      id: pkg.id, package_no: pkg.packageNo, name: pkg.name,
      project: pkg.project, type: pkg.type, start_date: pkg.startDate,
      flow_template: pkg.flowTemplate,
    });
    if (e1) { console.error("Create package error:", e1); return false; }

    const nodeRows = pkg.nodes.map((n) => ({
      package_id: pkg.id, node_id: n.id, name: n.name, name_cn: n.nameCN,
      ref_days: n.refDays, status: n.status, planned_start: n.plannedStart,
      planned_end: n.plannedEnd, actual_start: n.actualStart, actual_end: n.actualEnd,
      sort_order: n.sortOrder, is_custom: n.isCustom,
    }));
    const { error: e2 } = await supabase.from("nodes").insert(nodeRows);
    if (e2) { console.error("Create nodes error:", e2); return false; }
    return true;
  },

  async deletePackage(pkgId) {
    const { error } = await supabase.from("packages").delete().eq("id", pkgId);
    if (error) console.error("Delete error:", error);
    return !error;
  },

  async updateNode(pkgId, nodeId, updates) {
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.actualStart !== undefined) dbUpdates.actual_start = updates.actualStart;
    if (updates.actualEnd !== undefined) dbUpdates.actual_end = updates.actualEnd;
    const { error } = await supabase.from("nodes").update(dbUpdates).eq("package_id", pkgId).eq("node_id", nodeId);
    if (error) console.error("Update node error:", error);
    return !error;
  },

  async addNode(pkgId, node) {
    const { error } = await supabase.from("nodes").insert({
      package_id: pkgId, node_id: node.id, name: node.name, name_cn: node.nameCN,
      ref_days: node.refDays, status: node.status, planned_start: node.plannedStart,
      planned_end: node.plannedEnd, actual_start: node.actualStart, actual_end: node.actualEnd,
      sort_order: node.sortOrder, is_custom: node.isCustom,
    });
    if (error) console.error("Add node error:", error);
    return !error;
  },

  async removeNode(pkgId, nodeId) {
    const { error } = await supabase.from("nodes").delete().eq("package_id", pkgId).eq("node_id", nodeId);
    if (error) console.error("Remove node error:", error);
    return !error;
  },

  async addLog(log) {
    const { error } = await supabase.from("logs").insert({
      id: log.id, package_id: log.packageId, node_id: log.nodeId,
      type: log.type, content: log.content, timestamp: log.timestamp,
    });
    if (error) console.error("Add log error:", error);
    return !error;
  },

  async deleteLog(logId) {
    const { error } = await supabase.from("logs").delete().eq("id", logId);
    if (error) console.error("Delete log error:", error);
    return !error;
  },
};

// ─── Fonts & Styles ───
const mono = "'IBM Plex Mono', 'SF Mono', monospace";
const sans = "'Inter', 'Noto Sans SC', system-ui, sans-serif";

const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#FAFBFC;--bg-white:#FFFFFF;--bg-hover:#F5F7FA;--bg-surface:#F0F2F5;--bg-input:#FFFFFF;
  --border:#E5E7EB;--border-strong:#D1D5DB;
  --text:#1A1A2E;--text-secondary:#64748B;--text-muted:#94A3B8;
  --accent:#4F46E5;--accent-light:#EEF2FF;--accent-hover:#4338CA;
  --green:#059669;--red:#DC2626;--amber:#D97706;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.04);--shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);--shadow-md:0 4px 12px rgba(0,0,0,0.06);
  --radius:8px;--radius-lg:12px;
}
body{background:var(--bg);color:var(--text);font-family:${sans};-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5}
.app{min-height:100vh;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 24px;border-bottom:1px solid var(--border);background:var(--bg-white);position:sticky;top:0;z-index:100;box-shadow:var(--shadow-sm)}
.topbar-brand{display:flex;align-items:center;gap:10px}
.logo{width:30px;height:30px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:${mono};font-weight:600;font-size:12px;color:white}
.brand-text h1{font-family:${mono};font-size:13px;font-weight:600;color:var(--text)}
.brand-text span{font-size:11px;color:var(--text-muted);display:block;margin-top:-1px}
.topbar-right{display:flex;gap:8px;align-items:center}
.btn{padding:7px 14px;border-radius:var(--radius);font-size:12px;font-weight:500;font-family:${sans};cursor:pointer;transition:all 0.15s;border:none;display:inline-flex;align-items:center;gap:5px}
.btn-primary{background:var(--accent);color:white}.btn-primary:hover{background:var(--accent-hover);transform:translateY(-0.5px);box-shadow:var(--shadow)}
.btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid var(--border)}.btn-ghost:hover{background:var(--bg-hover);border-color:var(--border-strong);color:var(--text)}
.btn-danger{background:transparent;color:var(--red);border:1px solid rgba(220,38,38,0.2);font-size:11px;padding:5px 10px}.btn-danger:hover{background:rgba(220,38,38,0.05)}
.btn-back{background:var(--bg-surface);color:var(--text-secondary);padding:6px 12px;font-family:${mono};font-size:12px;border:1px solid var(--border)}.btn-back:hover{background:var(--bg-hover);color:var(--text)}
.btn-sm{padding:4px 10px;font-size:11px}
.tabs{display:flex;gap:1px;background:var(--bg-surface);padding:3px;border-radius:var(--radius)}
.tab{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:500;color:var(--text-secondary);cursor:pointer;border:none;background:none;font-family:${sans};transition:all 0.15s}
.tab:hover{color:var(--text)}.tab.active{background:var(--bg-white);color:var(--accent);box-shadow:var(--shadow-sm);font-weight:600}
.main{flex:1;padding:20px 24px;max-width:1400px;margin:0 auto;width:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px}
.card{background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;cursor:pointer;transition:all 0.2s;box-shadow:var(--shadow-sm)}
.card:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-1px)}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.card-id{font-family:${mono};font-size:12px;color:var(--accent);font-weight:600}
.card-name{font-size:14px;font-weight:600;margin-top:2px;color:var(--text);line-height:1.35}
.card-type{font-size:10px;padding:3px 8px;border-radius:20px;background:var(--bg-surface);color:var(--text-secondary);font-family:${mono};text-transform:uppercase;letter-spacing:0.04em;font-weight:500}
.progress{margin:12px 0}.progress-bg{height:3px;background:var(--bg-surface);border-radius:2px;overflow:hidden}
.progress-fill{height:100%;border-radius:2px;transition:width 0.4s ease}
.progress-info{display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:var(--text-muted);font-family:${mono}}
.cur-node{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-surface);border-radius:var(--radius);margin-top:10px}
.cur-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.cur-label{font-size:12px;font-family:${mono};color:var(--text)}.cur-cn{font-size:11px;color:var(--text-secondary)}
.card-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
.card-stat{font-size:11px;color:var(--text-muted);font-family:${mono}}.card-stat b{color:var(--text-secondary);font-weight:600}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-family:${mono};font-weight:600}
.badge-red{background:rgba(220,38,38,0.08);color:var(--red)}.badge-amber{background:rgba(217,119,6,0.08);color:var(--amber)}.badge-green{background:rgba(5,150,105,0.08);color:var(--green)}
.detail-head{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.detail-title{font-size:18px;font-weight:700}.detail-title .id{color:var(--accent);font-family:${mono}}
.detail-meta{font-size:12px;color:var(--text-secondary);font-family:${mono}}
.tl-wrap{background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm);margin-bottom:16px}
.tl-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg-surface)}
.tl-header h3{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}.tl-header .range{font-size:11px;color:var(--text-muted);font-family:${mono}}
.tl-row{display:grid;grid-template-columns:190px 1fr;border-bottom:1px solid var(--border);min-height:52px;transition:background 0.1s}
.tl-row:last-child{border-bottom:none}.tl-row:hover{background:var(--bg-hover)}
.tl-label{padding:8px 14px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--border)}
.tl-label-id{font-family:${mono};font-size:11px;color:var(--accent);font-weight:600}.tl-label-name{font-size:11px;color:var(--text-secondary);margin-top:1px}
.tl-label-custom{font-size:9px;color:var(--amber);font-family:${mono};font-weight:500}
.tl-content{display:flex;flex-direction:column}
.tl-bar-area{flex:1;min-height:28px;position:relative;padding:4px 12px;display:flex;align-items:center}
.tl-bar{height:16px;border-radius:3px;position:absolute;min-width:4px;transition:opacity 0.15s}
.tl-bar.planned{background:var(--bg-surface);border:1px solid var(--border)}.tl-bar.actual{z-index:2;opacity:0.85}.tl-bar:hover{opacity:1}
.tl-today{position:absolute;top:0;bottom:0;width:1.5px;background:var(--accent);opacity:0.25;z-index:1}
.tl-controls{padding:4px 12px 8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sel{padding:4px 8px;border-radius:5px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-size:11px;font-family:${mono};cursor:pointer;outline:none}.sel:focus{border-color:var(--accent)}
.date-in{padding:3px 6px;border-radius:5px;border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-size:11px;font-family:${mono};width:112px;outline:none}.date-in:focus{border-color:var(--accent)}
.form-group{margin-bottom:14px}
.form-group label{display:block;font-size:11px;font-family:${mono};color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;font-weight:500}
.form-input{width:100%;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-input);color:var(--text);font-size:13px;font-family:${sans};outline:none;transition:border-color 0.15s}
.form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}
.form-input-sm{padding:6px 10px;font-size:12px}
.log-panel{background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-sm)}
.log-head{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg-surface)}
.log-head h3{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}.log-hint{font-size:11px;color:var(--text-muted);font-family:${mono}}
.log-input-area{padding:14px 18px;border-bottom:1px solid var(--border)}
.log-ta{width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:10px 12px;font-size:13px;font-family:${sans};resize:vertical;outline:none;transition:border-color 0.15s}
.log-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}.log-ta::placeholder{color:var(--text-muted)}
.log-bar{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap}
.chip-row{display:flex;gap:4px;flex-wrap:wrap}
.chip{padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--bg-white);color:var(--text-secondary);font-family:${mono};transition:all 0.15s;font-weight:500}
.chip:hover{border-color:var(--border-strong);background:var(--bg-hover)}.chip.on{color:white;border-color:transparent}
.filter-bar{padding:8px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px}
.filter-label{font-size:11px;color:var(--text-muted);font-family:${mono};font-weight:500}
.log-entry{display:flex;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);transition:background 0.1s}
.log-entry:last-child{border-bottom:none}.log-entry:hover{background:var(--bg-hover)}
.log-icon{width:28px;height:28px;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:1px}
.log-body{flex:1;min-width:0}.log-text{font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap;word-break:break-word}
.log-meta{display:flex;gap:10px;margin-top:3px;font-size:10px;font-family:${mono};color:var(--text-muted)}.log-meta .tag{color:var(--accent)}
.log-del{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:15px;padding:2px 4px;opacity:0;transition:opacity 0.15s;line-height:1}
.log-entry:hover .log-del{opacity:0.5}.log-del:hover{opacity:1!important;color:var(--red)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.25);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:200}
.modal{background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;width:540px;max-width:92vw;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-md)}
.modal h2{font-size:16px;font-weight:700;margin-bottom:18px}.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
.empty{text-align:center;padding:60px 20px;color:var(--text-muted)}.empty .icon{font-size:36px;margin-bottom:10px;opacity:0.6}
.empty h3{font-size:15px;color:var(--text-secondary);margin-bottom:4px;font-weight:600}.empty p{font-size:12px;margin-bottom:16px}
.loading{text-align:center;padding:60px 20px;color:var(--text-muted)}
.loading .spinner{width:24px;height:24px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.6s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
.sync-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}

/* Template selector */
.tmpl-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.tmpl-card{padding:12px;border:2px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:all 0.15s}
.tmpl-card:hover{border-color:var(--border-strong)}.tmpl-card.selected{border-color:var(--accent);background:var(--accent-light)}
.tmpl-card .tmpl-name{font-size:12px;font-weight:600;color:var(--text)}.tmpl-card .tmpl-cn{font-size:11px;color:var(--text-secondary)}
.tmpl-card .tmpl-desc{font-size:10px;color:var(--text-muted);margin-top:4px;line-height:1.4}

/* Node picker */
.node-picker{border:1px solid var(--border);border-radius:var(--radius);max-height:240px;overflow-y:auto;margin-bottom:16px}
.node-pick-row{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;transition:background 0.1s}
.node-pick-row:last-child{border-bottom:none}.node-pick-row:hover{background:var(--bg-hover)}
.node-pick-row input[type=checkbox]{accent-color:var(--accent);cursor:pointer}
.node-pick-row .nid{font-family:${mono};color:var(--accent);font-weight:600;font-size:11px;min-width:28px}
.node-pick-row .ncn{color:var(--text-secondary);font-size:11px}

/* Add node inline */
.add-node-row{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);background:var(--bg-surface);align-items:center}
.add-node-row input{flex:1}
.add-node-row .days-input{width:50px}

/* Remove node btn in timeline */
.node-rm{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:1px 4px;opacity:0;transition:opacity 0.15s}
.tl-row:hover .node-rm{opacity:0.5}.node-rm:hover{opacity:1!important;color:var(--red)}

::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:var(--border-strong)}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.anim{animation:fadeUp 0.2s ease forwards}
`;

// ─── App ───
export default function App() {
  const [data, setData] = useState({ packages: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState("dashboard");
  const [selPkg, setSelPkg] = useState(null);
  const [modal, setModal] = useState(false);
  const [addNodeModal, setAddNodeModal] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  const reload = useCallback(async () => {
    const result = await db.loadAll();
    if (result) setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openPkg = (id) => { setSelPkg(id); setView("detail"); };
  const goBack = () => { setView("dashboard"); setSelPkg(null); };

  const addPkg = async (p) => {
    setData((d) => ({ ...d, packages: [p, ...d.packages] }));
    setModal(false);
    setSyncing(true);
    await db.createPackage(p);
    setSyncing(false);
  };

  const delPkg = async (id) => {
    setData((d) => ({ packages: d.packages.filter((p) => p.id !== id), logs: d.logs.filter((l) => l.packageId !== id) }));
    goBack();
    setSyncing(true);
    await db.deletePackage(id);
    setSyncing(false);
  };

  const updNode = async (pkgId, nId, u) => {
    setData((d) => ({
      ...d,
      packages: d.packages.map((p) => p.id === pkgId ? { ...p, nodes: p.nodes.map((n) => n.id === nId ? { ...n, ...u } : n) } : p),
    }));
    setSyncing(true);
    await db.updateNode(pkgId, nId, u);
    setSyncing(false);
  };

  const addNodeToPkg = async (pkgId, node) => {
    setData((d) => ({
      ...d,
      packages: d.packages.map((p) => p.id === pkgId ? { ...p, nodes: [...p.nodes, node] } : p),
    }));
    setSyncing(true);
    await db.addNode(pkgId, node);
    setSyncing(false);
    setAddNodeModal(false);
  };

  const removeNodeFromPkg = async (pkgId, nodeId) => {
    setData((d) => ({
      ...d,
      packages: d.packages.map((p) => p.id === pkgId ? { ...p, nodes: p.nodes.filter((n) => n.id !== nodeId) } : p),
    }));
    setSyncing(true);
    await db.removeNode(pkgId, nodeId);
    setSyncing(false);
  };

  const addLog = async (l) => {
    setData((d) => ({ ...d, logs: [l, ...d.logs] }));
    setSyncing(true);
    await db.addLog(l);
    setSyncing(false);
  };

  const delLog = async (id) => {
    setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
    setSyncing(true);
    await db.deleteLog(id);
    setSyncing(false);
  };

  const pkg = data.packages.find((p) => p.id === selPkg);

  if (loading) return (
    <div className="app"><style>{css}</style><div className="loading"><div className="spinner" /><div>Loading...</div></div></div>
  );

  return (
    <div className="app">
      <style>{css}</style>
      <div className="topbar">
        <div className="topbar-brand">
          <div className="logo">PT</div>
          <div className="brand-text">
            <h1>Procurement Tracker</h1>
            <span><span className="sync-dot" style={{ background: syncing ? "var(--amber)" : "var(--green)" }} />{syncing ? "Syncing..." : "采购包招投标管理"}</span>
          </div>
        </div>
        <div className="topbar-right">
          {view === "dashboard" && <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Package</button>}
          <div className="tabs">
            <button className={`tab ${view === "dashboard" ? "active" : ""}`} onClick={goBack}>Dashboard</button>
            {pkg && <button className="tab active">{pkg.packageNo}</button>}
          </div>
        </div>
      </div>
      <div className="main">
        {view === "dashboard" ? (
          <Dashboard pkgs={data.packages} logs={data.logs} onOpen={openPkg} />
        ) : pkg ? (
          <Detail pkg={pkg} logs={data.logs.filter((l) => l.packageId === pkg.id)} logFilter={logFilter} setLogFilter={setLogFilter}
            onBack={goBack} onUpdNode={(nId, u) => updNode(pkg.id, nId, u)} onAddLog={addLog} onDelLog={delLog} onDelPkg={() => delPkg(pkg.id)}
            onShowAddNode={() => setAddNodeModal(true)} onRemoveNode={(nId) => removeNodeFromPkg(pkg.id, nId)} />
        ) : null}
      </div>
      {modal && <CreateModal onClose={() => setModal(false)} onCreate={addPkg} />}
      {addNodeModal && pkg && <AddNodeModal pkg={pkg} onClose={() => setAddNodeModal(false)} onAdd={(node) => addNodeToPkg(pkg.id, node)} />}
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ pkgs, logs, onOpen }) {
  if (!pkgs.length) return (
    <div className="empty anim"><div className="icon">📦</div><h3>No Packages Yet</h3><p>点击右上角 "+ New Package" 创建第一个采购包</p></div>
  );
  return <div className="grid anim">{pkgs.map((p) => <PkgCard key={p.id} pkg={p} logs={logs} onClick={() => onOpen(p.id)} />)}</div>;
}

function PkgCard({ pkg, logs, onClick }) {
  const done = pkg.nodes.filter((n) => n.status === "completed").length;
  const blocked = pkg.nodes.filter((n) => n.status === "blocked").length;
  const active = pkg.nodes.filter((n) => n.status !== "skipped").length;
  const pct = active > 0 ? Math.round((done / active) * 100) : 0;
  const cur = pkg.nodes.find((n) => n.status === "in_progress" || n.status === "blocked") || pkg.nodes.find((n) => n.status === "not_started");
  const pkgLogs = logs.filter((l) => l.packageId === pkg.id);
  const overdue = pkg.nodes.some((n) => n.status === "in_progress" && n.plannedEnd && new Date(n.plannedEnd) < new Date(todayStr()));
  const barColor = blocked > 0 ? "var(--red)" : overdue ? "var(--amber)" : "var(--accent)";
  const tmpl = FLOW_TEMPLATES[pkg.flowTemplate];

  return (
    <div className="card" onClick={onClick}>
      <div className="card-head">
        <div>
          <div className="card-id">{pkg.packageNo}</div>
          <div className="card-name">{pkg.name}</div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {blocked > 0 && <span className="badge badge-red">⚠ {blocked} Blocked</span>}
          {overdue && !blocked && <span className="badge badge-amber">⏰ Overdue</span>}
          <span className="card-type">{pkg.type}</span>
        </div>
      </div>
      <div className="progress">
        <div className="progress-bg"><div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} /></div>
        <div className="progress-info"><span>{pct}%</span><span>{done}/{active} nodes · {tmpl ? tmpl.labelCN : pkg.flowTemplate}</span></div>
      </div>
      {cur && (
        <div className="cur-node">
          <div className="cur-dot" style={{ background: STATUS_CONFIG[cur.status]?.dot }} />
          <div>
            <div className="cur-label">{cur.id}: {cur.name}</div>
            <div className="cur-cn">{cur.nameCN}</div>
          </div>
        </div>
      )}
      <div className="card-foot">
        <span className="card-stat">Logs: <b>{pkgLogs.length}</b></span>
        <span className="card-stat">Start: <b>{fmtDate(pkg.startDate)}</b></span>
      </div>
    </div>
  );
}

// ─── Detail ───
function Detail({ pkg, logs, logFilter, setLogFilter, onBack, onUpdNode, onAddLog, onDelLog, onDelPkg, onShowAddNode, onRemoveNode }) {
  return (
    <div className="anim">
      <div className="detail-head">
        <button className="btn btn-back" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div className="detail-title"><span className="id">{pkg.packageNo}</span> {pkg.name}</div>
          <div className="detail-meta">{pkg.project} · {pkg.type} · {FLOW_TEMPLATES[pkg.flowTemplate]?.labelCN || pkg.flowTemplate} · Started {fmtDate(pkg.startDate)}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onShowAddNode}>+ Add Node</button>
        <button className="btn btn-danger" onClick={onDelPkg}>Delete</button>
      </div>
      <Timeline pkg={pkg} onUpd={onUpdNode} onRemoveNode={onRemoveNode} />
      <div style={{ marginTop: 16 }}>
        <LogPanel pkg={pkg} logs={logs} filter={logFilter} setFilter={setLogFilter} onAdd={onAddLog} onDel={onDelLog} />
      </div>
    </div>
  );
}

// ─── Timeline ───
function Timeline({ pkg, onUpd, onRemoveNode }) {
  const dates = pkg.nodes.flatMap((n) => [n.plannedStart, n.plannedEnd, n.actualStart, n.actualEnd].filter(Boolean));
  dates.push(todayStr());
  const min = new Date(Math.min(...dates.map((d) => +new Date(d))));
  const max = new Date(Math.max(...dates.map((d) => +new Date(d))));
  const range = Math.max(daysBetween(min.toISOString(), max.toISOString()) + 7, 30);
  const toPct = (d) => d ? Math.max(0, Math.min(100, (daysBetween(min.toISOString(), d) / range) * 100)) : 0;
  const todayPct = toPct(todayStr());

  return (
    <div className="tl-wrap">
      <div className="tl-header">
        <h3>📊 Node Timeline ({pkg.nodes.length} nodes)</h3>
        <span className="range">{fmtDateFull(min.toISOString())} → {fmtDateFull(max.toISOString())}</span>
      </div>
      {pkg.nodes.map((n) => {
        const ps = toPct(n.plannedStart), pe = toPct(n.plannedEnd);
        const as_ = n.actualStart ? toPct(n.actualStart) : null;
        const ae = n.actualEnd ? toPct(n.actualEnd) : n.status === "in_progress" ? toPct(todayStr()) : null;
        const sc = STATUS_CONFIG[n.status];
        const isOver = n.status === "in_progress" && n.plannedEnd && new Date(n.plannedEnd) < new Date(todayStr());
        return (
          <div className="tl-row" key={n.id}>
            <div className="tl-label">
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="tl-label-id">{n.id}</span>
                {n.isCustom && <span className="tl-label-custom">CUSTOM</span>}
                <button className="node-rm" onClick={() => onRemoveNode(n.id)} title="Remove node">×</button>
              </div>
              <div className="tl-label-name">{n.nameCN}</div>
            </div>
            <div className="tl-content">
              <div className="tl-bar-area">
                <div className="tl-today" style={{ left: `${todayPct}%` }} />
                <div className="tl-bar planned" style={{ left: `${ps}%`, width: `${Math.max(pe - ps, 0.5)}%`, top: "50%", transform: "translateY(-50%)" }}
                  title={`Planned: ${n.plannedStart} → ${n.plannedEnd}`} />
                {as_ !== null && ae !== null && (
                  <div className="tl-bar actual" style={{ left: `${as_}%`, width: `${Math.max(ae - as_, 0.5)}%`, top: "50%", transform: "translateY(-50%)", background: isOver ? "var(--red)" : sc.color }} title={`Actual: ${n.actualStart} → ${n.actualEnd || "ongoing"}`} />
                )}
              </div>
              <div className="tl-controls">
                <select className="sel" value={n.status} style={{ color: sc.color, fontWeight: 600 }}
                  onChange={(e) => {
                    const s = e.target.value, u = { status: s };
                    if (s === "in_progress" && !n.actualStart) u.actualStart = todayStr();
                    if (s === "completed" && !n.actualEnd) u.actualEnd = todayStr();
                    onUpd(n.id, u);
                  }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.labelCN}</option>)}
                </select>
                <input type="date" className="date-in" value={n.actualStart || ""} title="Actual Start" onChange={(e) => onUpd(n.id, { actualStart: e.target.value })} />
                <input type="date" className="date-in" value={n.actualEnd || ""} title="Actual End" onChange={(e) => onUpd(n.id, { actualEnd: e.target.value })} />
                {isOver && <span className="badge badge-red">逾期 {daysBetween(n.plannedEnd, todayStr())}d</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Log Panel ───
function LogPanel({ pkg, logs, filter, setFilter, onAdd, onDel }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("progress");
  const [node, setNode] = useState("general");
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ id: genId(), packageId: pkg.id, nodeId: node, type, content: text.trim(), timestamp: new Date().toISOString() });
    setText("");
  };
  const onKey = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } };
  const shown = filter === "all" ? logs : logs.filter((l) => l.type === filter);
  return (
    <div className="log-panel">
      <div className="log-head"><h3>📝 Quick Log</h3><span className="log-hint">Ctrl+Enter to submit</span></div>
      <div className="log-input-area">
        <textarea className="log-ta" placeholder="记录进展、问题、经验、偏离..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        <div className="log-bar">
          <div className="chip-row">
            {LOG_TYPES.map((t) => (
              <button key={t.value} className={`chip ${type === t.value ? "on" : ""}`}
                style={type === t.value ? { background: t.color, borderColor: t.color } : {}} onClick={() => setType(t.value)}>{t.icon} {t.labelCN}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select className="sel" value={node} onChange={(e) => setNode(e.target.value)}>
              <option value="general">General</option>
              {pkg.nodes.map((n) => <option key={n.id} value={n.id}>{n.id} {n.nameCN}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!text.trim()} onClick={submit}>Add</button>
          </div>
        </div>
      </div>
      <div className="filter-bar">
        <span className="filter-label">Filter:</span>
        <div className="chip-row">
          <button className={`chip ${filter === "all" ? "on" : ""}`} style={filter === "all" ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}} onClick={() => setFilter("all")}>All ({logs.length})</button>
          {LOG_TYPES.map((t) => {
            const c = logs.filter((l) => l.type === t.value).length;
            if (!c) return null;
            return <button key={t.value} className={`chip ${filter === t.value ? "on" : ""}`} style={filter === t.value ? { background: t.color, borderColor: t.color } : {}} onClick={() => setFilter(t.value)}>{t.icon} {t.labelCN} ({c})</button>;
          })}
        </div>
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {!shown.length ? (
          <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>暂无日志</div>
        ) : shown.map((l) => {
          const tc = LOG_TYPES.find((t) => t.value === l.type) || LOG_TYPES[0];
          const nd = pkg.nodes.find((n) => n.id === l.nodeId);
          return (
            <div className="log-entry" key={l.id}>
              <div className="log-icon" style={{ background: tc.bg, color: tc.color }}>{tc.icon}</div>
              <div className="log-body">
                <div className="log-text">{l.content}</div>
                <div className="log-meta">
                  <span>{new Date(l.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{tc.labelCN}</span>
                  {nd && <span className="tag">{nd.id}</span>}
                  {l.nodeId === "general" && <span className="tag">General</span>}
                </div>
              </div>
              <button className="log-del" onClick={() => onDel(l.id)} title="Delete">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Modal with Template Selection ───
function CreateModal({ onClose, onCreate }) {
  const [f, setF] = useState({ packageNo: "", name: "", project: "", type: "material", startDate: todayStr(), flowTemplate: "full" });
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set(FLOW_TEMPLATES.full.nodeIds));
  const [customNodes, setCustomNodes] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customNameCN, setCustomNameCN] = useState("");
  const [customDays, setCustomDays] = useState("3");

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const selectTemplate = (key) => {
    set("flowTemplate", key);
    setSelectedNodeIds(new Set(FLOW_TEMPLATES[key].nodeIds));
  };

  const toggleNode = (nid) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      next.has(nid) ? next.delete(nid) : next.add(nid);
      return next;
    });
  };

  const addCustomNode = () => {
    if (!customNameCN.trim()) return;
    const cid = "C" + String(customNodes.length + 1).padStart(2, "0");
    setCustomNodes((prev) => [...prev, {
      id: cid, name: customName.trim() || customNameCN.trim(), nameCN: customNameCN.trim(),
      refDays: parseInt(customDays) || 3, isCustom: true,
    }]);
    setCustomName(""); setCustomNameCN(""); setCustomDays("3");
  };

  const removeCustomNode = (cid) => {
    setCustomNodes((prev) => prev.filter((n) => n.id !== cid));
  };

  const handleCreate = () => {
    if (!f.packageNo.trim() || !f.name.trim()) return;
    const libNodes = NODE_LIBRARY.filter((n) => selectedNodeIds.has(n.id));
    const allSelectedNodes = [...libNodes, ...customNodes];
    if (allSelectedNodes.length === 0) return;
    const nodes = buildNodes(allSelectedNodes, f.startDate);
    onCreate({
      id: genId(), packageNo: f.packageNo.trim(), name: f.name.trim(),
      project: f.project.trim(), type: f.type, startDate: f.startDate,
      flowTemplate: f.flowTemplate, nodes,
    });
  };

  const totalNodes = selectedNodeIds.size + customNodes.length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal anim" onClick={(e) => e.stopPropagation()}>
        <h2>New Package 新建采购包</h2>

        {/* Basic info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Package No. 编号</label>
            <input className="form-input" placeholder="e.g. F502" value={f.packageNo} onChange={(e) => set("packageNo", e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Type 类型</label>
            <select className="form-input" value={f.type} onChange={(e) => set("type", e.target.value)} style={{ cursor: "pointer" }}>
              {PKG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Name 名称</label>
          <input className="form-input" placeholder="e.g. EC格栅紧固件" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Project 项目</label>
            <input className="form-input" placeholder="e.g. SAKARYA Phase 3" value={f.project} onChange={(e) => set("project", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Start Date 开始日期</label>
            <input className="form-input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
        </div>

        {/* Template selection */}
        <div className="form-group">
          <label>Flow Template 流程模板</label>
          <div className="tmpl-grid">
            {Object.entries(FLOW_TEMPLATES).map(([key, tmpl]) => (
              <div key={key} className={`tmpl-card ${f.flowTemplate === key ? "selected" : ""}`} onClick={() => selectTemplate(key)}>
                <div className="tmpl-name">{tmpl.label}</div>
                <div className="tmpl-cn">{tmpl.labelCN}</div>
                <div className="tmpl-desc">{tmpl.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Node picker */}
        <div className="form-group">
          <label>Nodes 选择节点 ({totalNodes} selected)</label>
          <div className="node-picker">
            {NODE_LIBRARY.map((n) => (
              <div className="node-pick-row" key={n.id}>
                <input type="checkbox" checked={selectedNodeIds.has(n.id)} onChange={() => toggleNode(n.id)} />
                <span className="nid">{n.id}</span>
                <span style={{ flex: 1, color: "var(--text)" }}>{n.name}</span>
                <span className="ncn">{n.nameCN}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: mono, minWidth: 30, textAlign: "right" }}>{n.refDays}d</span>
              </div>
            ))}
            {customNodes.map((n) => (
              <div className="node-pick-row" key={n.id} style={{ background: "rgba(217,119,6,0.04)" }}>
                <input type="checkbox" checked disabled />
                <span className="nid" style={{ color: "var(--amber)" }}>{n.id}</span>
                <span style={{ flex: 1, color: "var(--text)" }}>{n.name}</span>
                <span className="ncn">{n.nameCN}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: mono, minWidth: 30, textAlign: "right" }}>{n.refDays}d</span>
                <button className="node-rm" style={{ opacity: 1 }} onClick={() => removeCustomNode(n.id)}>×</button>
              </div>
            ))}
            {/* Add custom node */}
            <div className="add-node-row">
              <input className="form-input form-input-sm" placeholder="English name" value={customName} onChange={(e) => setCustomName(e.target.value)} style={{ flex: 1 }} />
              <input className="form-input form-input-sm" placeholder="中文名称 *" value={customNameCN} onChange={(e) => setCustomNameCN(e.target.value)} style={{ flex: 1 }} />
              <input className="form-input form-input-sm days-input" placeholder="Days" type="number" value={customDays} onChange={(e) => setCustomDays(e.target.value)} style={{ width: 55 }} />
              <button className="btn btn-ghost btn-sm" onClick={addCustomNode} disabled={!customNameCN.trim()}>+</button>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.packageNo.trim() || !f.name.trim() || totalNodes === 0} onClick={handleCreate}>
            Create ({totalNodes} nodes)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Node Modal (for existing package) ───
function AddNodeModal({ pkg, onClose, onAdd }) {
  const existingIds = new Set(pkg.nodes.map((n) => n.id));
  const available = NODE_LIBRARY.filter((n) => !existingIds.has(n.id));
  const [selected, setSelected] = useState(null);
  const [customName, setCustomName] = useState("");
  const [customNameCN, setCustomNameCN] = useState("");
  const [customDays, setCustomDays] = useState("3");
  const [mode, setMode] = useState(available.length > 0 ? "library" : "custom");

  const handleAdd = () => {
    const lastNode = pkg.nodes[pkg.nodes.length - 1];
    const startDate = lastNode ? lastNode.plannedEnd : todayStr();
    let node;
    if (mode === "library" && selected) {
      const tpl = NODE_LIBRARY.find((n) => n.id === selected);
      const c = new Date(startDate);
      const pe = new Date(c.getTime() + tpl.refDays * 86400000);
      node = { ...tpl, status: "not_started", plannedStart: startDate, plannedEnd: pe.toISOString().slice(0, 10), actualStart: null, actualEnd: null, sortOrder: pkg.nodes.length + 1, isCustom: false };
    } else if (mode === "custom" && customNameCN.trim()) {
      const cid = "C" + String(pkg.nodes.filter((n) => n.isCustom).length + 1).padStart(2, "0");
      const days = parseInt(customDays) || 3;
      const c = new Date(startDate);
      const pe = new Date(c.getTime() + days * 86400000);
      node = { id: cid, name: customName.trim() || customNameCN.trim(), nameCN: customNameCN.trim(), refDays: days, status: "not_started", plannedStart: startDate, plannedEnd: pe.toISOString().slice(0, 10), actualStart: null, actualEnd: null, sortOrder: pkg.nodes.length + 1, isCustom: true };
    } else return;
    onAdd(node);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal anim" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h2>Add Node 添加节点</h2>

        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {available.length > 0 && (
            <button className={`chip ${mode === "library" ? "on" : ""}`}
              style={mode === "library" ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}}
              onClick={() => setMode("library")}>Standard 标准节点</button>
          )}
          <button className={`chip ${mode === "custom" ? "on" : ""}`}
            style={mode === "custom" ? { background: "var(--amber)", borderColor: "var(--amber)" } : {}}
            onClick={() => setMode("custom")}>Custom 自定义</button>
        </div>

        {mode === "library" && (
          <div className="node-picker" style={{ maxHeight: 260 }}>
            {available.map((n) => (
              <div className="node-pick-row" key={n.id} style={{ cursor: "pointer", background: selected === n.id ? "var(--accent-light)" : "" }} onClick={() => setSelected(n.id)}>
                <input type="radio" name="node" checked={selected === n.id} onChange={() => setSelected(n.id)} style={{ accentColor: "var(--accent)" }} />
                <span className="nid">{n.id}</span>
                <span style={{ flex: 1 }}>{n.name}</span>
                <span className="ncn">{n.nameCN}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: mono }}>{n.refDays}d</span>
              </div>
            ))}
          </div>
        )}

        {mode === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="form-input" placeholder="English name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            <input className="form-input" placeholder="中文名称 *" value={customNameCN} onChange={(e) => setCustomNameCN(e.target.value)} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: mono }}>REF DAYS</label>
              <input className="form-input" type="number" value={customDays} onChange={(e) => setCustomDays(e.target.value)} style={{ width: 70 }} />
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary"
            disabled={mode === "library" ? !selected : !customNameCN.trim()}
            onClick={handleAdd}>Add Node</button>
        </div>
      </div>
    </div>
  );
}
