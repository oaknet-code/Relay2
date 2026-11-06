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
//   project_manager  everything a super admin can do except user management
//                    (and claims, which the CEO reviews); 1st approval of
//                    dispatches and movement plans — their own dispatch
//                    requests go straight to the CEO
//   site_engineer    receives dispatches (any site, not tied to sites); steps
//                    links through installation; prepares movement plans;
//                    records fleet entries
//   admin            views everything and prints reports; manages accounts
//                    below admin; no other edits
//   field_worker     "Contractor / Site Worker": site work and own claims
//   client           views their own links
//   driver           "My Trips": the dispatches assigned to them — confirms
//                    pickup, marks arrival, reports problems
//                    "My Vehicle": pre-trip checks, fuel (claimed for
//                    reimbursement), vehicle problems, own per diem
export const ROLE_LABELS = {
  super_admin: "Super Admin",
  ceo: "CEO",
  project_manager: "Project Manager",
  site_engineer: "Site Engineer",
  admin: "Admin",
  field_worker: "Contractor / Site Worker",
  client: "Client",
  driver: "Driver",
};
// Old roles: no access until someone gives the account a current role.
export const LEGACY_ROLES = new Set(["warehouse_manager", "warehouse_operator", "site_manager"]);
export const needsNewRole = (user) => LEGACY_ROLES.has(user?.role);

// Full access: super admin, CEO and Project Manager. User management is
// super admin and CEO only (canManageUsers).
export const isSuperAdmin = (user) => ["super_admin", "ceo", "project_manager"].includes(user?.role);
export const canManageUsers = (user) => ["super_admin", "ceo", "admin"].includes(user?.role);
export const isUserAdmin = (user) => ["super_admin", "ceo"].includes(user?.role);
export const isAdmin = (user) => user?.role === "admin" || isSuperAdmin(user);
export const isFieldWorker = (user) => user?.role === "field_worker";
export const isDriver = (user) => user?.role === "driver";

export const getAccessLevel = (user) => {
  if (isAdmin(user)) return ACCESS_LEVELS.FULL;
  if (isFieldWorker(user)) return ACCESS_LEVELS.FIELD_WORKER;
  return ACCESS_LEVELS.CLIENT_VIEW;
};

export const hasFullView = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;
// Create / edit / delete of operational data (sites, kits, links, stock,
// vehicles, drivers, parts ...).
export const canEdit = (user) => isSuperAdmin(user);
export const isProjectManager = (user) => user?.role === "project_manager";
// Sites: super admins and Project Managers add and edit them (deleting
// stays with super admins). Site work: Project Managers review it too.
export const canManageSites = (user) => isSuperAdmin(user) || isProjectManager(user);
export const canReviewSiteWork = (user) => isAdmin(user) || isProjectManager(user);

// Only a super admin requests dispatches (not the CEO, who approves them).
export const DISPATCH_CREATOR_ROLES = new Set(["super_admin", "project_manager"]);
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
// Pages only for drivers (not shown to anyone else, even full-view roles).
export const DRIVER_NAV_IDS = ["trips", "my-vehicle"];
const ROLE_NAV_IDS = {
  site_engineer: ["control", "links", "tracking", "movement-plan", "fleet", "expense-claims"],
};

// Every signed-in account has Settings (WhatsApp number, notification settings).
const EVERYONE_NAV_IDS = ["settings"];

export const getAllowedNavigation = (navigation, user) => {
  if (!user || needsNewRole(user)) return [];
  const everyone = navigation.filter((item) => EVERYONE_NAV_IDS.includes(item.id));
  const forRole = allowedForRole(navigation, user).filter((item) => !EVERYONE_NAV_IDS.includes(item.id));
  return [...forRole, ...everyone];
};

const allowedForRole = (navigation, user) => {
  if (isDriver(user)) return navigation.filter((item) => DRIVER_NAV_IDS.includes(item.id));
  navigation = navigation.filter((item) => !DRIVER_NAV_IDS.includes(item.id));
  if (hasFullView(user)) return navigation.filter((item) => item.id !== "users" || canManageUsers(user));
  if (isFieldWorker(user)) return navigation.filter((item) => FIELD_WORKER_NAV_IDS.includes(item.id));
  const allowed = ROLE_NAV_IDS[user.role] || CLIENT_NAV_IDS;
  return navigation.filter((item) => allowed.includes(item.id));
};
