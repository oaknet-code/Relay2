export const STATE_META = {
  in_transit: { label: "In Transit", c: "var(--blue)" },
  stocked: { label: "Stocked", c: "var(--steel)" },
  staged: { label: "Staged", c: "var(--violet)" },
  dispatched: { label: "Dispatched", c: "var(--amber)" },
  installed: { label: "Live", c: "var(--teal)" },
  maintenance: { label: "Maintenance", c: "var(--amber2)" },
  quarantine: { label: "Quarantine", c: "var(--red)" },
  retired: { label: "Retired", c: "var(--faint)" }
};

export const BAND_COLORS = {
  "7 GHz": "var(--b7)",
  "11 GHz": "var(--b11)",
  "18 GHz": "var(--b18)", 
  "23 GHz": "var(--b23)",
  "E-band 80 GHz": "var(--beb)"
};

// Map backend asset/link status enums to UI display values
export const STATUS_TO_UI = {
  STOCKED: "stocked",
  ALLOCATED: "stocked",
  STAGING: "staged",
  QA_PASSED: "staged",
  STAGED: "staged",
  DISPATCHED: "dispatched",
  IN_TRANSIT: "dispatched",
  ARRIVED: "dispatched",
  FIELD_INSTALLATION: "installed",
  INSTALLED: "installed",
  COMMISSIONED: "installed",
  LIVE: "installed",
  MAINTENANCE: "stocked",
  RETIRED: "retired",
};

export const LINK_STATUS = {
  PLANNED: { label: "Planned", c: "var(--steel)" },
  KIT_ASSIGNED: { label: "Kit Assigned", c: "var(--blue)" },
  STAGING: { label: "Staging", c: "var(--blue)" },
  DISPATCHED: { label: "Dispatched", c: "var(--amber)" },
  IN_TRANSIT: { label: "In Transit", c: "var(--amber)" },
  INSTALLING: { label: "Installing", c: "var(--violet)" },
  INSTALLED: { label: "Installed", c: "var(--teal)" },
  COMMISSIONED: { label: "Commissioned", c: "var(--teal)" },
  LIVE: { label: "Live", c: "var(--teal)" },
  MAINTENANCE: { label: "Maintenance", c: "var(--amber2)" }
};

export const USER_ROLES = {
  SYSTEM_ADMIN: "System Administrator",
  WAREHOUSE_MANAGER: "Warehouse Manager", 
  WAREHOUSE_OPERATOR: "Warehouse Operator",
  SITE_ENGINEER: "Site Engineer / Lead",
  EXECUTIVE_AUDITOR: "Executive / Auditor"
};

export const ROLE_PERMISSIONS = {
  [USER_ROLES.SYSTEM_ADMIN]: [
    "Global management, full configuration privileges",
    "system audit log viewing", 
    "database backups",
    "permission modifications"
  ],
  [USER_ROLES.WAREHOUSE_MANAGER]: [
    "Authorize GRNs",
    "modify storage/bin configurations", 
    "override inventory counts",
    "approve picking manifests",
    "view valuation tables"
  ],
  [USER_ROLES.WAREHOUSE_OPERATOR]: [
    "Perform scanning operations",
    "update bin allocations", 
    "flag items for QC quarantine",
    "execute picking operations",
    "validate shipments"
  ],
  [USER_ROLES.SITE_ENGINEER]: [
    "Initiate dispatch requests",
    "browse available regional pool stock",
    "confirm local Proof of Delivery", 
    "execute inter-site transfers"
  ],
  [USER_ROLES.EXECUTIVE_AUDITOR]: [
    "Read-only access across all global metrics",
    "Cost tracking dashboards access",
    "Turnover performance analytics", 
    "Regulatory compliance logs viewing"
  ]
};