export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view",
  FIELD_WORKER: "field_worker",
};

// `user.role` must come from GET /api/auth/me, never from the login
// response body — the token is an HttpOnly cookie the client can't read,
// and /me re-derives the role server-side (via the `protect` middleware)
// on every call rather than trusting anything the client supplied. Actual
// enforcement happens on the backend via 403s (see Relay3 config/roles.js);
// this only controls what the UI shows.
//
// Roles:
//   super_admin      full access; requests dispatches, builds kits, manages
//                    stock, fleet, vehicles, drivers and parts
//   ceo              super admin rights + final (2nd) approval of dispatches
//                    and movement plans
//   project_manager  1st approval of dispatches and movement plans; prepares
//                    movement plans; records fleet entries
//   site_engineer    receives dispatches (any site, not tied to sites); steps
//                    links through installation; prepares movement plans;
//                    records fleet entries
//   admin            views everything and prints reports; manages accounts
//                    below admin; no other edits
//   field_worker     "Contractor / Site Worker": site work and own claims
//   client           views their own links
export const ROLE_LABELS = {
  super_admin: "Super Admin",
  ceo: "CEO",
  project_manager: "Project Manager",
  site_engineer: "Site Engineer",
  admin: "Admin",
  field_worker: "Contractor / Site Worker",
  client: "Client",
};
// Old roles: no access until someone gives the account a current role.
export const LEGACY_ROLES = new Set(["warehouse_manager", "warehouse_operator", "site_manager"]);
export const needsNewRole = (user) => LEGACY_ROLES.has(user?.role);

export const isSuperAdmin = (user) => ["super_admin", "ceo"].includes(user?.role);
export const isAdmin = (user) => user?.role === "admin" || isSuperAdmin(user);
export const isFieldWorker = (user) => user?.role === "field_worker";

export const getAccessLevel = (user) => {
  if (isAdmin(user)) return ACCESS_LEVELS.FULL;
  if (isFieldWorker(user)) return ACCESS_LEVELS.FIELD_WORKER;
  return ACCESS_LEVELS.CLIENT_VIEW;
};

export const hasFullView = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;
// Create / edit / delete of operational data (sites, kits, links, stock,
// vehicles, drivers, parts ...).
export const canEdit = (user) => isSuperAdmin(user);

// Only a super admin requests dispatches (not the CEO, who approves them).
export const DISPATCH_CREATOR_ROLES = new Set(["super_admin"]);
export const canRequestDispatch = (user) => DISPATCH_CREATOR_ROLES.has(user?.role);
export const ASSET_TRACKING_ROLES = new Set(["project_manager", "site_engineer"]);
export const FLEET_VIEW_ROLES = new Set(["project_manager", "site_engineer"]);
// Fuel and maintenance entries (vehicles, drivers and parts are super admin).
export const FLEET_ENTRY_ROLES = new Set(["super_admin", "ceo", "project_manager", "site_engineer"]);
export const MOVEMENT_PLAN_PREPARER_ROLES = new Set(["super_admin", "project_manager", "site_engineer"]);
export const canViewAssetTracking = (user) => hasFullView(user) || ASSET_TRACKING_ROLES.has(user?.role);
export const canViewFleet = (user) => hasFullView(user) || FLEET_VIEW_ROLES.has(user?.role);

export const CLIENT_NAV_IDS = ["control", "links"];
// Contractor / site worker accounts: the Site Work page and their own claims.
export const FIELD_WORKER_NAV_IDS = ["site-work", "expense-claims"];
const ROLE_NAV_IDS = {
  project_manager: ["control", "links", "tracking", "movement-plan", "fleet", "expense-claims"],
  site_engineer: ["control", "links", "tracking", "movement-plan", "fleet", "expense-claims"],
};

export const getAllowedNavigation = (navigation, user) => {
  if (!user || needsNewRole(user)) return [];
  if (hasFullView(user)) return navigation;
  if (isFieldWorker(user)) return navigation.filter((item) => FIELD_WORKER_NAV_IDS.includes(item.id));
  const allowed = ROLE_NAV_IDS[user.role] || CLIENT_NAV_IDS;
  return navigation.filter((item) => allowed.includes(item.id));
};
