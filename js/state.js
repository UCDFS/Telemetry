// Mutable application state — shared across modules via globals
let DATA = null;
let charts = {};
let activeTab = "overview";
let selectedRegs = new Set();
let canFilter = "";
let canDirFilter = "ALL";
let canPage = 0;
let chartWindowStart = null;
let chartWindowEnd   = null;
let cursorMs         = null;
