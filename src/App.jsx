import React, { useState, useEffect, Suspense, lazy } from "react";
import { Layout } from "./components/layout";
import { ChangePasswordModal } from "./components/layout/ChangePasswordModal";

import { MissionControl } from "./pages/MissionControl";
import { LinksView } from "./pages/LinksView";
import { InventoryView } from "./pages/InventoryView";
import { LoginPage } from "./pages/SignupPage";
import { SiteKits } from "./pages/SiteKits";
import { SiteWorkPage } from "./pages/SiteWorkPage";

import { api } from "./services/api";
import { NAV_CONFIG } from "./utils/navigation";
import { canEdit, getAccessLevel, getAllowedNavigation, isAdmin } from "./utils/access";

import { SEED_ASSETS, LINKS, POD_INIT } from "./data/mockData";

import "./styles/globals.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import "./styles/auth.css";
import "./styles/fleet.css";
import "./styles/tracking.css";
import "./styles/change-password.css";

// These pages are only ever rendered for an admin/full-access session (see
// the hasWriteAccess/isAdmin checks in renderCurrentView below). Loading
// them lazily means their code is bundled into separate chunks that a
// client or field_worker session never fetches — the dynamic import()
// call itself only fires at the moment one of these actually renders.
const StagingBay = lazy(() => import("./pages/StagingBay").then((m) => ({ default: m.StagingBay })));
const Dispatch = lazy(() => import("./pages/Dispatch").then((m) => ({ default: m.Dispatch })));
const FleetManagement = lazy(() => import("./pages/FleetManagement").then((m) => ({ default: m.FleetManagement })));
const FieldOps = lazy(() => import("./pages/FieldOps").then((m) => ({ default: m.FieldOps })));
const AssetTracking = lazy(() => import("./pages/AssetTracking").then((m) => ({ default: m.AssetTracking })));
const UserManagementPage = lazy(() =>
  import("./pages/UserManagementPage").then((m) => ({ default: m.UserManagementPage }))
);

function ChunkLoading() {
  return <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>Loading...</div>;
}

export default function App() {
  const [currentView, setCurrentView] = useState("login");
  const [currentTab, setCurrentTab] = useState("control");

  const [assets, setAssets] = useState(SEED_ASSETS);
  const [pod, setPod] = useState(POD_INIT);

  const [user, setUser] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  /*
   * Load application fonts
   */
  useEffect(() => {
    const id = "relay-fonts";

    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const link = document.createElement("link");

      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap";

      document.head.appendChild(link);
    }
  }, []);

  /*
   * Session persists in an HttpOnly cookie now, so a page refresh doesn't
   * have to force a fresh login — ask the server who (if anyone) the
   * cookie belongs to.
   */
  useEffect(() => {
    api
      .getMe()
      .then(({ user: me }) => {
        setUser(me);
        setCurrentView("dashboard");
      })
      .catch(() => {
        // No valid session — stay on the login screen.
      })
      .finally(() => setIsCheckingSession(false));
  }, []);

  /*
   * Permissions and navigation — derived from the authenticated `/me`
   * profile (see utils/access.js), never from the login response body,
   * which is unsigned and can be tampered with client-side.
   */
  const hasWriteAccess = canEdit(user);
  const navigation = getAllowedNavigation(NAV_CONFIG, user);

  /*
   * Keep current tab valid when permissions/navigation change. Falls back
   * to the first allowed item rather than a hardcoded "control" — a
   * field_worker's only allowed tab is "site-work", and "control" isn't in
   * their navigation at all, so a hardcoded fallback would never resolve.
   */
  useEffect(() => {
    if (!navigation.some((item) => item.id === currentTab) && navigation.length > 0) {
      setCurrentTab(navigation[0].id);
    }
  }, [currentTab, navigation]);

  /*
   * Dispatch assets
   */
  const onDispatch = (uids) => {
    if (!hasWriteAccess) return;

    setAssets((prev) =>
      prev.map((asset) =>
        uids.includes(asset.uid)
          ? {
              ...asset,
              state: "dispatched",
              loc: "Truck KDB-118J",
              daysOut: 0,
            }
          : asset,
      ),
    );
  };

  /*
   * Install asset
   */
  const onInstall = (uid) => {
    if (!hasWriteAccess) return;

    setAssets((prev) =>
      prev.map((asset) =>
        asset.uid === uid
          ? {
              ...asset,
              state: "installed",
              loc: "Summit North · installed",
            }
          : asset,
      ),
    );
  };

  /*
   * Login — `user` here comes from GET /api/auth/me (see LoginPage), which
   * is derived server-side from the HttpOnly session cookie, not from
   * anything the client supplied.
   */
  const onLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView("dashboard");
  };

  /*
   * Logout
   */
  const onLogout = async () => {
    await api.logout();
    setUser(null);
    setCurrentView("login");
  };

  /*
   * Calculate live links
   */
  const liveLinks =
    LINKS.filter((link) => link.status === "live").length +
    (assets
      .filter((asset) => asset.link === "MW-04")
      .every((asset) => asset.state === "installed")
      ? 1
      : 0);

  /*
   * Current navigation item
   */
  const currentViewObj = navigation.find((item) => item.id === currentTab);

  /*
   * Don't flash the login form while we're still asking the server whether
   * the session cookie is valid.
   */
  if (isCheckingSession) {
    return null;
  }

  /*
   * Login screen
   */
  if (currentView === "login") {
    return <LoginPage onLoginSuccess={onLoginSuccess} />;
  }

  /*
   * Render the active application view
   */
  const renderCurrentView = () => {
    switch (currentTab) {
      case "control":
        return <MissionControl assets={assets} />;

      case "links":
        return <LinksView canEdit={hasWriteAccess} />;

      case "inventory":
        return <InventoryView />;

      case "kits":
        return <SiteKits canEdit={hasWriteAccess} />;

      case "staging":
        return hasWriteAccess ? (
          <StagingBay assets={assets} setAssets={setAssets} />
        ) : (
          <MissionControl assets={assets} />
        );

      case "dispatch":
        return hasWriteAccess ? (
          <Dispatch assets={assets} onDispatch={onDispatch} />
        ) : (
          <MissionControl assets={assets} />
        );

      case "fleet":
        return hasWriteAccess ? (
          <FleetManagement />
        ) : (
          <MissionControl assets={assets} />
        );

      case "field":
        return hasWriteAccess ? (
          <FieldOps
            assets={assets}
            pod={pod}
            setPod={setPod}
            onInstall={onInstall}
          />
        ) : (
          <MissionControl assets={assets} />
        );

      case "tracking":
        return hasWriteAccess ? (
          <AssetTracking assets={assets} />
        ) : (
          <MissionControl assets={assets} />
        );

      case "users":
        return isAdmin(user) ? (
          <UserManagementPage />
        ) : (
          <MissionControl assets={assets} />
        );

      case "site-work":
        return <SiteWorkPage user={user} />;

      default:
        return <MissionControl assets={assets} />;
    }
  };

  /*
   * Main application
   */
  return (
    <div className="relay">
      <Layout
        navigation={navigation}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentView={currentViewObj?.label || "Mission Control"}
        liveLinks={liveLinks}
        totalLinks={LINKS.length}
        user={{
          name: user?.firstName || "User",

          title:
            getAccessLevel(user) === "full"
              ? "Full Access"
              : getAccessLevel(user) === "field_worker"
                ? "Field Worker"
                : "Client View Only",

          initials: (user?.firstName || "U").slice(0, 2).toUpperCase(),
        }}
        onLogout={onLogout}
        onChangePassword={() => setIsChangePasswordOpen(true)}
      >
        <Suspense fallback={<ChunkLoading />}>{renderCurrentView()}</Suspense>
      </Layout>

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
