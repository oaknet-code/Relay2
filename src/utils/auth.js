import { jwtDecode } from "jwt-decode";

/**
 * Source of truth for "who is this user, security-wise": the signed JWT
 * claims, never the login response body. The response body's `user` object
 * is plain JSON with no integrity guarantee — it's fine for display (name,
 * greeting) but must never be used to decide what the UI shows or allows.
 */
export const getTokenClaims = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const claims = jwtDecode(token);
    if (claims.exp && claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
};

export const getCurrentRole = () => getTokenClaims()?.role || null;
