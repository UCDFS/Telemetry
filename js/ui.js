// ── Small HTML helpers ────────────────────────────────────────────────────────
function stat(label, value, unit, warn) {
    return `<div class="card"><div class="stat-value ${warn ? "warn" : ""}">${value}<span class="stat-unit">${unit}</span></div><div class="stat-label">${label}</div></div>`;
}

function card(title, subtitle, content, cls = "") {
    return `<div class="card ${cls}"><div class="card-header"><span class="card-title">${title}</span>${subtitle ? `<span class="card-subtitle">${subtitle}</span>` : ""}</div>${content}</div>`;
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
function buildTabs() {
    const tabs = [
        { id: "overview",   label: "Overview"           },
        { id: "drive",      label: "Drive Telemetry"    },
        { id: "apps",       label: "APPS Sensors"       },
        { id: "status",     label: "Status Word"        },
        { id: "registers",  label: "Register Explorer"  },
        { id: "can",        label: "CAN Log"            },
        { id: "video",      label: "Video Overlay"      },
    ];
    const bar = document.getElementById("tabBar");
    bar.innerHTML = tabs
        .map((t) => `<button class="tab-btn ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">${t.label}</button>`)
        .join("");
    bar.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.onclick = () => {
            activeTab = btn.dataset.tab;
            renderContent();
            updateTabBar();
        };
    });
}

function updateTabBar() {
    document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === activeTab);
    });
}

// ── CAN frame filter ──────────────────────────────────────────────────────────
function filterCAN() {
    let frames = DATA.can;
    if (canDirFilter !== "ALL") frames = frames.filter((f) => f.dir === canDirFilter);
    if (canFilter) {
        const t = canFilter.toUpperCase();
        frames = frames.filter((f) => {
            if (f.id.toString(16).toUpperCase().padStart(3, "0").includes(t)) return true;
            const rd = REG[f.b[0]];
            if (rd && rd.n.toUpperCase().includes(t)) return true;
            return false;
        });
    }
    return frames;
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderContent() {
    destroyCharts();

    const D    = DATA;
    const S    = D.sensor;
    const area = document.getElementById("contentArea");
    const minMs = D.minMs;

    // Compute summary stats
    const maxRpm     = Math.max(...S.map((r) => Math.abs(r.rpm)));
    const maxTorque  = Math.max(...S.map((r) => r.torque));
    const minDcBus   = Math.min(...S.map((r) => r.dcV));
    const maxDcBus   = Math.max(...S.map((r) => r.dcV));
    const faultCount = S.filter((r) => r.fault).length;
    const duration   = (D.maxMs - minMs) / 1000;
    const rpmActual  = (maxRpm / 32767) * 6000;
    const speedKmh   = 0.01775 * rpmActual;
    const ilimEvents = D.status.filter((e) => (e.word & 0x0020) !== 0);

    // Downsampled series for chart rendering
    const maxPts  = 3000;
    const ds      = downsample(S, maxPts);
    const dsT     = ds.map((r) => fmtMs(r.ms - minMs));   // eslint-disable-line no-unused-vars
    const dsLabels = ds.map((r) => r.ms - minMs);

    let html = "";

    // ══ OVERVIEW ══
    html += `<div class="tab-panel ${activeTab === "overview" ? "active" : ""}" id="panel-overview">`;
    html += `<div class="stats-grid">`;
    html += stat("Peak Speed",      speedKmh.toFixed(1),                    "km/h", false);
    html += stat("Peak RPM",        rpmActual.toFixed(0),                   "rpm",  false);
    html += stat("Max Torque Cmd",  ((maxTorque / 32767) * 100).toFixed(1), "%",    false);
    html += stat("DC Bus Min",      minDcBus.toFixed(1),                    "V",    minDcBus < 40);
    html += stat("DC Bus Max",      maxDcBus.toFixed(1),                    "V",    false);
    html += stat("ILIM Events",     ilimEvents.length,                      "",     ilimEvents.length > 0);
    html += stat("APPS Faults",     faultCount,                             "",     faultCount > 0);
    html += stat("Duration",        duration.toFixed(1),                    "s",    false);
    html += `</div>`;
    html += card(
        "Torque vs DC Bus vs Speed",
        "Primary diagnostic view — look for bus sag under load",
        `<div class="chart-wrap"><canvas id="chartOverview" height="300"></canvas></div>`,
    );
    if (ilimEvents.length > 0) {
        const times = ilimEvents.slice(0, 10).map((e) => fmtMs(e.ms - minMs)).join(", ");
        html += card(
            "⚠ Current Limiting Detected",
            `${ilimEvents.length} STATUS frames with ILIM=1`,
            `<div style="font-size:12px;color:var(--red);line-height:1.6">ILIM flag set at: ${times}${ilimEvents.length > 10 ? ` …and ${ilimEvents.length - 10} more` : ""}</div>
             <div style="font-size:11px;color:var(--text-dim);margin-top:8px;line-height:1.6">Cross-reference with DC Bus voltage — if bus drops below UVP threshold simultaneously, this confirms undervoltage-induced current limiting.</div>`,
            "alert",
        );
    }
    html += `</div>`;

    // ══ DRIVE ══
    html += `<div class="tab-panel ${activeTab === "drive" ? "active" : ""}" id="panel-drive">`;
    html += card("Torque Command",  "Current should track torque — if flat while torque rises, inverter is limiting",    `<div class="chart-wrap"><canvas id="chartTorque"   height="260"></canvas></div>`);
    html += card("RPM & Speed",     "Motor speed and vehicle speed (5.25:1 ratio, 0.247m wheel)",                        `<div class="chart-wrap"><canvas id="chartRpmSpeed" height="260"></canvas></div>`);
    html += card("DC Bus Voltage",  "Watch for sag under load — primary suspect for current limiting",                   `<div class="chart-wrap"><canvas id="chartDcBus"    height="220"></canvas></div>`);
    html += `</div>`;

    // ══ APPS ══
    html += `<div class="tab-panel ${activeTab === "apps" ? "active" : ""}" id="panel-apps">`;
    html += card("APPS Sensor Tracking", "Both sensors should track closely — deviation > 10% triggers plausibility fault",       `<div class="chart-wrap"><canvas id="chartApps"    height="260"></canvas></div>`);
    html += card("APPS Deviation",       "Absolute difference between APPS1% and APPS2% — red line at 10% threshold",            `<div class="chart-wrap"><canvas id="chartAppsDev" height="200"></canvas></div>`);
    html += card("Raw ADC Values",       "APPS1 raw (rest≈2884, full≈1835) / APPS2 raw (rest≈2910, full≈1845)",                  `<div class="chart-wrap"><canvas id="chartAppsRaw" height="200"></canvas></div>`);
    html += `</div>`;

    // ══ STATUS ══
    const dsStatus = downsample(D.status, maxPts);
    html += `<div class="tab-panel ${activeTab === "status" ? "active" : ""}" id="panel-status">`;
    html += card(
        "Status Word Timeline",
        "Each flag plotted as 0/1 over time — ILIM and FAULT are critical",
        `<div class="chart-wrap"><canvas id="chartStatus" height="420"></canvas></div>`,
    );
    const lastEvt = D.status[D.status.length - 1];
    let badgeHtml = '<div class="flex-wrap">';
    STATUS_BITS.forEach((sb) => {
        const active = lastEvt ? (lastEvt.word & (1 << sb.b)) !== 0 : false;
        badgeHtml += `<div style="display:flex;align-items:center;gap:4px"><span class="badge ${active ? "badge-warn" : "badge-ok"}">${sb.n}</span><span style="font-size:10px;color:var(--text-dim)">${sb.d}</span></div>`;
    });
    badgeHtml += '</div><div style="font-size:10px;color:var(--text-dim);margin-top:10px">Showing last known state from final STATUS frame in log.</div>';
    html += card("Status Bit Reference", "", badgeHtml);
    html += `</div>`;

    // ══ REGISTERS ══
    html += `<div class="tab-panel ${activeTab === "registers" ? "active" : ""}" id="panel-registers">`;
    let regBtns = '<div class="flex-wrap">';
    Object.entries(D.regTS).forEach(([key, ts]) => {
        regBtns += `<button class="reg-btn ${selectedRegs.has(key) ? "active" : ""}" data-reg="${key}">${key} ${ts.n} <span style="color:var(--text-dim)">(${ts.data.length})</span></button>`;
    });
    regBtns += "</div>";
    html += card("Select Registers to Plot", "Click to toggle — all decoded BAMOCAR registers from CAN log", regBtns);
    html += card(
        "Register Time Series",
        selectedRegs.size ? [...selectedRegs].join(", ") : "Select registers above",
        `<div class="chart-wrap"><canvas id="chartReg" height="300"></canvas></div>`,
    );
    html += `</div>`;

    // ══ VIDEO ══
    html += `<div class="tab-panel ${activeTab === "video" ? "active" : ""}" id="panel-video">`;
    html += card(
        "Video",
        `<span id="videoFileName">${videoBlobUrl ? "" : "No file loaded"}</span>`,
        `<div id="videoDropZone" class="video-drop-zone">
            <div style="font-size:26px;color:var(--text-dim)">&#9654;</div>
            <div style="font-size:13px;color:var(--text-bright);margin-top:8px">Drop a video file here</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px">or click to browse</div>
            <input type="file" id="videoInput" accept="video/*" style="display:none">
        </div>
        <div id="videoPlayerSlot"></div>`,
    );
    html += card(
        "Sync to Log",
        "Align a known moment in the video with its position in the telemetry",
        `<div class="sync-row">
            <div class="sync-field">
                <div class="sync-label">Video time</div>
                <input type="text" id="syncVideoInput" class="sync-input" placeholder="4:50">
            </div>
            <div style="color:var(--text-dim);padding-top:22px">&#8596;</div>
            <div class="sync-field">
                <div class="sync-label">Log time (seconds)</div>
                <input type="text" id="syncLogInput" class="sync-input" placeholder="287.3">
            </div>
            <div class="sync-field" style="justify-content:flex-end;gap:6px">
                <button class="btn-outline" id="detectStopBtn">Detect stop…</button>
                <button class="btn" id="syncApplyBtn">APPLY SYNC</button>
            </div>
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:10px;line-height:1.8">
            Tip: pause the video at a clear event (car stops, start of run), note the timestamp shown on the video player, then find the same moment on the Drive or Overview charts using the time slider.
            <span id="videoLogTime" style="margin-left:12px;color:var(--accent);font-size:11px"></span>
        </div>
        <div style="font-size:11px;margin-top:8px"><span id="syncStatus" style="color:var(--accent)"></span></div>`,
    );
    html += `</div>`;

    // ══ CAN LOG ══
    const filtered   = filterCAN();
    const totalPages = Math.ceil(filtered.length / CAN_PAGE) || 1;
    const page       = filtered.slice(canPage * CAN_PAGE, (canPage + 1) * CAN_PAGE);
    html += `<div class="tab-panel ${activeTab === "can" ? "active" : ""}" id="panel-can">`;
    let canHtml = `<div class="flex-row">
        <input class="can-filter" id="canFilterInput" placeholder="Filter by ID or register name…" value="${canFilter}">
        <button class="btn-outline ${canDirFilter === "ALL" ? "active" : ""}" data-dir="ALL">ALL</button>
        <button class="btn-outline ${canDirFilter === "TX"  ? "active" : ""}" data-dir="TX">TX</button>
        <button class="btn-outline ${canDirFilter === "RX"  ? "active" : ""}" data-dir="RX">RX</button>
    </div>`;
    canHtml += `<div style="overflow-x:auto"><table class="can-table"><thead><tr><th>Time</th><th>Dir</th><th>ID</th><th>Len</th><th>Data</th><th>Decoded</th></tr></thead><tbody>`;
    page.forEach((f) => {
        const rd = f.id === 0x181 ? REG[f.b[0]] : null;
        let decoded = "";
        if (rd) {
            const rv = rd.sg ? i16(f.b[1], f.b[2]) : u16(f.b[1], f.b[2]);
            decoded = `${rd.n} = ${rd.s(rv).toFixed(2)} ${rd.u}`;
        }
        canHtml += `<tr>
            <td style="color:var(--text-dim)">${fmtMs(f.ms - minMs)}</td>
            <td class="${f.dir === "TX" ? "dir-tx" : "dir-rx"}">${f.dir}</td>
            <td class="id-col">0x${f.id.toString(16).toUpperCase().padStart(3, "0")}</td>
            <td>${f.len}</td>
            <td style="color:var(--text-dim)">${f.b.slice(0, f.len).map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")}</td>
            <td class="${decoded ? "decoded" : ""}" style="${decoded ? "" : "color:var(--text-dim)"}">${decoded || "—"}</td>
        </tr>`;
    });
    canHtml += `</tbody></table></div>`;
    if (totalPages > 1) {
        canHtml += `<div class="can-nav">
            <button class="btn-outline" id="canPrev" ${canPage === 0 ? "disabled" : ""}>← Prev</button>
            <span style="font-size:11px;color:var(--text-dim)">${canPage + 1} / ${totalPages}</span>
            <button class="btn-outline" id="canNext" ${canPage >= totalPages - 1 ? "disabled" : ""}>Next →</button>
        </div>`;
    }
    html += card("Raw CAN Frames", `${filtered.length.toLocaleString()} frames (page ${canPage + 1}/${totalPages})`, canHtml);
    html += `</div>`;

    area.innerHTML = html;

    // ── Wire up interactive controls ──────────────────────────────────────────
    document.querySelectorAll(".reg-btn").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.reg;
            if (selectedRegs.has(key)) selectedRegs.delete(key);
            else selectedRegs.add(key);
            renderContent();
        };
    });

    const canInput = document.getElementById("canFilterInput");
    if (canInput) {
        canInput.oninput = () => {
            canFilter = canInput.value;
            canPage   = 0;
            renderContent();
        };
    }

    document.querySelectorAll("[data-dir]").forEach((btn) => {
        btn.onclick = () => {
            canDirFilter = btn.dataset.dir;
            canPage      = 0;
            renderContent();
        };
    });

    const prevBtn = document.getElementById("canPrev");
    const nextBtn = document.getElementById("canNext");
    if (prevBtn) prevBtn.onclick = () => { canPage = Math.max(0, canPage - 1); renderContent(); };
    if (nextBtn) nextBtn.onclick = () => { canPage++; renderContent(); };

    // ── Build charts for the active tab ───────────────────────────────────────
    if (activeTab === "overview")   buildOverviewChart(ds, dsLabels);
    if (activeTab === "drive")      buildDriveCharts(ds, dsLabels);
    if (activeTab === "apps")       buildAppsCharts(ds, dsLabels);
    if (activeTab === "status")     buildStatusChart(dsStatus, minMs);
    if (activeTab === "registers")  buildRegChart(minMs);
    if (activeTab === "video")      initVideoTab();

    initTimeSlider();
    applyTimeWindow();
    updateVideoPlacement();
}

// ── Time window slider ────────────────────────────────────────────────────────
function initTimeSlider() {
    const totalMs    = DATA.maxMs - DATA.minMs;
    if (chartWindowStart === null) {
        chartWindowStart = 0;
        chartWindowEnd   = totalMs;
    }
    const bar = document.getElementById("timeSliderBar");
    if (!bar) return;
    bar.style.display = "flex";

    const startInput = document.getElementById("sliderStart");
    const endInput   = document.getElementById("sliderEnd");
    const step       = Math.max(50, Math.round(totalMs / 2000));

    [startInput, endInput].forEach((inp) => { inp.min = 0; inp.max = totalMs; inp.step = step; });
    startInput.value = chartWindowStart;
    endInput.value   = chartWindowEnd;
    updateSliderLabels();
    updateSliderFill();

    startInput.oninput = () => {
        if (+startInput.value >= +endInput.value) startInput.value = Math.max(0, +endInput.value - step);
        chartWindowStart = +startInput.value;
        updateSliderLabels();
        updateSliderFill();
        applyTimeWindow();
    };
    endInput.oninput = () => {
        if (+endInput.value <= +startInput.value) endInput.value = Math.min(totalMs, +startInput.value + step);
        chartWindowEnd = +endInput.value;
        updateSliderLabels();
        updateSliderFill();
        applyTimeWindow();
    };
    document.getElementById("sliderReset").onclick = () => {
        chartWindowStart = 0;
        chartWindowEnd   = totalMs;
        startInput.value = 0;
        endInput.value   = totalMs;
        updateSliderLabels();
        updateSliderFill();
        applyTimeWindow();
    };
}

function updateSliderLabels() {
    document.getElementById("sliderMinLabel").textContent = fmtMs(chartWindowStart);
    document.getElementById("sliderMaxLabel").textContent = fmtMs(chartWindowEnd);
}

function updateSliderFill() {
    const startInput = document.getElementById("sliderStart");
    const endInput   = document.getElementById("sliderEnd");
    const fill       = document.getElementById("sliderFill");
    if (!fill || !startInput || !endInput) return;
    const max   = +startInput.max || 1;
    fill.style.left  = (+startInput.value / max * 100) + "%";
    fill.style.right = ((1 - +endInput.value / max) * 100) + "%";
}

function applyTimeWindow() {
    Object.values(charts).forEach((c) => {
        c.options.scales.x.min = chartWindowStart;
        c.options.scales.x.max = chartWindowEnd;
        c.update("none");
    });
}
