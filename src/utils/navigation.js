import {
  Gauge, Antenna, Boxes, Truck, Users, MapPin, ClipboardList, Camera, Bell, Building2, Route, Wallet, Navigation, Settings
} from 'lucide-react';

export const NAV_GROUPS = [
  { id: "mission", label: "Mission Control" },
  { id: "pipeline", label: "Rollout Pipeline" },
  { id: "admin", label: "System & Administration" },
];

export const NAV_CONFIG = [
  { id: "control", label: "Mission Control", group: "mission", ico: Gauge },
  { id: "links", label: "Links", group: "mission", ico: Antenna },
  { id: "inventory", label: "Inventory", group: "mission", ico: Boxes },
  { id: "sites", label: "Sites", group: "pipeline", ico: Building2 },
  { id: "dispatch", label: "Dispatch", group: "pipeline", ico: Truck },
  { id: "trips", label: "My Trips", group: "pipeline", ico: Navigation }, // drivers only
  { id: "my-vehicle", label: "My Vehicle", group: "pipeline", ico: Truck }, // drivers only
  { id: "fleet", label: "Fleet", group: "pipeline", ico: MapPin },
  { id: "movement-plan", label: "Movement Plan", group: "pipeline", ico: Route },
  { id: "expense-claims", label: "Claims", group: "pipeline", ico: Wallet },
  { id: "site-work", label: "Site Work", group: "pipeline", ico: Camera },
  { id: "tracking", label: "Asset Tracking", step: "Audit", group: "admin", ico: ClipboardList },
  { id: "users", label: "User Management", group: "admin", ico: Users },
  { id: "notifications", label: "Notifications", group: "admin", ico: Bell },
  { id: "settings", label: "Settings", group: "admin", ico: Settings }, // everyone
];
