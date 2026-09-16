import React, { useState, useEffect } from "react";
import { Layout } from "./components/layout";
import { ChangePasswordModal } from "./components/layout/ChangePasswordModal";

import { MissionControl } from "./pages/MissionControl";
import { LinksView } from "./pages/LinksView";
import { InventoryView } from "./pages/InventoryView";
import { LoginPage } from "./pages/SignupPage";
import { SiteKits } from "./pages/SiteKits";
import { StagingBay } from "./pages/StagingBay";
import { Dispatch } from "./pages/Dispatch";
import { FieldOps } from "./pages/FieldOps";
import { ClientAdmin } from "./pages/ClientAdmin";
import { FleetManagement } from "./pages/FleetManagement";
import { AssetTracking } from "./pages/AssetTracking";

import { api } from "./services/api";
import { NAV_CONFIG } from "./utils/navigation";
import { canEdit, getAccessLevel, getAllowedNavigation } from "./utils/access";

import { SEED_ASSETS, LINKS, POD_INIT } from "./data/mockData";

import "./styles/globals.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/dashboard.css";
import "./styles/auth.css";
import "./styles/fleet.css";
import "./styles/tracking.css";
import "./styles/change-password.css";

export default function App() {
  const [currentView, setCurrentView] = useState("login");
  const [currentTab, setCurrentTab] = useState("control");

  const [assets, setAssets] = useState(SEED_ASSETS);
  const [pod, setPod] = useState(POD_INIT);

  const [user, setUser] = useState(null);

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
   * Permissions and navigation
   */
  const hasWriteAccess = canEdit(user);
  const navigation = getAllowedNavigation(NAV_CONFIG, user);

  /*
   * Keep current tab valid when permissions/navigation change
   */
  useEffect(() => {
    if (!navigation.some((item) => item.id === currentTab)) {
      setCurrentTab("control");
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
   * Login
   */
  const onLoginSuccess = (newUser) => {
    setUser(newUser);
    setCurrentView("dashboard");
  };

  /*
   * Logout
   */
  const onLogout = () => {
    api.logout();
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

      case "clients":
        return hasWriteAccess ? (
          <ClientAdmin />
        ) : (
          <MissionControl assets={assets} />
        );

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
          name:
            user?.displayName ||
            user?.username ||
            user?.first_name ||
            "User",

          title:
            getAccessLevel(user) === "full"
              ? "Full Access"
              : "Client View Only",

          initials: (user?.displayName || user?.username || "U")
            .slice(0, 2)
            .toUpperCase(),
        }}
        onLogout={onLogout}
        onChangePassword={() => setIsChangePasswordOpen(true)}
      >
        {renderCurrentView()}
      </Layout>

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
