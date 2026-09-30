import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTelemetryStore } from '../../store/telemetryStore';
import { ROUTE_POLYLINE, ROUTE_WAYPOINTS } from '../../demo/routes';

export const LiveMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const stoppageMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [expanded, setExpanded] = useState(false);

  const activeOrder = useTelemetryStore((s) => s.activeOrder);
  const gps = useTelemetryStore((s) => s.current.gps);
  const speed = useTelemetryStore((s) => s.current.speed);
  const stoppage = useTelemetryStore((s) => s.current.stoppage);

  const polyline = activeOrder.routePolyline || ROUTE_POLYLINE;
  const waypoints = activeOrder.waypoints || ROUTE_WAYPOINTS;

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [gps.lng, gps.lat],
      zoom: 7.4,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // Split coordinates into completed and remaining
      const splitIdx = Math.max(1, Math.floor(polyline.length * (activeOrder.progressPercent / 100)));
      const completedCoords = [...polyline.slice(0, splitIdx).map((p) => [p.lng, p.lat]), [gps.lng, gps.lat]];
      const remainingCoords = [[gps.lng, gps.lat], ...polyline.slice(splitIdx).map((p) => [p.lng, p.lat])];

      // 1. Covered/Traveled Path - Outer Light Blue Glow Casing
      map.addSource('route-completed-casing', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: completedCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: 'route-completed-casing-line',
        type: 'line',
        source: 'route-completed-casing',
        paint: {
          'line-color': '#60A5FA',
          'line-width': 8,
          'line-opacity': 0.7,
        },
      });

      // 2. Covered/Traveled Path - Inner Solid Royal Blue Core
      map.addSource('route-completed-core', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: completedCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: 'route-completed-core-line',
        type: 'line',
        source: 'route-completed-core',
        paint: {
          'line-color': '#1D4ED8',
          'line-width': 4.5,
          'line-opacity': 1.0,
        },
      });

      // 3. Planned/To-be-covered Path - Distinctive Dashed Line
      map.addSource('route-remaining', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: remainingCoords },
          properties: {},
        },
      });
      map.addLayer({
        id: 'route-remaining-line',
        type: 'line',
        source: 'route-remaining',
        paint: {
          'line-color': '#475569',
          'line-width': 3.5,
          'line-opacity': 0.85,
          'line-dasharray': [3, 3],
        },
      });

      // 4. Milestone Checkpoint Dots with Labels
      waypoints.forEach((wp) => {
        const el = document.createElement('div');
        el.className = 'cursor-pointer transform hover:scale-125 transition-transform flex flex-col items-center';
        const isOrigin = wp.type === 'origin';
        const isDest = wp.type === 'destination';
        const isPassed = !!wp.actualArrival;

        const dotBg = isOrigin ? '#10B981' : isDest ? '#EF4444' : isPassed ? '#2563EB' : '#64748B';

        el.innerHTML = `
          <div style="
            width: ${isOrigin || isDest ? 16 : 12}px;
            height: ${isOrigin || isDest ? 16 : 12}px;
            border-radius: 50%;
            background: ${dotBg};
            border: 2.5px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          "></div>
          <div style="
            margin-top: 2px;
            padding: 1px 5px;
            background: rgba(255,255,255,0.92);
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            font-family: Inter, sans-serif;
            font-size: 10px;
            font-weight: 700;
            color: #0F172A;
            white-space: nowrap;
          ">${wp.name.split(' ')[0]}</div>
        `;

        new maplibregl.Marker({ element: el, anchor: 'top' })
          .setLngLat([wp.coordinate.lng, wp.coordinate.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 16 })
              .setHTML(`
                <div style="font-family:Inter,sans-serif;padding:4px">
                  <p style="font-size:12px;font-weight:700;color:#0F172A;margin:0 0 3px 0">${wp.name}</p>
                  <p style="font-size:11px;color:#64748B;margin:0">
                    ${wp.actualArrival ? `Passed at ${new Date(wp.actualArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : wp.estimatedArrival ? `Est: ${new Date(wp.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Milestone'}
                  </p>
                </div>
              `)
          )
          .addTo(map);
      });

      // 5. Live Position Radar Marker
      const posEl = document.createElement('div');
      posEl.innerHTML = `
        <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.35);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
          <div style="position:relative;width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #ffffff;box-shadow:0 3px 12px rgba(37,99,235,0.7);display:flex;align-items:center;justify-content:center">
            <div style="width:4px;height:4px;border-radius:50%;background:#ffffff"></div>
          </div>
        </div>
      `;

      const posMarker = new maplibregl.Marker({ element: posEl, anchor: 'center' })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map);

      markerRef.current = posMarker;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [activeOrder.id]);

  // Update live marker position
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([gps.lng, gps.lat]);
    }
  }, [gps]);

  // Handle stoppage marker display on the map
  useEffect(() => {
    if (!mapRef.current) return;

    if (stoppage.hasAlert || speed.value === 0) {
      if (!stoppageMarkerRef.current) {
        const stopEl = document.createElement('div');
        stopEl.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer">
            <div style="
              display: flex;
              align-items: center;
              gap: 5px;
              background: #FEF2F2;
              border: 2px solid #EF4444;
              padding: 4px 8px;
              border-radius: 8px;
              box-shadow: 0 4px 16px rgba(239,68,68,0.4);
              font-family: Inter, sans-serif;
              font-size: 11px;
              font-weight: 800;
              color: #B91C1C;
              animation: bounce 1.5s infinite;
            ">
              <span style="font-size:13px">🛑</span>
              <span>STOPPAGE &gt; 1h (${stoppage.stationaryDurationMinutes}m)</span>
            </div>
            <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #EF4444"></div>
          </div>
        `;

        const stopMarker = new maplibregl.Marker({ element: stopEl, anchor: 'bottom' })
          .setLngLat([gps.lng, gps.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(`
                <div style="font-family:Inter,sans-serif;padding:6px">
                  <p style="font-size:12px;font-weight:800;color:#DC2626;margin:0 0 4px 0">⚠️ Unscheduled Stoppage Hazard</p>
                  <p style="font-size:11px;color:#334155;margin:0 0 2px 0">Location: ${stoppage.locationName}</p>
                  <p style="font-size:11px;color:#64748B;margin:0">Duration: <strong>${stoppage.stationaryDurationMinutes} mins</strong> stationary (&gt;60m threshold breach)</p>
                </div>
              `)
          )
          .addTo(mapRef.current);

        stoppageMarkerRef.current = stopMarker;
      } else {
        stoppageMarkerRef.current.setLngLat([gps.lng, gps.lat]);
      }
    } else if (stoppageMarkerRef.current) {
      stoppageMarkerRef.current.remove();
      stoppageMarkerRef.current = null;
    }
  }, [stoppage.hasAlert, speed.value, stoppage.stationaryDurationMinutes, gps]);

  // Handle map resize on expand
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.resize();
      }, 320);
    }
  }, [expanded]);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden flex flex-col relative isolation-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9] gap-3 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#0F172A]">Live Route Tracking</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                stoppage.hasAlert || speed.value === 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {stoppage.hasAlert || speed.value === 0 ? '🛑 Stationary Alert' : '🟢 In Motion'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-mono mt-0.5">
              {gps.lat.toFixed(4)}°N, {gps.lng.toFixed(4)}°E · {activeOrder.origin} → {activeOrder.destination}
            </p>
          </div>
        </div>

        {/* Legend & Controls */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <span className="flex items-center gap-1.5 font-semibold text-blue-700">
              <span className="w-4 h-1.5 bg-blue-600 rounded-full shadow-xs" />
              <span>Traveled</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-slate-500">
              <span className="w-4 h-1 border-t-2 border-dashed border-slate-500" />
              <span>Planned</span>
            </span>
          </div>
          <button
            id="map-expand-btn"
            onClick={() => setExpanded(!expanded)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-[#0F172A] transition-colors cursor-pointer"
          >
            {expanded ? '↑ Collapse' : '↓ Expand Map'}
          </button>
        </div>
      </div>

      {/* Map Canvas Wrapper */}
      <div
        className="w-full relative bg-slate-100 transition-all duration-300 ease-out overflow-hidden"
        style={{ height: expanded ? 480 : 300 }}
      >
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
};
