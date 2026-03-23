// ── Video overlay state ───────────────────────────────────────────────────────
let persistentVideoEl = null;
let videoBlobUrl      = null;
let videoOffset       = null;   // logMs = currentTime * 1000 - videoOffset
let rafId             = null;
let dragInitialized   = false;

// ── Persistent video element (survives tab switches) ─────────────────────────
function getVideoEl() {
    if (!persistentVideoEl) {
        persistentVideoEl = document.createElement("video");
        persistentVideoEl.controls = true;
        persistentVideoEl.style.cssText = "width:100%;border-radius:6px;background:#000;display:block";
        persistentVideoEl.addEventListener("play",   startCursorLoop);
        persistentVideoEl.addEventListener("pause",  stopCursorLoop);
        persistentVideoEl.addEventListener("ended",  stopCursorLoop);
        persistentVideoEl.addEventListener("seeked", () => {
            if (persistentVideoEl.paused) updateCursor();
        });
    }
    return persistentVideoEl;
}

// ── Cursor animation loop ─────────────────────────────────────────────────────
function startCursorLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    (function loop() { updateCursor(); rafId = requestAnimationFrame(loop); })();
}

function stopCursorLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    updateCursor();
}

function updateCursor() {
    if (videoOffset === null || !persistentVideoEl) return;
    cursorMs = persistentVideoEl.currentTime * 1000 - videoOffset;

    const timeStr = "Log: " + fmtMs(Math.max(0, cursorMs));
    const d1 = document.getElementById("videoLogTime");
    const d2 = document.getElementById("floatingVideoTime");
    if (d1) d1.textContent = timeStr;
    if (d2) d2.textContent = timeStr;

    Object.values(charts).forEach((c) => c.update("none"));
}

// ── Video file loading ────────────────────────────────────────────────────────
function loadVideoFile(file) {
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    videoBlobUrl = URL.createObjectURL(file);
    const el = getVideoEl();
    el.src = videoBlobUrl;

    const nameEl = document.getElementById("videoFileName");
    if (nameEl) nameEl.textContent = file.name;

    if (!dragInitialized) { initFloatingDrag(); dragInitialized = true; }
    updateVideoPlacement();
}

// ── Floating player placement ─────────────────────────────────────────────────
function updateVideoPlacement() {
    if (!videoBlobUrl) return;
    const el      = getVideoEl();
    const floating = document.getElementById("floatingVideo");
    const fbody    = document.getElementById("floatingVideoBody");

    if (activeTab === "video") {
        // Move into tab slot
        const slot = document.getElementById("videoPlayerSlot");
        if (slot && !slot.contains(el)) { slot.innerHTML = ""; slot.appendChild(el); }
        const dz = document.getElementById("videoDropZone");
        if (dz) dz.style.display = "none";
        if (floating) floating.style.display = "none";
    } else {
        // Move into floating panel
        if (fbody && !fbody.contains(el)) { fbody.innerHTML = ""; fbody.appendChild(el); }
        if (floating) floating.style.display = "block";
    }
}

function initFloatingDrag() {
    const panel  = document.getElementById("floatingVideo");
    const header = document.getElementById("floatingVideoHeader");
    if (!panel || !header) return;

    let startX, startY, origLeft, origTop;
    header.onmousedown = (e) => {
        if (e.target.tagName === "BUTTON") return;
        e.preventDefault();
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        origLeft = rect.left; origTop = rect.top;
        panel.style.right  = "auto";
        panel.style.bottom = "auto";
        panel.style.left   = origLeft + "px";
        panel.style.top    = origTop  + "px";
        document.onmousemove = (ev) => {
            panel.style.left = (origLeft + ev.clientX - startX) + "px";
            panel.style.top  = (origTop  + ev.clientY - startY) + "px";
        };
        document.onmouseup = () => {
            document.onmousemove = null;
            document.onmouseup   = null;
        };
    };

    document.getElementById("floatingVideoGoTo").onclick = () => {
        activeTab = "video";
        updateTabBar();
        renderContent();
    };
}

// ── Sync ──────────────────────────────────────────────────────────────────────
function applySync() {
    const vStr = document.getElementById("syncVideoInput")?.value.trim();
    const lStr = document.getElementById("syncLogInput")?.value.trim();
    if (!vStr || !lStr) return;
    const videoSec = parseVideoTime(vStr);
    const logSec   = parseFloat(lStr.replace(/[^0-9.]/g, ""));
    videoOffset    = videoSec * 1000 - logSec * 1000;
    const statusEl = document.getElementById("syncStatus");
    if (statusEl) statusEl.textContent = "Synced — video leads log by " + (videoOffset / 1000).toFixed(2) + "s";
    updateCursor();
}

function parseVideoTime(s) {
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(s) || 0;
}

function detectStopMs() {
    if (!DATA) return 0;
    const sensor = DATA.sensor;
    for (let i = sensor.length - 1; i >= 0; i--) {
        if (Math.abs(sensor[i].rpm) > 300) return sensor[i].ms - DATA.minMs;
    }
    return DATA.maxMs - DATA.minMs;
}

// ── Tab init (called after each render of the video panel) ────────────────────
function initVideoTab() {
    // Mount persistent video element if a file is already loaded
    const slot = document.getElementById("videoPlayerSlot");
    if (slot && videoBlobUrl) {
        slot.innerHTML = "";
        slot.appendChild(getVideoEl());
        const dz = document.getElementById("videoDropZone");
        if (dz) dz.style.display = "none";
        const nameEl = document.getElementById("videoFileName");
        if (nameEl && persistentVideoEl?.src) nameEl.textContent = "";
    }

    // Drop zone
    const dropZone = document.getElementById("videoDropZone");
    if (dropZone) {
        dropZone.onclick    = () => document.getElementById("videoInput").click();
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("dz-hover"); };
        dropZone.ondragleave = ()  => dropZone.classList.remove("dz-hover");
        dropZone.ondrop     = (e)  => {
            e.preventDefault();
            dropZone.classList.remove("dz-hover");
            const f = e.dataTransfer?.files[0];
            if (f && f.type.startsWith("video/")) loadVideoFile(f);
        };
    }

    const fileInput = document.getElementById("videoInput");
    if (fileInput) fileInput.onchange = (e) => {
        if (e.target.files[0]) loadVideoFile(e.target.files[0]);
        e.target.value = "";
    };

    // Sync controls
    const syncBtn = document.getElementById("syncApplyBtn");
    if (syncBtn) syncBtn.onclick = applySync;

    // Detect stop button — pre-fill log time
    const detectBtn = document.getElementById("detectStopBtn");
    if (detectBtn) {
        const stopMs = detectStopMs();
        detectBtn.textContent = "Use stop (" + fmtMs(stopMs) + ")";
        detectBtn.onclick = () => {
            const inp = document.getElementById("syncLogInput");
            if (inp) inp.value = (stopMs / 1000).toFixed(1);
        };
    }

    // Restore status if already synced
    if (videoOffset !== null) {
        const statusEl = document.getElementById("syncStatus");
        if (statusEl) statusEl.textContent = "Synced — offset " + (videoOffset / 1000).toFixed(2) + "s";
    }
}
