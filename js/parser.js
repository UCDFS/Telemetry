// Parse a UCDFS Teensy log CSV into structured data.
// Expects rows of two types:
//   C,<ms>,<dir>,<id_hex>,<len>,<b0_hex>,...,<b7_hex>   — CAN frame
//   S,<ms>,<a1>,<a2>,<fault>,<torque>,<rpm>,<dcDV>       — sensor snapshot
function parseCSV(text) {
    const lines = text.split("\n");
    const can = [], sensor = [], regTS = {}, status = [];
    let minMs = Infinity, maxMs = -Infinity;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line[0] === "#") continue;
        const c = line.split(",");

        if (c[0] === "C" && c.length >= 5) {
            const ms  = +c[1];
            const dir = c[2];
            const id  = parseInt(c[3], 16);
            const len = +c[4];
            const b   = [];
            for (let i = 0; i < 8; i++) {
                const v = c[5 + i];
                b.push(v && v.length ? parseInt(v, 16) : 0);
            }
            if (ms < minMs) minMs = ms;
            if (ms > maxMs) maxMs = ms;
            can.push({ ms, dir, id, len, b });

            // Decode BAMOCAR response frames (COB-ID 0x181)
            if (id === 0x181 && len >= 3) {
                const reg = b[0];
                const rd  = REG[reg];
                if (rd) {
                    const rv  = rd.sg ? i16(b[1], b[2]) : u16(b[1], b[2]);
                    const sv  = rd.s(rv);
                    const key = "0x" + reg.toString(16).toUpperCase().padStart(2, "0");
                    if (!regTS[key]) regTS[key] = { n: rd.n, u: rd.u, data: [] };
                    regTS[key].data.push({ ms, raw: rv, value: sv });
                    if (reg === 0x40) status.push({ ms, word: u16(b[1], b[2]) });
                }
            }
        }

        if (c[0] === "S" && c.length >= 8) {
            const ms = +c[1];
            if (ms < minMs) minMs = ms;
            if (ms > maxMs) maxMs = ms;
            sensor.push({
                ms,
                a1: +c[2],
                a2: +c[3],
                fault: +c[4] === 1,
                torque: +c[5],
                rpm: +c[6],
                dcDV: +c[7],
                dcV: +c[7] / 10,
            });
        }
    }

    return { can, sensor, regTS, status, minMs, maxMs };
}
