import {
  Gauge, Antenna, Boxes, Layers, Truck, Smartphone, Users, MapPin, ClipboardList, Camera
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
  { id: "kits", label: "Site Kits", group: "pipeline", ico: Layers },
  { id: "dispatch", label: "Dispatch", group: "pipeline", ico: Truck },
  { id: "fleet", label: "Fleet", group: "pipeline", ico: MapPin },
  { id: "field", label: "Field Ops", group: "pipeline", ico: Smartphone },
  { id: "site-work", label: "Site Work", group: "pipeline", ico: Camera },
  { id: "tracking", label: "Asset Tracking", step: "Audit", group: "admin", ico: ClipboardList },
  { id: "users", label: "User Management", group: "admin", ico: Users },
];
