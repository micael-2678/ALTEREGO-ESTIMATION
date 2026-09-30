'use client'

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Marqueurs aux couleurs de la charte (pas d'images externes)
const pin = (color, size) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
    <path fill="${color}" stroke="#FBF8F3" stroke-width="1.2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.6" fill="#FBF8F3"/>
  </svg>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size],
  popupAnchor: [0, -size]
});

const dvfIcon = pin('#141413', 30);
const centerIcon = pin('#B94E33', 42);

const formatEuros = (value) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} €`;

export default function EstimationMap({ center, radius = 500, dvfSales = [] }) {
  return (
    <div className="h-80 sm:h-[28rem] w-full rounded-2xl overflow-hidden border border-ae-line isolate">
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Rayon de recherche réellement utilisé */}
        <Circle
          center={center}
          radius={radius}
          pathOptions={{ color: '#B94E33', weight: 1, fillColor: '#B94E33', fillOpacity: 0.05 }}
        />

        <Marker position={center} icon={centerIcon} zIndexOffset={1000}>
          <Popup>
            <strong>Votre bien</strong>
          </Popup>
        </Marker>

        {dvfSales.map((sale, idx) => (
          <Marker key={sale.id || `dvf-${idx}`} position={[sale.latitude, sale.longitude]} icon={dvfIcon}>
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-semibold">Vente DVF</div>
                <div className="text-xs text-ae-muted">{sale.address}</div>
                <div><strong>Prix :</strong> {formatEuros(sale.price)}</div>
                <div><strong>Surface :</strong> {sale.surface} m²</div>
                <div><strong>Prix/m² :</strong> {formatEuros(sale.pricePerM2)}</div>
                <div><strong>Date :</strong> {new Date(sale.date).toLocaleDateString('fr-FR')}</div>
                <div><strong>Distance :</strong> {sale.distance} m</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
