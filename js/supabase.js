const SUPABASE_URL = "https://bonwndyfyiwuqxxxcprx.supabase.co";
const SUPABASE_KEY = "sb_publishable_W1XWFTzkNR-B2plPXNvyvA_obe-uCux";
const BUCKET      = "logs";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function listLogs() {
    const { data, error } = await sb.storage
        .from(BUCKET)
        .list("", { sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return (data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder");
}

async function uploadLog(file) {
    const path = `${Date.now()}_${file.name}`;
    const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, file, { contentType: "text/csv" });
    if (error) throw error;
    return path;
}

async function downloadLog(path) {
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error) throw error;
    return data; // Blob
}
