// Signed 16-bit integer from two bytes (little-endian)
function i16(b0, b1) {
    const v = (b1 << 8) | b0;
    return v > 32767 ? v - 65536 : v;
}

// Unsigned 16-bit integer from two bytes (little-endian)
function u16(b0, b1) {
    return (b1 << 8) | b0;
}

// Format milliseconds as "Xs" or "XmYs"
function fmtMs(ms) {
    const s = ms / 1000;
    return s < 60 ? s.toFixed(1) + "s" : Math.floor(s / 60) + "m" + (s % 60).toFixed(1) + "s";
}

// Reduce an array to at most maxPts evenly-spaced elements
function downsample(arr, maxPts) {
    if (arr.length <= maxPts) return arr;
    const step = arr.length / maxPts;
    const out = [];
    for (let i = 0; i < maxPts; i++) out.push(arr[Math.floor(i * step)]);
    if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
    return out;
}
