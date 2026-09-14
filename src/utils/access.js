export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view"
};

// Note: Admin emails no longer hardcoded in frontend - use role from JWT instead
// Role is determined by backend based on database, not client-side list

export const CLIENT_NAV_IDS = ["control", "links"];

export const getAccessLevel = (user) => (
  user?.accessLevel || user?.access_level || (
    user?.role === "admin" ? ACCESS_LEVELS.FULL : ACCESS_LEVELS.CLIENT_VIEW
  )
);

export const canEdit = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;

export const getAllowedNavigation = (navigation, user) => (
  canEdit(user) ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id))
);
