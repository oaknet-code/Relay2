export const ACCESS_LEVELS = {
  FULL: "full",
  CLIENT_VIEW: "client_view"
};

export const FULL_ACCESS_EMAILS = [
  "mohamed@oaknetbusiness.com",
  "bashir@oaknetbusiness.com",
  "shamku@oaknetbusiness.com",
  "dan.mwangi@oaknetbusiness.com",
  "stan@oaknetbusiness.com",
  "charles@oaknetbusiness.com",
  "elizabethleiyagu441@gmail.com"
];

export const CLIENT_NAV_IDS = ["control", "links"];

export const normalizeEmail = (email = "") => email.trim().toLowerCase();

export const hasFullAccessEmail = (email) => (
  FULL_ACCESS_EMAILS.includes(normalizeEmail(email))
);

export const getAccessLevel = (user) => (
  user?.accessLevel || user?.access_level || (
    hasFullAccessEmail(user?.email) ? ACCESS_LEVELS.FULL : ACCESS_LEVELS.CLIENT_VIEW
  )
);

export const canEdit = (user) => getAccessLevel(user) === ACCESS_LEVELS.FULL;

export const getAllowedNavigation = (navigation, user) => (
  canEdit(user) ? navigation : navigation.filter(item => CLIENT_NAV_IDS.includes(item.id))
);
