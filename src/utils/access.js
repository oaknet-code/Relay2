import { getCurrentRole } from "./auth";

export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view"
};

// Admin emails/roles are never hardcoded or read from the login response
// here. Display permissions are derived from the signed `role` claim inside
// the JWT (see utils/auth.js), not from the login JSON body — that body is
// unsigned and can be altered client-side. Actual enforcement still happens
// on the backend via 403s; this only controls what the UI shows.
export const CLIENT_NAV_IDS = ["control", "links"];

export const getAccessLevel = () => (
  getCurrentRole() === "admin" ? ACCESS_LEVELS.FULL : ACCESS_LEVELS.CLIENT_VIEW
);

export const canEdit = () => getAccessLevel() === ACCESS_LEVELS.FULL;

export const getAllowedNavigation = (navigation) => (
  canEdit() ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id))
);
