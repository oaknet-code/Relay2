import {
  Gauge, Antenna, Boxes, Truck, Smartphone, Users, MapPin, ClipboardList, Camera, Bell, Building2
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
  { id: "fleet", label: "Fleet", group: "pipeline", ico: MapPin },
  { id: "field", label: "Field Ops", group: "pipeline", ico: Smartphone },
  { id: "site-work", label: "Site Work", group: "pipeline", ico: Camera },
  { id: "tracking", label: "Asset Tracking", step: "Audit", group: "admin", ico: ClipboardList },
  { id: "users", label: "User Management", group: "admin", ico: Users },
  { id: "notifications", label: "Notifications", group: "admin", ico: Bell },
];
