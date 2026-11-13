import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { Complaint } from '../types/civic.ts';

interface LeafletMapProps {
  mode: 'picker' | 'viewer';
  complaints?: Complaint[];
  selectedLat?: number | null;
  selectedLng?: number | null;
  onPickLocation?: (lat: number, lng: number) => void;
  onSelectComplaint?: (complaint: Complaint) => void;
  showHotspots?: boolean;
  heightClass?: string;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

function getMarkerColor(status: string): string {
  switch (status) {
    case 'Resolved':
      return '#059669'; // Emerald green
    case 'In Progress':
      return '#2563eb'; // Civic blue
    case 'Rejected':
      return '#dc2626'; // Crimson
    case 'Verified':
    case 'Submitted':
    default:
      return '#d97706'; // Amber pending
  }
}

export function LeafletMap({
  mode,
  complaints = [],
  selectedLat,
  selectedLng,
  onPickLocation,
  onSelectComplaint,
  showHotspots = false,
  heightClass = 'h-80',
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const pickerMarkerRef = useRef<L.CircleMarker | null>(null);

  // Initialize Leaflet instance once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      selectedLat !== null &&
      selectedLat !== undefined &&
      selectedLng !== null &&
      selectedLng !== undefined
        ? [selectedLat, selectedLng]
        : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: mode === 'picker' ? 13 : 12,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      pickerMarkerRef.current = null;
    };
  }, []);

  // Handle click events in picker mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'picker' || !onPickLocation) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      onPickLocation(lat, lng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mode, onPickLocation]);

  // Update picker pin when coordinates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'picker') return;

    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.remove();
      pickerMarkerRef.current = null;
    }

    if (
      typeof selectedLat === 'number' &&
      !Number.isNaN(selectedLat) &&
      typeof selectedLng === 'number' &&
      !Number.isNaN(selectedLng)
    ) {
      const marker = L.circleMarker([selectedLat, selectedLng], {
        radius: 9,
        color: '#1e3a8a',
        weight: 2.5,
        fillColor: '#2563eb',
        fillOpacity: 0.9,
      }).addTo(map);
      marker.bindTooltip('Pinned Issue Location', { direction: 'top' });
      pickerMarkerRef.current = marker;
      map.setView([selectedLat, selectedLng], Math.max(map.getZoom(), 14), { animate: true });
    }
  }, [mode, selectedLat, selectedLng]);

  // Render viewer markers & optional hotspot circles
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group || mode !== 'viewer') return;

    group.clearLayers();
    const validPoints: [number, number][] = [];

    if (showHotspots) {
      for (const item of complaints) {
        if (item.latitude === null || item.longitude === null) continue;
        if (item.status === 'Resolved' || item.status === 'Rejected') continue;
        const radiusMeters = item.severity === 'High' ? 650 : item.severity === 'Medium' ? 450 : 300;
        L.circle([item.latitude, item.longitude], {
          radius: radiusMeters,
          color: '#dc2626',
          weight: 0.5,
          fillColor: item.severity === 'High' ? '#ef4444' : '#f59e0b',
          fillOpacity: 0.16,
          interactive: false,
        }).addTo(group);
      }
    }

    for (const item of complaints) {
      if (item.latitude === null || item.longitude === null) continue;
      validPoints.push([item.latitude, item.longitude]);
      const color = getMarkerColor(item.status);

      const marker = L.circleMarker([item.latitude, item.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      });

      const popupNode = document.createElement('div');
      popupNode.className = 'min-w-[210px] space-y-1.5 text-xs text-slate-800';
      popupNode.innerHTML = `
        <div class="font-mono text-[11px] font-semibold text-blue-700">${item.complaint_code}</div>
        <div class="font-semibold text-slate-900 leading-snug">${escapeHtml(item.title)}</div>
        <div class="text-slate-600">${escapeHtml(item.category)} · ${escapeHtml(item.ward_area)}</div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-200">
          <span class="font-semibold" style="color:${color}">${escapeHtml(item.status)}</span>
          <span class="text-slate-500">${escapeHtml(item.severity)} Severity</span>
        </div>
      `;

      if (onSelectComplaint) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Open Details';
        btn.className =
          'mt-2 w-full rounded bg-slate-900 px-2.5 py-1.5 text-center text-xs font-medium text-white hover:bg-slate-800 cursor-pointer';
        btn.onclick = () => onSelectComplaint(item);
        popupNode.appendChild(btn);
      }

      marker.bindPopup(popupNode);
      marker.addTo(group);
    }

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
    }
  }, [mode, complaints, showHotspots, onSelectComplaint]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg border border-slate-200 bg-slate-100 ${heightClass}`}
      aria-label={mode === 'picker' ? 'Interactive map to pick issue coordinates' : 'Interactive map of civic issues'}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
