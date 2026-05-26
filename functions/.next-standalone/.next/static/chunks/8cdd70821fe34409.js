(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,56710,e=>{"use strict";var t=e.i(43476),a=e.i(71645),i=e.i(78583),o=e.i(31278);function s(){let[e,s]=(0,a.useState)(!1),[d,l]=(0,a.useState)(null),p=async e=>{s(!0),l(e);try{var t;let a,i=localStorage.getItem("memora_token"),o=await fetch("/api/export/pdf",{method:"POST",headers:{"Content-Type":"application/json",...i?{Authorization:`Bearer ${i}`}:{}},body:JSON.stringify({type:e})}),s=await o.json();if(!o.ok)throw Error(s.error);let d=function(e){let{title:t,exportDate:a,userName:i,count:o,type:s,dateRange:d,stats:l,data:p}=e,c=d?.from||d?.to?`📅 ${n(d?.from)} — ${n(d?.to)}`:null,g=`
    <div class="header">
      <div class="header-logo">Memora Bond</div>
      <h1>${r(t)}</h1>
      <p class="subtitle">Exported for ${r(i)} \xb7 ${new Date(a).toLocaleString()}</p>
      ${c?`<div class="date-range">${c}</div>`:""}
    </div>
  `,b=l?`
      <div class="stats">
        ${Object.entries(l).filter(([e])=>"total"!==e).map(([e,t])=>{var a;return`
            <div class="stat">
              <div class="stat-value">${t}</div>
              <div class="stat-label">${({memories:"Memories",sessions:"Sessions",events:"Events",timelineEvents:"Timeline Events",domains:"Domains"})[a=e]||a.replace(/([A-Z])/g," $1").trim()}</div>
            </div>
          `}).join("")}
        ${l.total?`
          <div class="stat">
            <div class="stat-value">${l.total}</div>
            <div class="stat-label">Total Items</div>
          </div>
        `:`
          <div class="stat">
            <div class="stat-value">${o}</div>
            <div class="stat-label">Items</div>
          </div>
        `}
      </div>
    `:`
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${o}</div>
          <div class="stat-label">Items</div>
        </div>
        <div class="stat">
          <div class="stat-value">${new Set(p.map(e=>e.domain||"unknown")).size}</div>
          <div class="stat-label">Domains</div>
        </div>
      </div>
    `;return g+b+p.map(e=>{let t={code:"badge-code",research:"badge-research",decision:"badge-decision",reference:"badge-reference",snippet:"badge-snippet",docs:"badge-docs",social:"badge-social",general:"badge-general"}[e.pageType||e.type]||"badge-general",a=e.createdAt||e.timestamp||e.startedAt,i=a?n(a):"",o=e.content||e.textPreview||e.description||"",s=o.length>500?o.substring(0,497)+"...":o;return`
        <div class="item">
          <div class="item-header">
            <div class="item-title">${r(e.title||"Untitled")}</div>
            <div class="item-date">${i}</div>
          </div>
          ${e.url?`<div class="item-url">${r(e.url)}</div>`:""}
          ${s?`<div class="item-content">${r(s)}</div>`:""}
          <div class="item-meta">
            ${e.pageType||e.type?`<span class="badge ${t}">${r(e.pageType||e.type)}</span>`:""}
            ${e.domain?`<span class="meta-item">🌐 ${r(e.domain)}</span>`:""}
            ${e.sessionId?`<span class="meta-item">🔗 Session</span>`:""}
            ${e.isSensitive?`<span class="badge" style="background:#4a0722;color:#fb7185;border:1px solid #881337;">🔒 Sensitive</span>`:""}
          </div>
          ${e.tags&&(Array.isArray(e.tags)?e.tags:[]).length?`
            <div class="item-tags">
              ${e.tags.map(e=>`<span class="tag">${r(e)}</span>`).join("")}
            </div>
          `:""}
        </div>
      `}).join("")}(s);await (t=`${s.title}.pdf`,void(!(a=window.open("","_blank"))?alert("Please allow popups to export PDF"):(a.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${t}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #e4e4e7;
          background: #000000;
          line-height: 1.6;
        }

        /* ── Header ── */
        .header {
          text-align: center;
          margin-bottom: 36px;
          padding-bottom: 24px;
          border-bottom: 2px solid #7c3aed;
        }
        .header-logo {
          font-size: 14px;
          font-weight: 700;
          color: #7c3aed;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .header h1 {
          font-size: 26px;
          color: #ffffff;
          margin-bottom: 8px;
          font-weight: 700;
        }
        .header .subtitle {
          color: #a1a1aa;
          font-size: 13px;
        }
        .header .date-range {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 14px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 6px;
          color: #a1a1aa;
          font-size: 12px;
        }

        /* ── Stats Row ── */
        .stats {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .stat {
          background: #0a0a0a;
          border: 1px solid #27272a;
          padding: 14px 28px;
          border-radius: 10px;
          text-align: center;
          min-width: 100px;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 700;
          color: #7c3aed;
        }
        .stat-label {
          font-size: 11px;
          color: #71717a;
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* ── Data Items ── */
        .item {
          padding: 18px 0;
          border-bottom: 1px solid #18181b;
          page-break-inside: avoid;
        }
        .item:last-child { border-bottom: none; }
        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
          gap: 12px;
        }
        .item-title {
          font-weight: 600;
          color: #ffffff;
          font-size: 14px;
          flex: 1;
        }
        .item-date {
          color: #52525b;
          font-size: 11px;
          white-space: nowrap;
        }
        .item-url {
          color: #7c3aed;
          font-size: 11px;
          margin-bottom: 6px;
          word-break: break-all;
          opacity: 0.8;
        }
        .item-content {
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.7;
          max-height: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-tags {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .tag {
          background: #1a1a2e;
          color: #a78bfa;
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 11px;
          border: 1px solid #27272a;
        }
        .item-meta {
          display: flex;
          gap: 16px;
          margin-top: 6px;
        }
        .meta-item {
          color: #52525b;
          font-size: 11px;
        }

        /* ── Badges ── */
        .badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .badge-code      { background: #052e16; color: #4ade80; border: 1px solid #166534; }
        .badge-research   { background: #1e1b4b; color: #818cf8; border: 1px solid #312e81; }
        .badge-decision   { background: #431407; color: #fb923c; border: 1px solid #7c2d12; }
        .badge-reference  { background: #1c1917; color: #a8a29e; border: 1px solid #292524; }
        .badge-snippet    { background: #172554; color: #60a5fa; border: 1px solid #1e3a5f; }
        .badge-general    { background: #18181b; color: #a1a1aa; border: 1px solid #27272a; }
        .badge-docs       { background: #172554; color: #60a5fa; border: 1px solid #1e3a5f; }
        .badge-social     { background: #4a0722; color: #fb7185; border: 1px solid #881337; }

        /* ── Section Header ── */
        .section-header {
          color: #7c3aed;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 28px 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #18181b;
        }

        /* ── Footer ── */
        .footer {
          margin-top: 48px;
          padding-top: 20px;
          border-top: 1px solid #18181b;
          text-align: center;
          color: #3f3f46;
          font-size: 11px;
        }
        .footer strong { color: #52525b; }

        /* ── Print overrides ── */
        .no-print { /* shown on screen */ }
        @media print {
          body { padding: 20px; background: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${d}
      <div class="no-print" style="text-align:center; margin: 36px 0;">
        <button onclick="window.print()" style="background: #7c3aed; color: white; border: none; padding: 14px 40px; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: 600; letter-spacing: 0.5px;">
          ⬇ Download PDF
        </button>
      </div>
      <div class="footer">
        Generated by <strong>Memora Bond</strong> — AI Browser Memory \xb7 ${new Date().toLocaleDateString()} \xb7 Confidential
      </div>
    </body>
    </html>
  `),a.document.close())))}catch(e){alert("Export failed: "+e.message)}finally{s(!1),l(null)}};return(0,t.jsxs)("div",{className:"space-y-3",children:[(0,t.jsxs)("h3",{className:"text-sm font-medium text-zinc-200 flex items-center gap-2",children:[(0,t.jsx)(i.FileText,{size:14,className:"text-violet-400"})," Export Data"]}),(0,t.jsx)("div",{className:"grid grid-cols-2 gap-2",children:[{type:"memories",label:"Memories",icon:"🧠"},{type:"timeline",label:"Timeline",icon:"📋"},{type:"sessions",label:"Sessions",icon:"⏱️"},{type:"all",label:"Everything",icon:"📦"}].map(a=>(0,t.jsxs)("button",{onClick:()=>p(a.type),disabled:e,className:"flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-800/50 hover:bg-zinc-800/30 transition-colors text-xs text-zinc-300 hover:text-zinc-100 disabled:opacity-50",children:[e&&d===a.type?(0,t.jsx)(o.Loader2,{size:14,className:"animate-spin"}):(0,t.jsx)("span",{children:a.icon}),a.label]},a.type))})]})}function r(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function n(e){if(!e)return"";try{return new Date(e).toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return String(e)}}e.s(["ExportPDFButton",()=>s])}]);