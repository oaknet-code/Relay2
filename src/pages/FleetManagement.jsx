import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Truck, Car, Navigation, Fuel, Gauge, Clock, ArrowRight,
  ParkingCircle, Activity, AlertTriangle, Wrench, CircleDot, Navigation2,
  Filter, ChevronRight, Zap
} from 'lucide-react';
import {
  FLEET_VEHICLES, TRIP_HISTORY, PARKING_ZONES, ROUTE_WAYPOINTS
} from '../data/mockData';

// ─── Custom Marker Icons ────────────────────────────────────
const createVehicleIcon = (status, isSelected) => {
  const colorMap = {
    moving: '#33dcae',
    parked: '#5f6e80',
    idle: '#5fa8ff',
    maintenance: '#ff5f5f'
  };
  const color = colorMap[status] || '#5f6e80';
  const size = isSelected ? 42 : 34;
  const innerSize = size - 10;

  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: `
      <div class="vehicle-marker ${status}${isSelected ? ' selected' : ''}" style="width:${size}px;height:${size}px;">
        <div class="vm-inner" style="width:${innerSize}px;height:${innerSize}px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
};

const createParkingIcon = () => {
  return L.divIcon({
    className: 'parking-marker-icon',
    html: `
      <div style="width:28px;height:28px;border-radius:7px;background:rgba(173,139,255,0.18);border:1.5px solid rgba(173,139,255,0.5);display:grid;place-items:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ad8bff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="4"/>
          <path d="M9 16V8h4a3 3 0 0 1 0 6H9"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -18],
  });
};

// ─── Map Controller Component ───────────────────────────────
function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 14, { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

// ─── Time Helpers ───────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const fmtDuration = (mins) => {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// ─── Fuel bar color ─────────────────────────────────────────
const fuelColor = (pct) => {
  if (pct > 50) return 'var(--teal)';
  if (pct > 25) return 'var(--amber)';
  return 'var(--red)';
};

// ─── Main Component ─────────────────────────────────────────
export function FleetManagement() {
  const [vehicles, setVehicles] = useState(FLEET_VEHICLES);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tripVehicleFilter, setTripVehicleFilter] = useState('all');
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(null);
  const [showRoute, setShowRoute] = useState(null);
  const tickRef = useRef(0);

  // Simulated real-time movement
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setVehicles(prev => prev.map(v => {
        if (v.status !== 'moving') return v;
        // Subtle random drift to simulate movement
        const dlat = (Math.random() - 0.48) * 0.0012;
        const dlng = (Math.random() - 0.48) * 0.0012;
        const dspd = Math.floor((Math.random() - 0.5) * 8);
        return {
          ...v,
          lat: v.lat + dlat,
          lng: v.lng + dlng,
          speed: Math.max(5, Math.min(80, v.speed + dspd)),
          lastUpdate: new Date().toISOString()
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // KPIs
  const kpis = useMemo(() => {
    const active = vehicles.filter(v => v.status === 'moving').length;
    const totalDistToday = TRIP_HISTORY
      .filter(t => t.date === '2026-06-29')
      .reduce((s, t) => s + t.distance, 0);
    const avgFuel = Math.round(vehicles.reduce((s, v) => s + v.fuel, 0) / vehicles.length);
    const parked = vehicles.filter(v => v.status === 'parked' || v.status === 'idle').length;
    return { active, totalDistToday, avgFuel, parked };
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    if (statusFilter === 'all') return vehicles;
    return vehicles.filter(v => v.status === statusFilter);
  }, [vehicles, statusFilter]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    if (tripVehicleFilter === 'all') return TRIP_HISTORY;
    return TRIP_HISTORY.filter(t => t.vehicleId === tripVehicleFilter);
  }, [tripVehicleFilter]);

  // Status counts
  const statusCounts = useMemo(() => ({
    all: vehicles.length,
    moving: vehicles.filter(v => v.status === 'moving').length,
    parked: vehicles.filter(v => v.status === 'parked').length,
    idle: vehicles.filter(v => v.status === 'idle').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  }), [vehicles]);

  const handleVehicleSelect = useCallback((v) => {
    setSelectedVehicle(v.id === selectedVehicle ? null : v.id);
    if (v.id !== selectedVehicle) {
      setMapCenter([v.lat, v.lng]);
      setMapZoom(15);
      // Show route if vehicle is moving and has waypoints
      if (v.status === 'moving' && ROUTE_WAYPOINTS[v.id]) {
        setShowRoute(v.id);
      } else {
        setShowRoute(null);
      }
    } else {
      setMapCenter(null);
      setShowRoute(null);
    }
  }, [selectedVehicle]);

  const handleTripClick = useCallback((trip) => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    if (vehicle) {
      setSelectedVehicle(vehicle.id);
      setMapCenter([vehicle.lat, vehicle.lng]);
      setMapZoom(14);
      if (ROUTE_WAYPOINTS[vehicle.id]) {
        setShowRoute(vehicle.id);
      }
    }
  }, [vehicles]);

  const parkingIcon = useMemo(() => createParkingIcon(), []);

  return (
    <div>
      {/* Header */}
      <div className="view-head">
        <span className="tagchip">
          <MapPin size={11} />
          Step 5 · Fleet Tracking
        </span>
        <h2>Fleet Management</h2>
        <p>
          Real-time vehicle tracking, route visualization, trip history, and parking zone monitoring.
          Vehicles on active dispatch runs are tracked live with{' '}
          <b>3-second position updates</b>.
        </p>
      </div>

      {/* KPI Row */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ '--gl': 'rgba(51, 220, 174, 0.12)' }}>
          <div className="k-top">
            <Activity size={14} />
            ACTIVE VEHICLES
          </div>
          <div className="k-val">{kpis.active}</div>
          <div className="k-sub">of {vehicles.length} fleet total</div>
        </div>
        <div className="kpi" style={{ '--gl': 'rgba(95, 168, 255, 0.12)' }}>
          <div className="k-top">
            <Navigation2 size={14} />
            DISTANCE TODAY
          </div>
          <div className="k-val">{kpis.totalDistToday.toFixed(1)}<span style={{ fontSize: 16, marginLeft: 3 }}>km</span></div>
          <div className="k-sub">aggregate fleet travel</div>
        </div>
        <div className="kpi" style={{ '--gl': 'rgba(95, 168, 255, 0.12)' }}>
          <div className="k-top">
            <Fuel size={14} />
            AVG FUEL LEVEL
          </div>
          <div className="k-val">{kpis.avgFuel}<span style={{ fontSize: 16, marginLeft: 2 }}>%</span></div>
          <div className="k-sub">fleet-wide average</div>
        </div>
        <div className="kpi" style={{ '--gl': 'rgba(173, 139, 255, 0.12)' }}>
          <div className="k-top">
            <ParkingCircle size={14} />
            PARKED / IDLE
          </div>
          <div className="k-val">{kpis.parked}</div>
          <div className="k-sub">vehicles stationary</div>
        </div>
      </div>

      {/* Map + Vehicle List Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 0 }}>
        {/* Map */}
        <div className="fleet-map-wrap">
          <MapContainer
            center={[-1.2864, 36.8200]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {mapCenter && <MapFlyTo center={mapCenter} zoom={mapZoom} />}

            {/* Vehicle markers */}
            {vehicles.map(v => (
              <Marker
                key={v.id}
                position={[v.lat, v.lng]}
                icon={createVehicleIcon(v.status, selectedVehicle === v.id)}
                eventHandlers={{
                  click: () => handleVehicleSelect(v)
                }}
              >
                <Popup>
                  <div className="fleet-popup">
                    <div className="fp-head">
                      <span className="fp-plate">{v.plate}</span>
                      <span className={`fleet-status ${v.status}`}>{v.status}</span>
                    </div>
                    <div className="fp-row">
                      <span className="fp-label">Driver</span>
                      <span className="fp-val">{v.driver}</span>
                    </div>
                    <div className="fp-row">
                      <span className="fp-label">Vehicle</span>
                      <span className="fp-val">{v.make}</span>
                    </div>
                    <div className="fp-row">
                      <span className="fp-label">Speed</span>
                      <span className="fp-val">{v.speed} km/h</span>
                    </div>
                    <div className="fp-row">
                      <span className="fp-label">Fuel</span>
                      <span className="fp-val">{v.fuel}%</span>
                    </div>
                    <div className="fp-fuel-bar">
                      <span style={{
                        width: `${v.fuel}%`,
                        background: fuelColor(v.fuel)
                      }} />
                    </div>
                    <div className="fp-row" style={{ marginTop: 6 }}>
                      <span className="fp-label">Updated</span>
                      <span className="fp-val">{timeAgo(v.lastUpdate)}</span>
                    </div>
                    {v.assignedLink && (
                      <div className="fp-row">
                        <span className="fp-label">Link</span>
                        <span className="fp-val" style={{ color: 'var(--amber)' }}>{v.assignedLink}</span>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Parking zone circles */}
            {PARKING_ZONES.filter(pz => 
              // Only show Nairobi-area zones at default zoom
              Math.abs(pz.lat - (-1.29)) < 0.3
            ).map(pz => (
              <React.Fragment key={pz.id}>
                <Circle
                  center={[pz.lat, pz.lng]}
                  radius={200}
                  pathOptions={{
                    color: 'rgba(173, 139, 255, 0.5)',
                    fillColor: 'rgba(173, 139, 255, 0.08)',
                    fillOpacity: 0.6,
                    weight: 1.5,
                    dashArray: '6 4'
                  }}
                />
                <Marker
                  position={[pz.lat, pz.lng]}
                  icon={parkingIcon}
                >
                  <Popup>
                    <div className="fleet-popup">
                      <div className="fp-head">
                        <span className="fp-plate">{pz.name}</span>
                        <span className={`pz-type ${pz.type}`}>{pz.type}</span>
                      </div>
                      <div className="fp-row">
                        <span className="fp-label">Capacity</span>
                        <span className="fp-val">{pz.occupied}/{pz.capacity}</span>
                      </div>
                      <div className="fp-row">
                        <span className="fp-label">Address</span>
                        <span className="fp-val">{pz.address}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}

            {/* Active route polylines */}
            {showRoute && ROUTE_WAYPOINTS[showRoute] && (
              <Polyline
                positions={ROUTE_WAYPOINTS[showRoute]}
                pathOptions={{
                  color: '#5fa8ff',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '8 6',
                }}
              />
            )}
          </MapContainer>

          {/* Map Legend */}
          <div className="fleet-map-legend">
            <div className="lg-item">
              <span className="lg-dot" style={{ background: '#33dcae' }} />
              Moving
            </div>
            <div className="lg-item">
              <span className="lg-dot" style={{ background: '#5fa8ff' }} />
              Idle
            </div>
            <div className="lg-item">
              <span className="lg-dot" style={{ background: '#5f6e80' }} />
              Parked
            </div>
            <div className="lg-item">
              <span className="lg-dot" style={{ background: '#ff5f5f' }} />
              Maintenance
            </div>
            <div className="lg-item">
              <span className="lg-dot" style={{ background: '#ad8bff', borderRadius: 3 }} />
              Parking Zone
            </div>
          </div>
        </div>

        {/* Vehicle List */}
        <div className="panel">
          <div className="panel-h">
            <Truck size={15} className="ph-ico" />
            <h3>Vehicles</h3>
            <span className="ph-r" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="fleet-live-dot" />
              Live
            </span>
          </div>
          <div className="panel-b" style={{ padding: '12px 14px' }}>
            {/* Filters */}
            <div className="fleet-filters">
              {['all', 'moving', 'parked', 'idle', 'maintenance'].map(s => (
                <button
                  key={s}
                  className={`fleet-filter-btn ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className="ff-count">{statusCounts[s]}</span>
                </button>
              ))}
            </div>

            {/* Vehicle cards */}
            <div className="fleet-vehicle-list">
              {filteredVehicles.map(v => (
                <div
                  key={v.id}
                  className={`fv-card ${selectedVehicle === v.id ? 'selected' : ''}`}
                  onClick={() => handleVehicleSelect(v)}
                >
                  <div className={`fv-ico ${v.status}`}>
                    {v.type === 'Truck' ? <Truck size={16} /> : <Car size={16} />}
                  </div>
                  <div className="fv-info">
                    <div className="fv-plate">
                      {v.plate}
                      <span className={`fleet-status ${v.status}`} style={{ marginLeft: 8 }}>
                        {v.status}
                      </span>
                    </div>
                    <div className="fv-detail">
                      {v.driver} · {v.make}
                      {v.assignedLink && <> · <span style={{ color: 'var(--amber)' }}>{v.assignedLink}</span></>}
                    </div>
                  </div>
                  <div className="fv-right">
                    {v.status === 'moving' && (
                      <div className="fv-speed">{v.speed} <span style={{ fontSize: 9, color: 'var(--faint)' }}>km/h</span></div>
                    )}
                    <div className="fv-fuel">
                      <div className="fv-fuel-bar">
                        <span style={{ width: `${v.fuel}%`, background: fuelColor(v.fuel) }} />
                      </div>
                      {v.fuel}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Trip History + Parking */}
      <div className="fleet-bottom">
        {/* Trip History */}
        <div className="panel">
          <div className="panel-h">
            <Navigation2 size={15} className="ph-ico" />
            <h3>Trip History</h3>
            <span className="ph-r" style={{ marginLeft: 'auto' }}>
              {filteredTrips.length} trips
            </span>
          </div>

          {/* Trip Filters */}
          <div className="trip-filters" style={{ padding: '12px 18px' }}>
            <select
              className="trip-filter-select"
              value={tripVehicleFilter}
              onChange={e => setTripVehicleFilter(e.target.value)}
            >
              <option value="all">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate} — {v.driver}</option>
              ))}
            </select>
          </div>

          {/* Trip List */}
          <div className="trip-list">
            {filteredTrips.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicleId);
              return (
                <div
                  key={trip.id}
                  className="trip-row"
                  onClick={() => handleTripClick(trip)}
                >
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    {trip.date.slice(5)}
                    <br />
                    <span style={{ fontSize: 10 }}>{trip.startTime}</span>
                  </span>
                  <div className="trip-route">
                    <span className="tr-loc">{trip.from}</span>
                    <ArrowRight size={12} className="tr-arrow" />
                    <span className="tr-loc">{trip.to}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11, textAlign: 'right' }}>
                    {trip.distance} km
                  </span>
                  <span className="mono faint" style={{ fontSize: 11, textAlign: 'right' }}>
                    {fmtDuration(trip.duration)}
                  </span>
                  <span className={`fleet-status ${trip.status}`}>
                    {trip.status === 'in_progress' ? 'active' : trip.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Parking Details */}
        <div className="panel">
          <div className="panel-h">
            <ParkingCircle size={15} className="ph-ico" />
            <h3>Parking Zones</h3>
            <span className="ph-r" style={{ marginLeft: 'auto' }}>
              {PARKING_ZONES.length} zones
            </span>
          </div>
          <div className="panel-b">
            <div className="parking-grid">
              {PARKING_ZONES.map(pz => (
                <div key={pz.id} className="pz-card">
                  <div className="pz-head">
                    <span className="pz-name">{pz.name}</span>
                    <span className={`pz-type ${pz.type}`}>{pz.type}</span>
                  </div>
                  <div className="pz-addr">{pz.address}</div>
                  <div className="pz-capacity">
                    <div className="pz-bar">
                      <span style={{ width: `${(pz.occupied / pz.capacity) * 100}%` }} />
                    </div>
                    <span className="pz-slots">
                      {pz.occupied}/{pz.capacity} occupied
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
