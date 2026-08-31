export const SITES = {
  "NBO-HUB": { name: "Kilimani Hub", region: "Metro North" },
  "RVS-TWR": { name: "Riverside Tower", region: "Metro North" },
  "NGG-RDG": { name: "Ngong Ridge", region: "Highlands" },
  "MGD-RLY": { name: "Magadi Relay", region: "Rift Valley" },
  "SMT-N": { name: "Summit North", region: "Highlands" },
  "SMT-S": { name: "Summit South", region: "Highlands" },
  "CST-GW": { name: "Coastal Gateway", region: "Coast" },
  "ISL-ND": { name: "Island Node", region: "Coast" }
};

export const LINKS = [
  { 
    id: "MW-01", 
    a: "NBO-HUB", 
    b: "RVS-TWR", 
    band: "11 GHz", 
    dish: "0.6 m", 
    status: "live", 
    bomReady: true, 
    path: "4.2 km" 
  },
  { 
    id: "MW-02", 
    a: "RVS-TWR", 
    b: "NGG-RDG", 
    band: "7 GHz", 
    dish: "1.2 m", 
    status: "staged", 
    bomReady: true, 
    path: "31.0 km" 
  },
  { 
    id: "MW-03", 
    a: "NGG-RDG", 
    b: "MGD-RLY", 
    band: "18 GHz", 
    dish: "0.3 m", 
    status: "bom_incomplete", 
    bomReady: false, 
    path: "6.8 km" 
  },
  { 
    id: "MW-04", 
    a: "SMT-N", 
    b: "SMT-S", 
    band: "E-band 80 GHz", 
    dish: "0.3 m", 
    status: "dispatched", 
    bomReady: true, 
    path: "1.1 km" 
  },
  { 
    id: "MW-05", 
    a: "CST-GW", 
    b: "ISL-ND", 
    band: "23 GHz", 
    dish: "0.6 m", 
    status: "staging", 
    bomReady: true, 
    path: "9.4 km" 
  }
];

let _id = 0;
const A = (serial, type, model, band, state, loc, link, extra = {}) => ({
  uid: ++_id,
  serial,
  type,
  model,
  band,
  state,
  loc,
  link,
  tag: extra.tag || null,
  ...extra
});

export const SEED_ASSETS = [
  // MW-01 — LIVE (11 GHz, 0.6m)
  A("CER-IP50-AA117", "IDU", "Ceragon IP-50E", "11 GHz", "installed", "Kilimani Hub · R2/Rack-A", "MW-01", { tag: "AT-1011", end: "A", cfg: 3 }),
  A("CER-RFUD-9920", "ODU", "Ceragon RFU-D", "11 GHz", "installed", "Kilimani Hub · Tower 38m", "MW-01", { tag: "AT-1012", end: "A", cfg: 3 }),
  A("AND-VHLP6-0441", "DISH", "Andrew VHLP-0.6", "11 GHz", "installed", "Kilimani Hub · Tower 38m", "MW-01", { tag: "AT-1013", end: "A" }),
  A("CER-IP50-AA118", "IDU", "Ceragon IP-50E", "11 GHz", "installed", "Riverside Twr · R1/Rack-C", "MW-01", { tag: "AT-1014", end: "B", cfg: 4 }),
  A("CER-RFUD-9921", "ODU", "Ceragon RFU-D", "11 GHz", "installed", "Riverside Twr · Mast 24m", "MW-01", { tag: "AT-1015", end: "B", cfg: 2 }),
  A("AND-VHLP6-0442", "DISH", "Andrew VHLP-0.6", "11 GHz", "installed", "Riverside Twr · Mast 24m", "MW-01", { tag: "AT-1016", end: "B" }),

  // MW-02 — STAGED → ready to dispatch (7 GHz, 1.2m)
  A("AVI-WTM4-3301", "IDU", "Aviat WTM 4000", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1201", end: "A", cfg: 4 }),
  A("AVI-ODU6-7740", "ODU", "Aviat ODU 600", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1202", end: "A", cfg: 3 }),
  A("RFS-SBX12-2210", "DISH", "RFS SBX-1.2", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1203", end: "A" }),
  A("AVI-WTM4-3302", "IDU", "Aviat WTM 4000", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1204", end: "B", cfg: 5 }),
  A("AVI-ODU6-7741", "ODU", "Aviat ODU 600", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1205", end: "B", cfg: 3 }),
  A("RFS-SBX12-2211", "DISH", "RFS SBX-1.2", "7 GHz", "staged", "Staging Bay 02", "MW-02", { tag: "AT-1206", end: "B" }),

  // MW-03 — BOM INCOMPLETE (18 GHz, 0.3m)
  A("CER-IP50-AA221", "IDU", "Ceragon IP-50E", "18 GHz", "stocked", "WH-A · Bin C4", "MW-03", { tag: "AT-1301", end: "A" }),
  A("AND-VHLPX3-1180", "DISH", "Andrew VHLPX-0.3", "18 GHz", "in_transit", "Inbound · PO-4471", "MW-03", { tag: "AT-1302", end: "A" }),
  A("CER-RFUD-9955", "ODU", "Ceragon RFU-D", "18 GHz", "quarantine", "QC Bay · Failed PoST", "MW-03", { tag: "AT-1303", end: "A" }),

  // MW-04 — DISPATCHED → field install (E-band 80 GHz, 0.3m)
  A("SIA-EB80-5510", "IDU", "Siklu EH-8010", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1401", end: "A", daysOut: 17 }),
  A("SIA-EB80-5511", "ODU", "Siklu EH-8010 RF", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1402", end: "A", daysOut: 17 }),
  A("SIA-DSH3-2240", "DISH", "Siklu 0.3 Integ.", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1403", end: "A", daysOut: 3 }),
  A("SIA-EB80-5512", "IDU", "Siklu EH-8010", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1404", end: "B", daysOut: 3 }),
  A("SIA-EB80-5513", "ODU", "Siklu EH-8010 RF", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1405", end: "B", daysOut: 3 }),
  A("SIA-DSH3-2241", "DISH", "Siklu 0.3 Integ.", "E-band 80 GHz", "dispatched", "Truck KDJ-402F", "MW-04", { tag: "AT-1406", end: "B", daysOut: 3 }),

  // MW-05 — IN STAGING → config gates (23 GHz, 0.6m)
  A("CER-IP50-AA330", "IDU", "Ceragon IP-50E", "23 GHz", "stocked", "Staging Bay 01", "MW-05", { tag: "AT-1501", end: "A", checks: { firmware: true, frequency: true, ip: false, bench: false } }),
  A("CER-RFUD-1100", "ODU", "Ceragon RFU-D", "23 GHz", "stocked", "Staging Bay 01", "MW-05", { tag: "AT-1502", end: "A", checks: { firmware: true, frequency: false, ip: false, bench: false } }),
  A("CER-IP50-AA331", "IDU", "Ceragon IP-50E", "23 GHz", "stocked", "Staging Bay 01", "MW-05", { tag: "AT-1503", end: "B", checks: { firmware: false, frequency: false, ip: false, bench: false } }),
  A("CER-RFUD-1101", "ODU", "Ceragon RFU-D", "23 GHz", "stocked", "Staging Bay 01", "MW-05", { tag: "AT-1504", end: "B", checks: { firmware: true, frequency: true, ip: true, bench: false } }),
  A("AND-VHLP6-0660", "DISH", "Andrew VHLP-0.6", "23 GHz", "stocked", "WH-A · Bin D1", "MW-05", { tag: "AT-1505", end: "A" }),
  A("AND-VHLP6-0661", "DISH", "Andrew VHLP-0.6", "23 GHz", "stocked", "WH-A · Bin D1", "MW-05", { tag: "AT-1506", end: "B" }),

  // Unassigned pool stock
  A("CER-RFUD-9980", "ODU", "Ceragon RFU-D", "11 GHz", "stocked", "WH-A · Bin A2", null, { tag: "AT-1601" }),
  A("AVI-WTM4-3309", "IDU", "Aviat WTM 4000", "7 GHz", "stocked", "WH-A · Bin B1", null, { tag: "AT-1602" }),
  A("CER-RFUD-9981", "ODU", "Ceragon RFU-D", "18 GHz", "maintenance", "Service Bench 1", null, { tag: "AT-1603" })
];

export const CONSUMABLES = [
  { sku: "WPF-TAPE-19", name: "Self-amalgamating weatherproof tape", unit: "roll", qty: 128, reorder: 50 },
  { sku: "CTIE-UV-300", name: "UV-stabilised cable ties (300mm)", unit: "pack", qty: 8, reorder: 20 },
  { sku: "GND-LUG-35", name: "Grounding lugs (35mm²)", unit: "ea", qty: 64, reorder: 40 },
  { sku: "WG-FLEX-EW63", name: "Flexible elliptical waveguide EW63", unit: "m", qty: 340, reorder: 200 },
  { sku: "CONN-UBR70", name: "UBR70 flange connector kit", unit: "ea", qty: 22, reorder: 30 },
  { sku: "SEAL-AMALG", name: "Cold-shrink sealant sleeves", unit: "ea", qty: 0, reorder: 24 }
];

export const CHECK_DEFS = [
  { key: "firmware", label: "Firmware updated", sub: "Image v9.4.2 flashed + verified", ico: "Cpu" },
  { key: "frequency", label: "Frequency pre-set", sub: "Tx/Rx channel plan loaded", ico: "Signal" },
  { key: "ip", label: "IP address configured", sub: "Mgmt + radio interface", ico: "Navigation" },
  { key: "bench", label: "Back-to-back bench test passed", sub: "BER + Rx level within spec", ico: "Activity" }
];

export const POD_INIT = { 
  online: false, 
  manifest: {}, 
  stage1: { done: false, gps: null, signedBy: null, at: null }, 
  synced: null 
};

export const TODAY = "08 Jun 2026";

// ─── Asset Chain of Custody / Audit Trail ───────────────────────
// Each entry tracks a stage transition for an asset with proof
export const ASSET_CUSTODY_LOG = [
  // MW-01 — fully installed, complete chain
  { assetSerial: "CER-IP50-AA117", link: "MW-01", stage: "stocked", by: "J. Okoth", at: "2026-05-12T08:20:00Z", loc: "WH-A · Bin C2", evidence: "grn", notes: "GRN-4401 verified", evidenceRef: "GRN-4401" },
  { assetSerial: "CER-IP50-AA117", link: "MW-01", stage: "staged", by: "J. Okoth", at: "2026-05-14T10:30:00Z", loc: "Staging Bay 01", evidence: "config", notes: "All 4 gates passed, firmware v9.4.2", evidenceRef: "CFG-0117" },
  { assetSerial: "CER-IP50-AA117", link: "MW-01", stage: "dispatched", by: "D. Mwangi", at: "2026-05-16T06:45:00Z", loc: "Truck KDB-118J", evidence: "gatepass", notes: "Gate pass GP-2201 issued", evidenceRef: "GP-2201" },
  { assetSerial: "CER-IP50-AA117", link: "MW-01", stage: "received", by: "S. Wanjiku", at: "2026-05-16T14:10:00Z", loc: "Kilimani Hub", evidence: "pod", notes: "Proof of delivery signed on-site", evidenceRef: "POD-2201" },
  { assetSerial: "CER-IP50-AA117", link: "MW-01", stage: "installed", by: "M. Ochieng", at: "2026-05-18T11:00:00Z", loc: "Kilimani Hub · R2/Rack-A", evidence: "photo", notes: "Installation complete, commissioning test passed", evidenceRef: "INST-0117" },

  { assetSerial: "CER-RFUD-9920", link: "MW-01", stage: "stocked", by: "J. Okoth", at: "2026-05-12T08:25:00Z", loc: "WH-A · Bin C3", evidence: "grn", notes: "GRN-4401 verified", evidenceRef: "GRN-4401" },
  { assetSerial: "CER-RFUD-9920", link: "MW-01", stage: "staged", by: "J. Okoth", at: "2026-05-14T10:45:00Z", loc: "Staging Bay 01", evidence: "config", notes: "Frequency set, bench test passed", evidenceRef: "CFG-9920" },
  { assetSerial: "CER-RFUD-9920", link: "MW-01", stage: "dispatched", by: "D. Mwangi", at: "2026-05-16T06:45:00Z", loc: "Truck KDB-118J", evidence: "gatepass", notes: "Gate pass GP-2201", evidenceRef: "GP-2201" },
  { assetSerial: "CER-RFUD-9920", link: "MW-01", stage: "received", by: "S. Wanjiku", at: "2026-05-16T14:10:00Z", loc: "Kilimani Hub", evidence: "pod", notes: "Delivery confirmed", evidenceRef: "POD-2201" },
  { assetSerial: "CER-RFUD-9920", link: "MW-01", stage: "installed", by: "M. Ochieng", at: "2026-05-18T11:30:00Z", loc: "Kilimani Hub · Tower 38m", evidence: "photo", notes: "ODU mounted, aligned", evidenceRef: "INST-9920" },

  { assetSerial: "AND-VHLP6-0441", link: "MW-01", stage: "stocked", by: "J. Okoth", at: "2026-05-11T09:00:00Z", loc: "WH-A · Bin D2", evidence: "grn", notes: "GRN-4399", evidenceRef: "GRN-4399" },
  { assetSerial: "AND-VHLP6-0441", link: "MW-01", stage: "staged", by: "J. Okoth", at: "2026-05-14T11:00:00Z", loc: "Staging Bay 01", evidence: "visual", notes: "Physical inspection passed", evidenceRef: "INS-0441" },
  { assetSerial: "AND-VHLP6-0441", link: "MW-01", stage: "dispatched", by: "D. Mwangi", at: "2026-05-16T06:45:00Z", loc: "Truck KDB-118J", evidence: "gatepass", notes: "Gate pass GP-2201", evidenceRef: "GP-2201" },
  { assetSerial: "AND-VHLP6-0441", link: "MW-01", stage: "received", by: "S. Wanjiku", at: "2026-05-16T14:10:00Z", loc: "Kilimani Hub", evidence: "pod", notes: "Dish received intact", evidenceRef: "POD-2201" },
  { assetSerial: "AND-VHLP6-0441", link: "MW-01", stage: "installed", by: "M. Ochieng", at: "2026-05-18T09:30:00Z", loc: "Kilimani Hub · Tower 38m", evidence: "photo", notes: "Dish mounted & aligned", evidenceRef: "INST-0441" },

  // MW-02 — staged only (no dispatch yet)
  { assetSerial: "AVI-WTM4-3301", link: "MW-02", stage: "stocked", by: "J. Okoth", at: "2026-06-01T08:00:00Z", loc: "WH-A · Bin B3", evidence: "grn", notes: "GRN-4510", evidenceRef: "GRN-4510" },
  { assetSerial: "AVI-WTM4-3301", link: "MW-02", stage: "staged", by: "J. Okoth", at: "2026-06-04T14:20:00Z", loc: "Staging Bay 02", evidence: "config", notes: "All config gates passed", evidenceRef: "CFG-3301" },

  { assetSerial: "AVI-ODU6-7740", link: "MW-02", stage: "stocked", by: "J. Okoth", at: "2026-06-01T08:10:00Z", loc: "WH-A · Bin B4", evidence: "grn", notes: "GRN-4510", evidenceRef: "GRN-4510" },
  { assetSerial: "AVI-ODU6-7740", link: "MW-02", stage: "staged", by: "J. Okoth", at: "2026-06-04T15:00:00Z", loc: "Staging Bay 02", evidence: "config", notes: "Frequency calibrated", evidenceRef: "CFG-7740" },

  { assetSerial: "RFS-SBX12-2210", link: "MW-02", stage: "stocked", by: "J. Okoth", at: "2026-06-02T09:00:00Z", loc: "WH-A · Bin D3", evidence: "grn", notes: "GRN-4512", evidenceRef: "GRN-4512" },
  { assetSerial: "RFS-SBX12-2210", link: "MW-02", stage: "staged", by: "J. Okoth", at: "2026-06-04T15:30:00Z", loc: "Staging Bay 02", evidence: "visual", notes: "Physical check OK", evidenceRef: "INS-2210" },

  // MW-04 — dispatched (in transit to field)
  { assetSerial: "SIA-EB80-5510", link: "MW-04", stage: "stocked", by: "P. Kamau", at: "2026-05-20T07:30:00Z", loc: "WH-A · Bin E1", evidence: "grn", notes: "GRN-4480", evidenceRef: "GRN-4480" },
  { assetSerial: "SIA-EB80-5510", link: "MW-04", stage: "staged", by: "P. Kamau", at: "2026-05-22T10:00:00Z", loc: "Staging Bay 03", evidence: "config", notes: "E-band config complete", evidenceRef: "CFG-5510" },
  { assetSerial: "SIA-EB80-5510", link: "MW-04", stage: "dispatched", by: "J. Okoth", at: "2026-05-24T06:00:00Z", loc: "Truck KDJ-402F", evidence: "gatepass", notes: "Gate pass GP-2207", evidenceRef: "GP-2207" },

  { assetSerial: "SIA-EB80-5511", link: "MW-04", stage: "stocked", by: "P. Kamau", at: "2026-05-20T07:35:00Z", loc: "WH-A · Bin E2", evidence: "grn", notes: "GRN-4480", evidenceRef: "GRN-4480" },
  { assetSerial: "SIA-EB80-5511", link: "MW-04", stage: "staged", by: "P. Kamau", at: "2026-05-22T10:30:00Z", loc: "Staging Bay 03", evidence: "config", notes: "RF calibration done", evidenceRef: "CFG-5511" },
  { assetSerial: "SIA-EB80-5511", link: "MW-04", stage: "dispatched", by: "J. Okoth", at: "2026-05-24T06:00:00Z", loc: "Truck KDJ-402F", evidence: "gatepass", notes: "Gate pass GP-2207", evidenceRef: "GP-2207" },

  { assetSerial: "SIA-DSH3-2240", link: "MW-04", stage: "stocked", by: "P. Kamau", at: "2026-05-20T07:40:00Z", loc: "WH-A · Bin D5", evidence: "grn", notes: "GRN-4481", evidenceRef: "GRN-4481" },
  { assetSerial: "SIA-DSH3-2240", link: "MW-04", stage: "staged", by: "P. Kamau", at: "2026-05-22T11:00:00Z", loc: "Staging Bay 03", evidence: "visual", notes: "Integrated dish inspected", evidenceRef: "INS-2240" },
  { assetSerial: "SIA-DSH3-2240", link: "MW-04", stage: "dispatched", by: "J. Okoth", at: "2026-05-24T06:00:00Z", loc: "Truck KDJ-402F", evidence: "gatepass", notes: "Gate pass GP-2207", evidenceRef: "GP-2207" },

  // MW-03 — partial / incomplete chain (problems)
  { assetSerial: "CER-IP50-AA221", link: "MW-03", stage: "stocked", by: "J. Okoth", at: "2026-06-05T08:00:00Z", loc: "WH-A · Bin C4", evidence: "grn", notes: "GRN-4520", evidenceRef: "GRN-4520" },

  // MW-05 — stocked, in staging queue
  { assetSerial: "CER-IP50-AA330", link: "MW-05", stage: "stocked", by: "J. Okoth", at: "2026-06-06T07:45:00Z", loc: "Staging Bay 01", evidence: "grn", notes: "GRN-4525", evidenceRef: "GRN-4525" },
  { assetSerial: "CER-RFUD-1100", link: "MW-05", stage: "stocked", by: "J. Okoth", at: "2026-06-06T07:50:00Z", loc: "Staging Bay 01", evidence: "grn", notes: "GRN-4525", evidenceRef: "GRN-4525" },
];

// ─── Fleet Management Mock Data ─────────────────────────────────
export const FLEET_VEHICLES = [
  {
    id: "V-001",
    plate: "KDB-118J",
    type: "Pickup",
    make: "Toyota Hilux",
    driver: "D. Mwangi",
    phone: "+254 712 345 678",
    status: "moving",
    lat: -1.2864,
    lng: 36.8235,
    speed: 47,
    heading: 135,
    fuel: 72,
    odometer: 84320,
    lastUpdate: "2026-06-29T06:02:00Z",
    assignedLink: "MW-02"
  },
  {
    id: "V-002",
    plate: "KDJ-402F",
    type: "Truck",
    make: "Isuzu NPR",
    driver: "J. Okoth",
    phone: "+254 723 456 789",
    status: "moving",
    lat: -1.2621,
    lng: 36.7915,
    speed: 32,
    heading: 220,
    fuel: 58,
    odometer: 126780,
    lastUpdate: "2026-06-29T06:04:00Z",
    assignedLink: "MW-04"
  },
  {
    id: "V-003",
    plate: "KCZ-991K",
    type: "Van",
    make: "Toyota HiAce",
    driver: "S. Wanjiku",
    phone: "+254 734 567 890",
    status: "parked",
    lat: -1.2921,
    lng: 36.8219,
    speed: 0,
    heading: 0,
    fuel: 91,
    odometer: 42150,
    lastUpdate: "2026-06-29T05:45:00Z",
    assignedLink: null
  },
  {
    id: "V-004",
    plate: "KDE-774G",
    type: "Pickup",
    make: "Ford Ranger",
    driver: "M. Ochieng",
    phone: "+254 745 678 901",
    status: "idle",
    lat: -1.3028,
    lng: 36.8567,
    speed: 0,
    heading: 90,
    fuel: 35,
    odometer: 97640,
    lastUpdate: "2026-06-29T05:58:00Z",
    assignedLink: "MW-05"
  },
  {
    id: "V-005",
    plate: "KDA-220E",
    type: "Truck",
    make: "Mitsubishi Canter",
    driver: "P. Kamau",
    phone: "+254 756 789 012",
    status: "maintenance",
    lat: -1.2895,
    lng: 36.8178,
    speed: 0,
    heading: 0,
    fuel: 15,
    odometer: 158430,
    lastUpdate: "2026-06-28T18:30:00Z",
    assignedLink: null
  }
];

export const TRIP_HISTORY = [
  { id: "TR-001", vehicleId: "V-001", date: "2026-06-29", from: "Kilimani Hub", to: "Ngong Ridge", distance: 34.2, duration: 68, status: "in_progress", startTime: "05:42" },
  { id: "TR-002", vehicleId: "V-002", date: "2026-06-29", from: "Warehouse A", to: "Summit North", distance: 18.7, duration: 42, status: "in_progress", startTime: "05:55" },
  { id: "TR-003", vehicleId: "V-001", date: "2026-06-28", from: "Riverside Tower", to: "Kilimani Hub", distance: 4.8, duration: 22, status: "completed", startTime: "16:10" },
  { id: "TR-004", vehicleId: "V-003", date: "2026-06-28", from: "Coastal Gateway", to: "Island Node", distance: 12.3, duration: 35, status: "completed", startTime: "14:20" },
  { id: "TR-005", vehicleId: "V-002", date: "2026-06-28", from: "Magadi Relay", to: "Warehouse A", distance: 52.1, duration: 94, status: "completed", startTime: "11:00" },
  { id: "TR-006", vehicleId: "V-004", date: "2026-06-28", from: "Kilimani Hub", to: "Magadi Relay", distance: 48.6, duration: 88, status: "completed", startTime: "08:30" },
  { id: "TR-007", vehicleId: "V-001", date: "2026-06-27", from: "Warehouse A", to: "Riverside Tower", distance: 8.4, duration: 28, status: "completed", startTime: "09:15" },
  { id: "TR-008", vehicleId: "V-004", date: "2026-06-27", from: "Summit South", to: "Kilimani Hub", distance: 22.3, duration: 55, status: "completed", startTime: "15:40" },
  { id: "TR-009", vehicleId: "V-003", date: "2026-06-27", from: "Warehouse A", to: "Coastal Gateway", distance: 9.7, duration: 31, status: "completed", startTime: "07:00" },
  { id: "TR-010", vehicleId: "V-005", date: "2026-06-26", from: "Ngong Ridge", to: "Magadi Relay", distance: 41.8, duration: 76, status: "completed", startTime: "10:20" },
];

export const PARKING_ZONES = [
  { id: "PZ-01", name: "Warehouse A Depot", type: "depot", lat: -1.2921, lng: 36.8219, capacity: 8, occupied: 3, address: "Industrial Area, Nairobi" },
  { id: "PZ-02", name: "Kilimani Hub Yard", type: "depot", lat: -1.2864, lng: 36.8172, capacity: 4, occupied: 1, address: "Kilimani, Nairobi" },
  { id: "PZ-03", name: "Ngong Ridge Staging", type: "field", lat: -1.3655, lng: 36.6640, capacity: 3, occupied: 0, address: "Ngong Road, Kajiado" },
  { id: "PZ-04", name: "Summit Basecamp", type: "field", lat: -1.1520, lng: 36.9050, capacity: 2, occupied: 0, address: "Thika Road, Kiambu" },
  { id: "PZ-05", name: "Coastal Gateway Lot", type: "client-site", lat: -4.0435, lng: 39.6682, capacity: 3, occupied: 1, address: "Mombasa" },
];

export const ROUTE_WAYPOINTS = {
  "V-001": [
    [-1.2864, 36.8172], [-1.2880, 36.8190], [-1.2905, 36.8210],
    [-1.2930, 36.8215], [-1.2960, 36.8200], [-1.3010, 36.8150],
    [-1.3080, 36.8080], [-1.3160, 36.7960], [-1.3250, 36.7840],
    [-1.3350, 36.7700], [-1.3450, 36.7550], [-1.3560, 36.7400],
    [-1.3655, 36.6640]
  ],
  "V-002": [
    [-1.2921, 36.8219], [-1.2880, 36.8260], [-1.2820, 36.8310],
    [-1.2750, 36.8400], [-1.2680, 36.8520], [-1.2621, 36.7915],
    [-1.2400, 36.8700], [-1.2200, 36.8800], [-1.1900, 36.8900],
    [-1.1650, 36.9000], [-1.1520, 36.9050]
  ]
};