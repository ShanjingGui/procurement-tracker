import { useState, useEffect } from "react";

// ─── Constants & Config ───
const NODE_TEMPLATE = [
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

// ─── Storage ───
const STORAGE_KEY = "procurement-tracker-v2";
const loadData = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveData = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : "—";
const fmtDateFull = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";
const daysBetween = (a, b) => (!a || !b) ? null : Math.round((new Date(b) - new Date(a)) / 86400000);

function createNodes(startDate) {
  let c = startDate ? new Date(startDate) : new Date();
  return NODE_TEMPLATE.map((t) => {
    const ps = c.toISOString().slice(0, 10);
    c = new Date(c.getTime() + t.refDays * 86400000);
    return { ...t, status: "not_started", plannedStart: ps, plannedEnd: c.toISOString().slice(0, 10), actualStart: null, actualEnd: null };
  });
}

// ─── Fonts ───
const mono = "'IBM Plex Mono', 'SF Mono', monospace";
const sans = "'Inter', 'Noto Sans SC', system-ui, sans-serif";

// ─── Styles ───
const css = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#FAFBFC;
  --bg-white:#FFFFFF;
  --bg-hover:#F5F7FA;
  --bg-surface:#F0F2F5;
  --bg-input:#FFFFFF;
  --border:#E5E7EB;
  --border-strong:#D1D5DB;
  --text:#1A1A2E;
  --text-secondary:#64748B;
  --text-muted:#94A3B8;
  --accent:#4F46E5;
  --accent-light:#EEF2FF;
  --accent-hover:#4338CA;
  --green:#059669;
  --red:#DC2626;
  --amber:#D97706;
  --shadow-sm:0 1px 2px rgba(0,0,0,0.04);
  --shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:0 4px 12px rgba(0,0,0,0.06);
  --radius:8px;
  --radius-lg:12px;
}
body{background:var(--bg);color:var(--text);font-family:${sans};-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5}
.app{min-height:100vh;display:flex;flex-direction:column}

/* ─── Topbar ─── */
.topbar{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 24px;border-bottom:1px solid var(--border);
  background:var(--bg-white);position:sticky;top:0;z-index:100;
  box-shadow:var(--shadow-sm);
}
.topbar-brand{display:flex;align-items:center;gap:10px}
.logo{
  width:30px;height:30px;background:var(--accent);border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  font-family:${mono};font-weight:600;font-size:12px;color:white;letter-spacing:-0.02em;
}
.brand-text h1{font-family:${mono};font-size:13px;font-weight:600;color:var(--text);letter-spacing:-0.02em}
.brand-text span{font-size:11px;color:var(--text-muted);display:block;margin-top:-1px}
.topbar-right{display:flex;gap:8px;align-items:center}

/* ─── Buttons ─── */
.btn{
  padding:7px 14px;border-radius:var(--radius);font-size:12px;font-weight:500;
  font-family:${sans};cursor:pointer;transition:all 0.15s;border:none;display:inline-flex;align-items:center;gap:5px;
}
.btn-primary{background:var(--accent);color:white}
.btn-primary:hover{background:var(--accent-hover);transform:translateY(-0.5px);box-shadow:var(--shadow)}
.btn-primary:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid var(--border)}
.btn-ghost:hover{background:var(--bg-hover);border-color:var(--border-strong);color:var(--text)}
.btn-danger{background:transparent;color:var(--red);border:1px solid rgba(220,38,38,0.2);font-size:11px;padding:5px 10px}
.btn-danger:hover{background:rgba(220,38,38,0.05)}
.btn-back{background:var(--bg-surface);color:var(--text-secondary);padding:6px 12px;font-family:${mono};font-size:12px;border:1px solid var(--border)}
.btn-back:hover{background:var(--bg-hover);color:var(--text)}

/* ─── Tabs ─── */
.tabs{display:flex;gap:1px;background:var(--bg-surface);padding:3px;border-radius:var(--radius)}
.tab{
  padding:5px 14px;border-radius:6px;font-size:12px;font-weight:500;
  color:var(--text-secondary);cursor:pointer;border:none;background:none;font-family:${sans};transition:all 0.15s;
}
.tab:hover{color:var(--text)}
.tab.active{background:var(--bg-white);color:var(--accent);box-shadow:var(--shadow-sm);font-weight:600}

/* ─── Main ─── */
.main{flex:1;padding:20px 24px;max-width:1400px;margin:0 auto;width:100%}

/* ─── Cards ─── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px}
.card{
  background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:18px 20px;cursor:pointer;transition:all 0.2s;box-shadow:var(--shadow-sm);
}
.card:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-1px)}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.card-id{font-family:${mono};font-size:12px;color:var(--accent);font-weight:600}
.card-name{font-size:14px;font-weight:600;margin-top:2px;color:var(--text);line-height:1.35}
.card-type{
  font-size:10px;padding:3px 8px;border-radius:20px;
  background:var(--bg-surface);color:var(--text-secondary);
  font-family:${mono};text-transform:uppercase;letter-spacing:0.04em;font-weight:500;
}

/* Progress */
.progress{margin:12px 0}
.progress-bg{height:3px;background:var(--bg-surface);border-radius:2px;overflow:hidden}
.progress-fill{height:100%;border-radius:2px;transition:width 0.4s ease}
.progress-info{display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:var(--text-muted);font-family:${mono}}

/* Current node chip */
.cur-node{
  display:flex;align-items:center;gap:8px;padding:8px 12px;
  background:var(--bg-surface);border-radius:var(--radius);margin-top:10px;
}
.cur-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.cur-label{font-size:12px;font-family:${mono};color:var(--text)}
.cur-cn{font-size:11px;color:var(--text-secondary)}

/* Card footer */
.card-foot{
  display:flex;justify-content:space-between;align-items:center;
  margin-top:12px;padding-top:10px;border-top:1px solid var(--border);
}
.card-stat{font-size:11px;color:var(--text-muted);font-family:${mono}}
.card-stat b{color:var(--text-secondary);font-weight:600}

/* ─── Badge ─── */
.badge{
  display:inline-flex;align-items:center;gap:3px;
  padding:2px 8px;border-radius:20px;font-size:10px;font-family:${mono};font-weight:600;
}
.badge-red{background:rgba(220,38,38,0.08);color:var(--red)}
.badge-amber{background:rgba(217,119,6,0.08);color:var(--amber)}
.badge-green{background:rgba(5,150,105,0.08);color:var(--green)}

/* ─── Detail Header ─── */
.detail-head{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.detail-title{font-size:18px;font-weight:700}
.detail-title .id{color:var(--accent);font-family:${mono}}
.detail-meta{font-size:12px;color:var(--text-secondary);font-family:${mono}}

/* ─── Timeline ─── */
.tl-wrap{
  background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);
  overflow:hidden;box-shadow:var(--shadow-sm);margin-bottom:16px;
}
.tl-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg-surface);
}
.tl-header h3{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.tl-header .range{font-size:11px;color:var(--text-muted);font-family:${mono}}

.tl-row{
  display:grid;grid-template-columns:190px 1fr;
  border-bottom:1px solid var(--border);min-height:52px;transition:background 0.1s;
}
.tl-row:last-child{border-bottom:none}
.tl-row:hover{background:var(--bg-hover)}
.tl-label{
  padding:8px 14px;display:flex;flex-direction:column;justify-content:center;
  border-right:1px solid var(--border);
}
.tl-label-id{font-family:${mono};font-size:11px;color:var(--accent);font-weight:600}
.tl-label-name{font-size:11px;color:var(--text-secondary);margin-top:1px}

.tl-content{display:flex;flex-direction:column}
.tl-bar-area{flex:1;min-height:28px;position:relative;padding:4px 12px;display:flex;align-items:center}
.tl-bar{
  height:16px;border-radius:3px;position:absolute;min-width:4px;
  transition:opacity 0.15s;
}
.tl-bar.planned{background:var(--bg-surface);border:1px solid var(--border)}
.tl-bar.actual{z-index:2;opacity:0.85}
.tl-bar:hover{opacity:1}
.tl-today{position:absolute;top:0;bottom:0;width:1.5px;background:var(--accent);opacity:0.25;z-index:1}

.tl-controls{
  padding:4px 12px 8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
}

/* ─── Form elements ─── */
.sel{
  padding:4px 8px;border-radius:5px;border:1px solid var(--border);
  background:var(--bg-input);color:var(--text);font-size:11px;font-family:${mono};cursor:pointer;outline:none;
}
.sel:focus{border-color:var(--accent)}
.date-in{
  padding:3px 6px;border-radius:5px;border:1px solid var(--border);
  background:var(--bg-input);color:var(--text);font-size:11px;font-family:${mono};width:112px;outline:none;
}
.date-in:focus{border-color:var(--accent)}
.form-group{margin-bottom:14px}
.form-group label{
  display:block;font-size:11px;font-family:${mono};color:var(--text-secondary);
  margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em;font-weight:500;
}
.form-input{
  width:100%;padding:8px 12px;border-radius:var(--radius);border:1px solid var(--border);
  background:var(--bg-input);color:var(--text);font-size:13px;font-family:${sans};outline:none;transition:border-color 0.15s;
}
.form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}

/* ─── Log Panel ─── */
.log-panel{
  background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);
  overflow:hidden;box-shadow:var(--shadow-sm);
}
.log-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg-surface);
}
.log-head h3{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.log-hint{font-size:11px;color:var(--text-muted);font-family:${mono}}

.log-input-area{padding:14px 18px;border-bottom:1px solid var(--border)}
.log-ta{
  width:100%;min-height:60px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);
  color:var(--text);padding:10px 12px;font-size:13px;font-family:${sans};resize:vertical;outline:none;transition:border-color 0.15s;
}
.log-ta:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light)}
.log-ta::placeholder{color:var(--text-muted)}

.log-bar{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap}
.chip-row{display:flex;gap:4px;flex-wrap:wrap}
.chip{
  padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;
  border:1px solid var(--border);background:var(--bg-white);color:var(--text-secondary);
  font-family:${mono};transition:all 0.15s;font-weight:500;
}
.chip:hover{border-color:var(--border-strong);background:var(--bg-hover)}
.chip.on{color:white;border-color:transparent}

/* ─── Filter bar ─── */
.filter-bar{
  padding:8px 18px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:6px;
}
.filter-label{font-size:11px;color:var(--text-muted);font-family:${mono};font-weight:500}

/* ─── Log entry ─── */
.log-entry{
  display:flex;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);transition:background 0.1s;
}
.log-entry:last-child{border-bottom:none}
.log-entry:hover{background:var(--bg-hover)}
.log-icon{
  width:28px;height:28px;border-radius:var(--radius);
  display:flex;align-items:center;justify-content:center;
  font-size:12px;flex-shrink:0;margin-top:1px;
}
.log-body{flex:1;min-width:0}
.log-text{font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap;word-break:break-word}
.log-meta{display:flex;gap:10px;margin-top:3px;font-size:10px;font-family:${mono};color:var(--text-muted)}
.log-meta .tag{color:var(--accent)}
.log-del{
  background:none;border:none;color:var(--text-muted);cursor:pointer;
  font-size:15px;padding:2px 4px;opacity:0;transition:opacity 0.15s;line-height:1;
}
.log-entry:hover .log-del{opacity:0.5}
.log-del:hover{opacity:1!important;color:var(--red)}

/* ─── Modal ─── */
.overlay{
  position:fixed;inset:0;background:rgba(0,0,0,0.25);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;z-index:200;
}
.modal{
  background:var(--bg-white);border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:24px;width:440px;max-width:92vw;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-md);
}
.modal h2{font-size:16px;font-weight:700;margin-bottom:18px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}

/* ─── Empty ─── */
.empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.empty .icon{font-size:36px;margin-bottom:10px;opacity:0.6}
.empty h3{font-size:15px;color:var(--text-secondary);margin-bottom:4px;font-weight:600}
.empty p{font-size:12px;margin-bottom:16px}

/* ─── Scroll ─── */
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--border-strong)}

/* ─── Animation ─── */
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.anim{animation:fadeUp 0.2s ease forwards}
`;

// ─── App ───
export default function App() {
  const [data, setData] = useState(() => loadData() || { packages: [], logs: [] });
  const [view, setView] = useState("dashboard");
  const [selPkg, setSelPkg] = useState(null);
  const [modal, setModal] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  useEffect(() => { saveData(data); }, [data]);

  const openPkg = (id) => { setSelPkg(id); setView("detail"); };
  const goBack = () => { setView("dashboard"); setSelPkg(null); };

  const addPkg = (p) => { setData((d) => ({ ...d, packages: [...d.packages, p] })); setModal(false); };
  const delPkg = (id) => { setData((d) => ({ packages: d.packages.filter((p) => p.id !== id), logs: d.logs.filter((l) => l.packageId !== id) })); goBack(); };
  const updNode = (pkgId, nId, u) => {
    setData((d) => ({
      ...d,
      packages: d.packages.map((p) => p.id === pkgId ? { ...p, nodes: p.nodes.map((n) => n.id === nId ? { ...n, ...u } : n) } : p),
    }));
  };
  const addLog = (l) => { setData((d) => ({ ...d, logs: [l, ...d.logs] })); };
  const delLog = (id) => { setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) })); };

  const pkg = data.packages.find((p) => p.id === selPkg);

  return (
    <div className="app">
      <style>{css}</style>
      <div className="topbar">
        <div className="topbar-brand">
          <div className="logo">PT</div>
          <div className="brand-text">
            <h1>Procurement Tracker</h1>
            <span>采购包招投标管理</span>
          </div>
        </div>
        <div className="topbar-right">
          {view === "dashboard" && (
            <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Package</button>
          )}
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
            onBack={goBack} onUpdNode={(nId, u) => updNode(pkg.id, nId, u)} onAddLog={addLog} onDelLog={delLog} onDelPkg={() => delPkg(pkg.id)} />
        ) : null}
      </div>

      {modal && <CreateModal onClose={() => setModal(false)} onCreate={addPkg} />}
    </div>
  );
}

// ─── Dashboard ───
function Dashboard({ pkgs, logs, onOpen }) {
  if (!pkgs.length) return (
    <div className="empty anim">
      <div className="icon">📦</div>
      <h3>No Packages Yet</h3>
      <p>点击右上角 "+ New Package" 创建第一个采购包</p>
    </div>
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
        <div className="progress-info"><span>{pct}%</span><span>{done}/{active} nodes</span></div>
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
function Detail({ pkg, logs, logFilter, setLogFilter, onBack, onUpdNode, onAddLog, onDelLog, onDelPkg }) {
  return (
    <div className="anim">
      <div className="detail-head">
        <button className="btn btn-back" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div className="detail-title"><span className="id">{pkg.packageNo}</span> {pkg.name}</div>
          <div className="detail-meta">{pkg.project} · {pkg.type} · Started {fmtDate(pkg.startDate)}</div>
        </div>
        <button className="btn btn-danger" onClick={onDelPkg}>Delete</button>
      </div>
      <Timeline pkg={pkg} onUpd={onUpdNode} />
      <div style={{ marginTop: 16 }}>
        <LogPanel pkg={pkg} logs={logs} filter={logFilter} setFilter={setLogFilter} onAdd={onAddLog} onDel={onDelLog} />
      </div>
    </div>
  );
}

// ─── Timeline ───
function Timeline({ pkg, onUpd }) {
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
        <h3>📊 Node Timeline</h3>
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
              <div className="tl-label-id">{n.id}</div>
              <div className="tl-label-name">{n.nameCN}</div>
            </div>
            <div className="tl-content">
              <div className="tl-bar-area">
                <div className="tl-today" style={{ left: `${todayPct}%` }} />
                <div className="tl-bar planned" style={{ left: `${ps}%`, width: `${Math.max(pe - ps, 0.5)}%`, top: "50%", transform: "translateY(-50%)" }}
                  title={`Planned: ${n.plannedStart} → ${n.plannedEnd}`} />
                {as_ !== null && ae !== null && (
                  <div className="tl-bar actual" style={{
                    left: `${as_}%`, width: `${Math.max(ae - as_, 0.5)}%`,
                    top: "50%", transform: "translateY(-50%)",
                    background: isOver ? "var(--red)" : sc.color,
                  }} title={`Actual: ${n.actualStart} → ${n.actualEnd || "ongoing"}`} />
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
                <input type="date" className="date-in" value={n.actualStart || ""} title="Actual Start"
                  onChange={(e) => onUpd(n.id, { actualStart: e.target.value })} />
                <input type="date" className="date-in" value={n.actualEnd || ""} title="Actual End"
                  onChange={(e) => onUpd(n.id, { actualEnd: e.target.value })} />
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
      <div className="log-head">
        <h3>📝 Quick Log</h3>
        <span className="log-hint">Ctrl+Enter to submit</span>
      </div>
      <div className="log-input-area">
        <textarea className="log-ta" placeholder="记录进展、问题、经验、偏离..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
        <div className="log-bar">
          <div className="chip-row">
            {LOG_TYPES.map((t) => (
              <button key={t.value} className={`chip ${type === t.value ? "on" : ""}`}
                style={type === t.value ? { background: t.color, borderColor: t.color } : {}}
                onClick={() => setType(t.value)}>
                {t.icon} {t.labelCN}
              </button>
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
          <button className={`chip ${filter === "all" ? "on" : ""}`}
            style={filter === "all" ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}}
            onClick={() => setFilter("all")}>All ({logs.length})</button>
          {LOG_TYPES.map((t) => {
            const c = logs.filter((l) => l.type === t.value).length;
            if (!c) return null;
            return (
              <button key={t.value} className={`chip ${filter === t.value ? "on" : ""}`}
                style={filter === t.value ? { background: t.color, borderColor: t.color } : {}}
                onClick={() => setFilter(t.value)}>
                {t.icon} {t.labelCN} ({c})
              </button>
            );
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

// ─── Create Modal ───
function CreateModal({ onClose, onCreate }) {
  const [f, setF] = useState({ packageNo: "", name: "", project: "", type: "material", startDate: todayStr() });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal anim" onClick={(e) => e.stopPropagation()}>
        <h2>New Package 新建采购包</h2>
        <div className="form-group">
          <label>Package No. 采购包编号</label>
          <input className="form-input" placeholder="e.g. F502" value={f.packageNo} onChange={(e) => set("packageNo", e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>Name 名称</label>
          <input className="form-input" placeholder="e.g. EC格栅紧固件" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Project 项目</label>
          <input className="form-input" placeholder="e.g. SAKARYA Phase 3 FPU" value={f.project} onChange={(e) => set("project", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Type 类型</label>
          <select className="form-input" value={f.type} onChange={(e) => set("type", e.target.value)} style={{ cursor: "pointer" }}>
            {PKG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Start Date 开始日期 (MRQ Issued)</label>
          <input className="form-input" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.packageNo.trim() || !f.name.trim()}
            onClick={() => onCreate({ id: genId(), ...f, packageNo: f.packageNo.trim(), name: f.name.trim(), project: f.project.trim(), nodes: createNodes(f.startDate) })}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
