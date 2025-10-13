'use client'

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const dvfIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3B82F6" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const marketIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10B981" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const centerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#EF4444" width="40" height="40">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

export default function EstimationMap({ center, dvfSales = [], marketListings = [] }) {
  useEffect(() => {
    // Ensure window is defined (client-side only)
    if (typeof window !== 'undefined') {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    }
  }, []);

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Search radius circle */}
        <Circle
          center={center}
          radius={1000}
          pathOptions={{ color: 'gray', fillColor: 'gray', fillOpacity: 0.1 }}
        />
        
        {/* Center marker (searched property) */}
        <Marker position={center} icon={centerIcon}>
          <Popup>
            <div className="font-semibold">Votre bien</div>
          </Popup>
        </Marker>
        
        {/* DVF sales markers */}
        {dvfSales.map((sale, idx) => (
          <Marker
            key={`dvf-${idx}`}
            position={[sale.latitude, sale.longitude]}
            icon={dvfIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-blue-600 mb-1">Vente DVF</div>
                <div className="text-xs text-gray-600">{sale.address}</div>
                <div className="mt-2 space-y-1">
                  <div><strong>Prix:</strong> {sale.price.toLocaleString()} €</div>
                  <div><strong>Surface:</strong> {sale.surface} m²</div>
                  <div><strong>Prix/m²:</strong> {sale.pricePerM2.toLocaleString()} €</div>
                  <div><strong>Date:</strong> {sale.date}</div>
                  <div><strong>Distance:</strong> {sale.distance}m</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Market listings markers */}
        {marketListings.map((listing, idx) => {
          // For market listings, we don't have exact coordinates
          // So we'll place them randomly within the search radius
          const angle = (idx / marketListings.length) * 2 * Math.PI;
          const distance = 500 + Math.random() * 500;
          const lat = center[0] + (distance / 111000) * Math.cos(angle);
          const lng = center[1] + (distance / (111000 * Math.cos(center[0] * Math.PI / 180))) * Math.sin(angle);
          
          return (
            <Marker
              key={`market-${idx}`}
              position={[lat, lng]}
              icon={marketIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold text-green-600 mb-1">Annonce Active</div>
                  <div className="text-xs text-gray-600 mb-2">{listing.title}</div>
                  <div className="space-y-1">
                    <div><strong>Prix:</strong> {listing.price.toLocaleString()} €</div>
                    <div><strong>Surface:</strong> {listing.surface} m²</div>
                    <div><strong>Prix/m²:</strong> {listing.pricePerM2.toLocaleString()} €</div>
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Voir l'annonce →
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}