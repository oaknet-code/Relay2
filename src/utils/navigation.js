import { 
  Gauge, Antenna, Boxes, Layers, ShieldCheck, Truck, Smartphone, Users, MapPin, ClipboardList 
} from 'lucide-react';

export const NAV_CONFIG = [
  { id: "control", label: "Mission Control", step: "06", ico: Gauge },
  { id: "links", label: "Links", step: "01", ico: Antenna },
  { id: "inventory", label: "Inventory", step: "01", ico: Boxes },
  { id: "kits", label: "Site Kits", step: "01", ico: Layers },
  { id: "staging", label: "Staging Bay", step: "02", ico: ShieldCheck },
  { id: "dispatch", label: "Dispatch", step: "03", ico: Truck },
  { id: "fleet", label: "Fleet", step: "05", ico: MapPin },
  { id: "field", label: "Field Ops", step: "04", ico: Smartphone },
  { id: "tracking", label: "Asset Tracking", step: "Audit", ico: ClipboardList },
  { id: "clients", label: "Clients", step: "Admin", ico: Users },
];
