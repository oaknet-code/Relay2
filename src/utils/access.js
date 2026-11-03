export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view",
  FIELD_WORKER: "field_worker",
};

// `user.role` must come from GET /api/auth/me, never from the login
// response body — the token is an HttpOnly cookie the client can't read,
// and /me re-derives the role server-side (via the `protect` middleware)
// on every call rather than trusting anything the client supplied. Actual
// enforcement still happens on the backend via 403s; this only controls
// what the UI shows.
//
// Super admin: full access. Admin: sees everything (full navigation) but
// can't create, edit or delete operational data; it manages accounts below
// admin level only.
export const isSuperAdmin = (user) => ["super_admin", "ceo"].includes(user?.role);
export const isAdmin = (user) => user?.role === "admin" || isSuperAdmin(user);
export const isFieldWorker = (user) => user?.role === "field_worker";

export const getAccessLevel = (user) => {
  if (isAdmin(user)) return ACCESS_LEVELS.FULL;
  if (isFieldWorker(user)) return ACCESS_LEVELS.FIELD_WORKER;
  return ACCESS_LEVELS.CLIENT_VIEW;
};

export const hasFullView = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;
// Create / edit / delete of operational data (sites, kits, links, ...).
export const canEdit = (user) => isSuperAdmin(user);

export const CLIENT_NAV_IDS = ["control", "links"];
// Field worker accounts are restricted to solely the Site Work page —
// and their own expense claims.
export const FIELD_WORKER_NAV_IDS = ["site-work", "expense-claims"];
const MOVEMENT_PLAN_ROLES = new Set(["super_admin", "admin", "warehouse_manager", "warehouse_operator", "site_engineer"]);
export const ASSET_TRACKING_ROLES = new Set(["warehouse_manager", "warehouse_operator", "project_manager", "ceo", "site_manager"]);
export const DISPATCH_CREATOR_ROLES = new Set(["warehouse_manager", "warehouse_operator"]);
export const FLEET_VIEW_ROLES = new Set(["warehouse_manager", "warehouse_operator", "site_engineer", "project_manager", "ceo", "site_manager"]);
export const canViewAssetTracking = (user) => hasFullView(user) || ASSET_TRACKING_ROLES.has(user?.role);
export const canViewFleet = (user) => hasFullView(user) || FLEET_VIEW_ROLES.has(user?.role);

export const getAllowedNavigation = (navigation, user) => {
  if (isFieldWorker(user)) {
    return navigation.filter(item => FIELD_WORKER_NAV_IDS.includes(item.id));
  }
  if (MOVEMENT_PLAN_ROLES.has(user?.role) && !isAdmin(user)) {
    return navigation.filter(item =>
      item.id === "movement-plan" ||
      item.id === "expense-claims" ||
      (FLEET_VIEW_ROLES.has(user.role) && item.id === "fleet") ||
      (ASSET_TRACKING_ROLES.has(user.role) && item.id === "tracking") ||
      (DISPATCH_CREATOR_ROLES.has(user.role) && item.id === "dispatch")
    );
  }
  if (ASSET_TRACKING_ROLES.has(user?.role) && !isAdmin(user)) {
    return navigation.filter(item => item.id === "tracking" || item.id === "expense-claims" ||
      (FLEET_VIEW_ROLES.has(user.role) && item.id === "fleet"));
  }
  return hasFullView(user) ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id));
};
