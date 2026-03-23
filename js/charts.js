// ── Chart.js global defaults ──────────────────────────────────────────────────
Chart.defaults.color                              = C.textDim;
Chart.defaults.borderColor                        = C.grid;
Chart.defaults.font.family                        = "'JetBrains Mono', monospace";
Chart.defaults.font.size                          = 10;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle   = "line";
Chart.defaults.animation                          = false;
Chart.defaults.elements.point.radius              = 0;
Chart.defaults.elements.line.borderWidth          = 1.5;

// ── Chart lifecycle ───────────────────────────────────────────────────────────
function destroyCharts() {
    Object.values(charts).forEach((c) => c.destroy());
    charts = {};
}

function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    charts[id] = new Chart(canvas.getContext("2d"), cfg);
}

// ── Shared time-series config factory ────────────────────────────────────────
function tsConfig(labels, datasets, opts = {}) {
    return {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                x: {
                    type: "linear",
                    ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 },
                    grid: { color: C.grid },
                },
                ...opts.scales,
            },
            plugins: {
                tooltip: {
                    backgroundColor: C.card,
                    borderColor: C.cardBorder,
                    borderWidth: 1,
                    titleColor: C.textDim,
                    bodyColor: C.textBright,
                    titleFont: { size: 10 },
                    callbacks: { title: (items) => fmtMs(items[0].parsed.x) },
                },
                legend: { labels: { color: C.textDim, font: { size: 10 } } },
                ...opts.plugins,
            },
            ...opts.extra,
        },
    };
}

// ── Per-tab chart builders ────────────────────────────────────────────────────
function buildOverviewChart(ds, labels) {
    makeChart(
        "chartOverview",
        tsConfig(
            labels,
            [
                { label: "Torque %",  data: ds.map((r) => (r.torque / 32767) * 100),                          borderColor: C.accent, backgroundColor: C.accent + "1a", fill: true, yAxisID: "pct" },
                { label: "DC Bus V",  data: ds.map((r) => r.dcV),                                              borderColor: C.red,    yAxisID: "v" },
                { label: "Speed km/h",data: ds.map((r) => 0.01775 * Math.abs((r.rpm / 32767) * 6000)),         borderColor: C.cyan,   yAxisID: "v" },
            ],
            {
                scales: {
                    pct: { position: "left",  min: 0, max: 100, grid: { color: C.grid }, title: { display: true, text: "%",        color: C.textDim } },
                    v:   { position: "right",              grid: { drawOnChartArea: false }, title: { display: true, text: "V / km/h", color: C.textDim } },
                    x:   { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } },
                },
            },
        ),
    );
}

function buildDriveCharts(ds, labels) {
    makeChart(
        "chartTorque",
        tsConfig(
            labels,
            [{ label: "Torque %", data: ds.map((r) => (r.torque / 32767) * 100), borderColor: C.accent, backgroundColor: C.accent + "1a", fill: true }],
            { scales: { y: { grid: { color: C.grid } }, x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } } } },
        ),
    );

    makeChart(
        "chartRpmSpeed",
        tsConfig(
            labels,
            [
                { label: "RPM",   data: ds.map((r) => (r.rpm / 32767) * 6000),                          borderColor: C.blue, yAxisID: "rpm" },
                { label: "km/h",  data: ds.map((r) => 0.01775 * Math.abs((r.rpm / 32767) * 6000)),      borderColor: C.cyan, yAxisID: "kmh" },
            ],
            {
                scales: {
                    rpm: { position: "left",  grid: { color: C.grid },              title: { display: true, text: "RPM",  color: C.textDim } },
                    kmh: { position: "right", grid: { drawOnChartArea: false },      title: { display: true, text: "km/h", color: C.textDim } },
                    x:   { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } },
                },
            },
        ),
    );

    makeChart(
        "chartDcBus",
        tsConfig(
            labels,
            [{ label: "DC Bus V", data: ds.map((r) => r.dcV), borderColor: C.red, backgroundColor: C.red + "1a", fill: true }],
            { scales: { y: { grid: { color: C.grid } }, x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } } } },
        ),
    );
}

function buildAppsCharts(ds, labels) {
    const a1     = ds.map((r) => Math.max(0, Math.min(100, ((r.a1 - 2884) / (1835 - 2884)) * 100)));
    const a2     = ds.map((r) => Math.max(0, Math.min(100, ((r.a2 - 2910) / (1845 - 2910)) * 100)));
    const dev    = a1.map((v, i) => Math.abs(v - a2[i]));
    const faults = ds.map((r) => (r.fault ? 100 : null));

    makeChart(
        "chartApps",
        tsConfig(
            labels,
            [
                { label: "APPS1 %", data: a1,     borderColor: C.accent },
                { label: "APPS2 %", data: a2,     borderColor: C.blue   },
                { label: "Fault",   data: faults, borderColor: C.red, backgroundColor: C.red + "26", fill: true, borderWidth: 0, pointRadius: 0 },
            ],
            { scales: { y: { min: 0, max: 100, grid: { color: C.grid } }, x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } } } },
        ),
    );

    makeChart("chartAppsDev", {
        type: "line",
        data: { labels, datasets: [{ label: "Deviation %", data: dev, borderColor: C.orange, backgroundColor: C.orange + "26", fill: true }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
                y: { min: 0, grid: { color: C.grid } },
                x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } },
            },
            plugins: {
                annotation: { annotations: { threshold: { type: "line", yMin: 10, yMax: 10, borderColor: C.red, borderDash: [4, 4], borderWidth: 1 } } },
                tooltip: {
                    backgroundColor: C.card,
                    borderColor: C.cardBorder,
                    borderWidth: 1,
                    titleColor: C.textDim,
                    bodyColor: C.textBright,
                    callbacks: { title: (items) => fmtMs(items[0].parsed.x) },
                },
                legend: { labels: { color: C.textDim, font: { size: 10 } } },
            },
        },
    });

    makeChart(
        "chartAppsRaw",
        tsConfig(
            labels,
            [
                { label: "APPS1 raw", data: ds.map((r) => r.a1), borderColor: C.accent, borderWidth: 1 },
                { label: "APPS2 raw", data: ds.map((r) => r.a2), borderColor: C.blue,   borderWidth: 1 },
            ],
            { scales: { y: { grid: { color: C.grid } }, x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } } } },
        ),
    );
}

function buildStatusChart(dsStatus, minMs) {
    const labels  = dsStatus.map((e) => e.ms - minMs);
    const spacing = 1.5;
    const colors  = [C.accent, C.blue, C.cyan, C.red, C.orange, C.pink, C.purple, C.gold, C.blue, C.cyan, C.accent, C.gold];

    const datasets = STATUS_BITS.map((sb, i) => ({
        label:       sb.n,
        data:        dsStatus.map((e) => ((e.word & (1 << sb.b)) ? 1 : 0) + i * spacing),
        borderColor: colors[i % colors.length],
        borderWidth: (sb.n === "ILIM" || sb.n === "FAULT") ? 2.5 : 1.5,
        stepped:     "after",
        fill:        false,
        pointRadius: 0,
    }));

    makeChart("chartStatus", {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            interaction: { mode: "nearest", intersect: false, axis: "x" },
            scales: {
                y: {
                    min:  -0.3,
                    max:  STATUS_BITS.length * spacing + 0.2,
                    grid: { color: C.grid },
                    ticks: {
                        stepSize: spacing,
                        callback: (v) => {
                            const idx = Math.round(v / spacing);
                            if (idx >= 0 && idx < STATUS_BITS.length && Math.abs(v - idx * spacing) < 0.05)
                                return STATUS_BITS[idx].n;
                            return "";
                        },
                    },
                },
                x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } },
            },
            plugins: {
                tooltip: {
                    backgroundColor:  C.card,
                    borderColor:      C.cardBorder,
                    borderWidth:      1,
                    titleColor:       C.textDim,
                    bodyColor:        C.textBright,
                    callbacks: {
                        title:          (items) => fmtMs(items[0].parsed.x),
                        label:          (item)  => {
                            const on = (item.raw - item.datasetIndex * spacing) >= 0.5;
                            return `${STATUS_BITS[item.datasetIndex].n}: ${on ? "ON" : "off"}`;
                        },
                        labelTextColor: (item)  => {
                            const on = (item.raw - item.datasetIndex * spacing) >= 0.5;
                            return on ? C.textBright : C.textDim;
                        },
                    },
                },
                legend: { display: false },
            },
        },
    });
}

function buildRegChart(minMs) {
    if (!selectedRegs.size) return;

    const maxPts   = 3000;
    const datasets = [];
    let allLabels  = new Set();

    [...selectedRegs].forEach((key, i) => {
        const ts = DATA.regTS[key];
        if (!ts) return;
        const ds = downsample(ts.data, maxPts);
        ds.forEach((p) => allLabels.add(p.ms - minMs));
        datasets.push({ key, data: ds, color: CH[i % CH.length], name: `${key} (${ts.u})` });
    });

    const labels  = [...allLabels].sort((a, b) => a - b);
    const chartDS = datasets.map((d) => {
        const map = new Map(d.data.map((p) => [p.ms - minMs, p.value]));
        return { label: d.name, data: labels.map((l) => map.get(l) ?? null), borderColor: d.color, spanGaps: true };
    });

    makeChart(
        "chartReg",
        tsConfig(labels, chartDS, {
            scales: {
                y: { grid: { color: C.grid } },
                x: { type: "linear", ticks: { callback: (v) => fmtMs(v), maxTicksLimit: 12 }, grid: { color: C.grid } },
            },
        }),
    );
}
