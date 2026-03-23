// ── Helpers ───────────────────────────────────────────────────────────────────
function setUploadStatus(msg, isError = false) {
    const el = document.getElementById("uploadStatus");
    el.textContent = msg;
    el.className = "upload-status" + (msg ? " visible" : "") + (isError ? " error" : "");
}

function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Core file loader (from text content) ─────────────────────────────────────
function loadText(text, label) {
    DATA             = parseCSV(text);
    activeTab        = "overview";
    canFilter        = "";
    canDirFilter     = "ALL";
    canPage          = 0;
    chartWindowStart = null;
    chartWindowEnd   = null;
    selectedRegs.clear();

    document.getElementById("emptyState").style.display = "none";
    document.getElementById("appContent").style.display = "block";

    const fc = document.getElementById("frameCount");
    fc.textContent = label
        ? `${label} · ${DATA.can.length.toLocaleString()} frames · ${((DATA.maxMs - DATA.minMs) / 1000).toFixed(1)}s`
        : `${DATA.can.length.toLocaleString()} frames · ${((DATA.maxMs - DATA.minMs) / 1000).toFixed(1)}s`;
    fc.classList.add("visible");

    buildTabs();
    renderContent();
}

// ── Upload a file to Supabase, then load it ───────────────────────────────────
async function handleUpload(file) {
    setUploadStatus("Uploading…");
    document.getElementById("uploadBtn").disabled = true;

    try {
        await uploadLog(file);
        setUploadStatus("Uploaded — loading…");
        const text = await file.text();
        loadText(text, file.name);
        setUploadStatus("");
    } catch (err) {
        setUploadStatus("Upload failed: " + err.message, true);
        console.error(err);
    } finally {
        document.getElementById("uploadBtn").disabled = false;
    }
}

// ── Modal: browse and load saved logs ────────────────────────────────────────
async function openBrowseModal() {
    document.getElementById("logsModal").style.display = "flex";
    const list = document.getElementById("logsList");
    list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">Loading…</div>`;

    let files;
    try {
        files = await listLogs();
    } catch (err) {
        list.innerHTML = `<div style="color:var(--red);font-size:12px">Failed to load logs: ${err.message}</div>`;
        return;
    }

    if (files.length === 0) {
        list.innerHTML = `<div style="color:var(--text-dim);font-size:12px">No logs uploaded yet.</div>`;
        return;
    }

    list.innerHTML = files
        .map(
            (f) => `
        <div class="log-entry" data-path="${f.name}">
            <div class="log-name">${f.name.replace(/^\d+_/, "")}</div>
            <div class="log-meta">${fmtDate(f.created_at)}${f.metadata?.size ? " · " + fmtBytes(f.metadata.size) : ""}</div>
            <button class="btn-outline load-log-btn" data-path="${f.name}">Load</button>
        </div>`,
        )
        .join("");

    list.querySelectorAll(".load-log-btn").forEach((btn) => {
        btn.onclick = async () => {
            btn.textContent = "Loading…";
            btn.disabled = true;
            try {
                const blob = await downloadLog(btn.dataset.path);
                const text = await blob.text();
                const displayName = btn.dataset.path.replace(/^\d+_/, "");
                closeModal();
                loadText(text, displayName);
            } catch (err) {
                btn.textContent = "Error";
                console.error(err);
            }
        };
    });
}

function closeModal() {
    document.getElementById("logsModal").style.display = "none";
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById("uploadBtn").addEventListener("click", () => {
    document.getElementById("uploadInput").click();
});

document.getElementById("uploadInput").addEventListener("change", (e) => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
    e.target.value = ""; // reset so same file can be re-selected
});

document.getElementById("browseBtn").addEventListener("click", openBrowseModal);
document.getElementById("closeModal").addEventListener("click", closeModal);

// Close modal on backdrop click
document.getElementById("logsModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// Drag-and-drop anywhere on the page → upload to Supabase
document.body.addEventListener("dragover", (e) => e.preventDefault());
document.body.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files[0]) handleUpload(e.dataTransfer.files[0]);
});
