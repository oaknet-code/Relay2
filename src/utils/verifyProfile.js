// Verifies the signed profile returned by GET /api/auth/me. The backend
// signs { email, firstName, lastName, role, iat, exp } with its private key
// (ECDSA P-256 / SHA-256); we check it against the public key baked in at
// build time. If the response was edited in transit — e.g. role changed to
// "admin" with Caido or Burp — the signature won't match and we refuse the
// session instead of rendering the admin UI.
//
// This is a UI safeguard only. Every API route still enforces the real role
// on the server, which is what actually protects the data.

const PUBLIC_KEY_B64 = import.meta.env.VITE_PROFILE_SIGNING_PUBLIC_KEY;

let publicKeyPromise = null;

function getPublicKey() {
  if (!PUBLIC_KEY_B64) {
    return Promise.reject(new Error("VITE_PROFILE_SIGNING_PUBLIC_KEY is not set."));
  }
  if (!publicKeyPromise) {
    const der = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) => c.charCodeAt(0));
    publicKeyPromise = crypto.subtle.importKey(
      "spki",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  }
  return publicKeyPromise;
}

export async function verifySignedProfile(signed) {
  if (!signed || typeof signed.payload !== "string" || typeof signed.signature !== "string") {
    throw new Error("Session could not be verified.");
  }

  const signature = Uint8Array.from(atob(signed.signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    await getPublicKey(),
    signature,
    new TextEncoder().encode(signed.payload),
  );
  if (!valid) {
    throw new Error("Session could not be verified.");
  }

  const { iat, exp, ...profile } = JSON.parse(signed.payload);
  if (typeof exp !== "number" || exp * 1000 < Date.now()) {
    throw new Error("Session could not be verified.");
  }
  return profile;
}
