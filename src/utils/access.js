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
export const isAdmin = (user) => user?.role === "admin";
export const isFieldWorker = (user) => user?.role === "field_worker";

export const getAccessLevel = (user) => {
  if (isAdmin(user)) return ACCESS_LEVELS.FULL;
  if (isFieldWorker(user)) return ACCESS_LEVELS.FIELD_WORKER;
  return ACCESS_LEVELS.CLIENT_VIEW;
};

export const canEdit = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;

export const CLIENT_NAV_IDS = ["control", "links"];
// Field worker accounts are restricted to solely the Site Work page —
// no Mission Control, no other pipeline stages, no admin views.
export const FIELD_WORKER_NAV_IDS = ["site-work"];

export const getAllowedNavigation = (navigation, user) => {
  if (isFieldWorker(user)) {
    return navigation.filter(item => FIELD_WORKER_NAV_IDS.includes(item.id));
  }
  return canEdit(user) ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id));
};
