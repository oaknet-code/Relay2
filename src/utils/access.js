export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view"
};

// `user.role` must come from GET /api/auth/me, never from the login
// response body — the token is an HttpOnly cookie the client can't read,
// and /me re-derives the role server-side (via the `protect` middleware)
// on every call rather than trusting anything the client supplied. Actual
// enforcement still happens on the backend via 403s; this only controls
// what the UI shows.
export const CLIENT_NAV_IDS = ["control", "links"];

export const getAccessLevel = (user) => (
  user?.role === "admin" ? ACCESS_LEVELS.FULL : ACCESS_LEVELS.CLIENT_VIEW
);

export const canEdit = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;

export const getAllowedNavigation = (navigation, user) => (
  canEdit(user) ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id))
);
