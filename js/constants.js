// Colour palette (mirrors CSS vars for use in Chart.js)
const C = {
    accent: "#4ebd6b",
    accentDim: "#358a4c",
    red: "#ef4444",
    blue: "#5ba3f5",
    purple: "#a07ee8",
    cyan: "#4ec9d4",
    pink: "#e66da0",
    orange: "#f5a340",
    gold: "#d4a843",
    textDim: "#5f7a99",
    textBright: "#e6edf6",
    grid: "#162a4a",
    bg: "#0b1628",
    card: "#0f1f3a",
    cardBorder: "#1a3155",
};

// Ordered palette for multi-series charts
const CH = [C.accent, C.blue, C.gold, C.red, C.purple, C.cyan, C.pink, C.orange];

// BAMOCAR D3-PG register map: address → { n: name, u: unit, s: scale fn, sg: signed }
const REG = {
    0x20: { n: "I_ACT",       u: "A",      s: (v) => v,                    sg: 1 },
    0x21: { n: "I_CMD",       u: "A",      s: (v) => v,                    sg: 1 },
    0x22: { n: "I_CMD_RAMP",  u: "A",      s: (v) => v,                    sg: 1 },
    0x25: { n: "I_LIM_INUSE", u: "A",      s: (v) => v,                    sg: 1 },
    0x26: { n: "I_LIM_ACT",   u: "A",      s: (v) => v,                    sg: 1 },
    0x27: { n: "I_RED_TEMP",  u: "%",      s: (v) => v,                    sg: 0 },
    0x28: { n: "I_RED_VLOW",  u: "%",      s: (v) => v,                    sg: 0 },
    0x30: { n: "TORQUE_CMD",  u: "counts", s: (v) => v,                    sg: 1 },
    0x0a: { n: "RPM",         u: "rpm",    s: (v) => (v / 32767) * 6000,   sg: 1 },
    0x0e: { n: "T_MOTOR",     u: "°C",     s: (v) => v * 0.1,              sg: 1 },
    0x0f: { n: "T_INV",       u: "°C",     s: (v) => v * 0.1,              sg: 1 },
    0x10: { n: "T_IGBT_A",    u: "°C",     s: (v) => v * 0.1,              sg: 1 },
    0x11: { n: "T_IGBT_B",    u: "°C",     s: (v) => v * 0.1,              sg: 1 },
    0x12: { n: "T_IGBT_C",    u: "°C",     s: (v) => v * 0.1,              sg: 1 },
    0xeb: { n: "DC_BUS_V",    u: "V",      s: (v) => v * 0.1,              sg: 0 },
    0xa0: { n: "V_PH_AB",     u: "V",      s: (v) => v,                    sg: 1 },
    0xa1: { n: "V_PH_BC",     u: "V",      s: (v) => v,                    sg: 1 },
    0x40: { n: "STATUS",      u: "",       s: (v) => v,                    sg: 0 },
    0xa8: { n: "ERR_REG",     u: "",       s: (v) => v,                    sg: 0 },
    0x3d: { n: "N_CMD",       u: "rpm",    s: (v) => (v / 32767) * 6000,   sg: 1 },
    0xe0: { n: "POWER",       u: "W",      s: (v) => v,                    sg: 1 },
    0xe8: { n: "ENERGY",      u: "Wh",     s: (v) => v,                    sg: 0 },
};

const STATUS_BITS = [
    { b: 0,  n: "RDY",     d: "System ready"     },
    { b: 1,  n: "RUN",     d: "Motor running"    },
    { b: 2,  n: "EN",      d: "Drive enabled"    },
    { b: 3,  n: "FAULT",   d: "Fault active"     },
    { b: 4,  n: "WARN",    d: "Warning"          },
    { b: 5,  n: "ILIM",    d: "Current limiting" },
    { b: 6,  n: "VLIM",    d: "Voltage limiting" },
    { b: 7,  n: "SPD_LIM", d: "Speed limiting"   },
    { b: 8,  n: "BRAKE",   d: "Brake active"     },
    { b: 9,  n: "REGEN",   d: "Regen active"     },
    { b: 10, n: "DC_ON",   d: "DC bus enabled"   },
    { b: 11, n: "RSLV_OK", d: "Resolver valid"   },
];

const CAN_PAGE = 100;
