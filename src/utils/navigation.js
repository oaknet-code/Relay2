import { 
  Gauge, Antenna, Boxes, Layers, ShieldCheck, Truck, Smartphone, Users, MapPin, ClipboardList 
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
  { id: "kits", label: "Site Kits", step: "01", group: "pipeline", ico: Layers },
  { id: "staging", label: "Staging Bay", step: "02", group: "pipeline", ico: ShieldCheck },
  { id: "dispatch", label: "Dispatch", step: "03", group: "pipeline", ico: Truck },
  { id: "fleet", label: "Fleet", step: "04", group: "pipeline", ico: MapPin },
  { id: "field", label: "Field Ops", step: "05", group: "pipeline", ico: Smartphone },
  { id: "tracking", label: "Asset Tracking", step: "Audit", group: "admin", ico: ClipboardList },
  { id: "clients", label: "Clients", group: "admin", ico: Users },
];
