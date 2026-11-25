import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import { getDeliveries } from '../../api/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const FARM_LOCATION = { lat: 9.9886, lng: 124.3442 }; // Corazon, San Miguel, Bohol
const FARM_NAME = '🥚 EggTrack Farm — Corazon, San Miguel, Bohol';

const farmIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// Helper: Fly to location
const FlyToMarker = ({ position }: { position: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 17, { duration: 1.5 }); 
  }, [position, map]);
  return null;
};

// Helper: Routing Machine (Actual Road Route)
const RoutingMachine = ({ from, to }: { from: [number, number]; to: [number, number] | null }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!to) return;

    // @ts-ignore
    const routingControl = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: true,
      lineOptions: { styles: [{ color: '#3b82f6', weight: 5, opacity: 0.8 }] },
      createMarker: () => null,
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
    }).addTo(map);

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, from, to]);

  return null;
};

const AdminMapTracker = () => {
  const [searchParams] = useSearchParams();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string>('');
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');

  useEffect(() => {
    loadDeliveries();
    const orderParam = searchParams.get('order');
    if (orderParam) setFocusOrderId(orderParam);
  }, [searchParams]);

  useEffect(() => {
    if (focusOrderId && deliveries.length > 0) {
      const target = deliveries.find(d => d.order?.toString() === focusOrderId || d.order_number === focusOrderId);
      if (target && target.buyer_lat && target.buyer_lng) {
        setFlyTo([target.buyer_lat, target.buyer_lng]);
        setSelected(target);
      }
    }
  }, [deliveries, focusOrderId]);

  const loadDeliveries = async () => {
    try {
      const res = await getDeliveries();
      const withCoords = res.data.filter((d: any) => d.buyer_lat && d.buyer_lng);
      setDeliveries(withCoords);
    } catch (error) {
      toast.error('Failed to load deliveries');
    }
  };

  const geocodeAllBuyers = async () => {
    try {
      const res = await axios.post('http://${window.location.hostname}:8000/api/buyers/geocode_all/');
      toast.success(`✅ Geocoded ${res.data.geocoded} buyers`);
      loadDeliveries();
    } catch {
      toast.error('Failed to geocode');
    }
  };

  const getDirectionsUrl = (lat: number, lng: number) => 
    `https://www.google.com/maps/dir/?api=1&origin=${FARM_LOCATION.lat},${FARM_LOCATION.lng}&destination=${lat},${lng}&travelmode=driving`;

  const getStreetViewUrl = (lat: number, lng: number) => 
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">🗺️ Delivery Map Tracker</h1>
        <div className="flex gap-2">
          <button onClick={geocodeAllBuyers} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">🌍 Geocode All</button>
          <button onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')} className="bg-gray-700 text-white px-4 py-2 rounded-lg">
            {mapType === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Section */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-[500px] lg:h-[600px]">
          <MapContainer center={[FARM_LOCATION.lat, FARM_LOCATION.lng]} zoom={12} style={{ height: '100%', width: '100%' }}>
            {mapType === 'satellite' ? (
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution='&copy; Google Maps Satellite' />
            ) : (
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            )}
            
            <FlyToMarker position={flyTo} />
            
            <Marker position={[FARM_LOCATION.lat, FARM_LOCATION.lng]} icon={farmIcon}>
              <Popup><strong>{FARM_NAME}</strong></Popup>
            </Marker>

            {deliveries.map((d) => (
              <Marker
                key={d.id}
                position={[d.buyer_lat, d.buyer_lng]}
                icon={deliveryIcon}
                eventHandlers={{ click: () => { setSelected(d); setFlyTo([d.buyer_lat, d.buyer_lng]); } }}
              >
                <Popup>
                  <div className="text-center">
                    <strong className="block mb-1">{d.order_number || `#${d.order}`}</strong>
                    <p className="text-xs mb-2">👤 {d.order_buyer}</p>
                    
                    {/* Street View Button */}
                    <a
                      href={getStreetViewUrl(d.buyer_lat, d.buyer_lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full bg-gray-700 text-white text-xs py-1 px-2 rounded hover:bg-gray-800 mb-1"
                    >
                      📍 Street View
                    </a>
                    
                    {/* Directions Button */}
                    <a
                      href={getDirectionsUrl(d.buyer_lat, d.buyer_lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full bg-blue-600 text-white text-xs py-1 px-2 rounded hover:bg-blue-700"
                    >
                      🚗 Directions
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}

            {selected && selected.buyer_lat && selected.buyer_lng && (
              <RoutingMachine from={[FARM_LOCATION.lat, FARM_LOCATION.lng]} to={[selected.buyer_lat, selected.buyer_lng]} />
            )}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 max-h-[600px] overflow-y-auto">
          <h2 className="font-bold text-lg mb-3 dark:text-white">📦 Deliveries ({deliveries.length})</h2>
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div
                key={d.id}
                onClick={() => { setSelected(d); setFlyTo([d.buyer_lat, d.buyer_lng]); }}
                className={`p-3 rounded border-l-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selected?.id === d.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'border-yellow-500'
                }`}
              >
                <p className="font-bold text-sm dark:text-white">{d.order_number || `#${d.order}`}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">👤 {d.order_buyer}</p>
                <p className="text-xs text-gray-500 truncate dark:text-gray-400">📍 {d.order_address}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions for Selected Delivery */}
          {selected && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
              <h3 className="font-bold text-sm mb-2 dark:text-white">Quick Actions</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">📍 {selected.order_address}</p>
              
              <a
                href={getDirectionsUrl(selected.buyer_lat, selected.buyer_lng)}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                🚗 Get Directions
              </a>
              
              <a
                href={getStreetViewUrl(selected.buyer_lat, selected.buyer_lng)}
                target="_blank"
                rel="noreferrer"
                className="block text-center bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition text-sm font-medium"
              >
                📍 View Street View
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMapTracker;