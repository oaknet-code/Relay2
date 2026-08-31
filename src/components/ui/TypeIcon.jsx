import React from 'react';
import { Cpu, RadioTower, SatelliteDish, Boxes } from 'lucide-react';

const TYPE_ICON_MAP = { 
  IDU: Cpu, 
  ODU: RadioTower, 
  DISH: SatelliteDish 
};

export function TypeIcon({ t, size = 15 }) {
  const IconComponent = TYPE_ICON_MAP[t] || Boxes;
  return <IconComponent size={size} />;
}