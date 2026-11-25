import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { getPendingDeliveries, getDeliveries } from '../api/api';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';
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
const FARM_NAME = '🥚 EggTrack Farm';

const farmIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const buyerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// Helper: Fly to Location
const FlyToLocation = ({ position }: { position: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 17, { duration: 1.5 });
  }, [position, map]);
  return null;
};

// Helper: Routing Machine
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

const Delivery = () => {
  const [pending, setPending] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    try {
      const pendingRes = await getPendingDeliveries();
      setPending(pendingRes.data);
      const allRes = await getDeliveries();
      setCompleted(allRes.data.filter((d: any) => d.status === 'DELIVERED').slice(0, 20));
    } catch (error) {
      console.error('Error loading deliveries:', error);
    }
  };

  const openDeliverModal = (delivery: any) => {
    setSelectedDelivery(delivery);
    setPhoto(null);
    setShowModal(true);
    setTimeout(() => sigCanvas.current?.clear(), 100);
  };

  const handleMarkDelivered = async () => {
    if (!selectedDelivery) return;
    const formData = new FormData();
    if (photo) formData.append('photo_proof', photo);
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      formData.append('signature_data', sigCanvas.current.toDataURL('image/png'));
    }
    const token = localStorage.getItem('access_token');
    try {
      await axios.post(
        `http://${window.location.hostname}:8000/api/deliveries/${selectedDelivery.id}/mark_delivered/`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` } }
      );
      toast.success('✅ Delivery completed!');
      setShowModal(false);
      loadDeliveries();
    } catch (error) {
      toast.error('❌ Failed to mark as delivered');
    }
  };

  const handleMarkFailed = async () => {
    if (!failureReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      await axios.post(
        `http://${window.location.hostname}:8000/api/deliveries/${selectedDelivery.id}/mark_failed/`,
        { failure_reason: failureReason }
      );
      toast.success('Delivery marked as failed');
      setShowFailModal(false);
      setShowModal(false);
      setFailureReason('');
      loadDeliveries();
    } catch (error) {
      toast.error('❌ Failed to update');
    }
  };

  const routeTo = selectedDelivery?.buyer_lat && selectedDelivery?.buyer_lng
    ? [selectedDelivery.buyer_lat, selectedDelivery.buyer_lng] as [number, number]
    : null;

  const getDirectionsUrl = (lat: number, lng: number) => 
    `https://www.google.com/maps/dir/?api=1&origin=${FARM_LOCATION.lat},${FARM_LOCATION.lng}&destination=${lat},${lng}&travelmode=driving`;

  const getStreetViewUrl = (lat: number, lng: number) => 
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="space-y-6">
      {/* MAP SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl lg:text-2xl font-bold dark:text-white">🗺️ Delivery Route Map</h2>
          <button 
            onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')} 
            className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            {mapType === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
          </button>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Click a pending delivery to see the exact road route and location.
        </p>

        <div className="h-[450px] rounded-lg overflow-hidden border dark:border-gray-700 relative z-0">
          <MapContainer center={[FARM_LOCATION.lat, FARM_LOCATION.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
            {mapType === 'satellite' ? (
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution='&copy; Google Satellite' />
            ) : (
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            )}
            
            <FlyToLocation position={flyTo} />
            
            <Marker position={[FARM_LOCATION.lat, FARM_LOCATION.lng]} icon={farmIcon}>
              <Popup><strong>{FARM_NAME}</strong></Popup>
            </Marker>

            {pending.map((d) => {
              if (!d.buyer_lat || !d.buyer_lng) return null;
              return (
                <Marker key={d.id} position={[d.buyer_lat, d.buyer_lng]} icon={buyerIcon}>
                  <Popup>
                    <div className="text-center">
                      <strong className="block mb-1">{d.order_number || `#${d.order}`}</strong>
                      <p className="text-xs mb-2">👤 {d.order_buyer}</p>
                      <a
                        href={getStreetViewUrl(d.buyer_lat, d.buyer_lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full bg-gray-700 text-white text-xs py-1 px-2 rounded hover:bg-gray-800 mb-1"
                      >
                        📍 Street View
                      </a>
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
              );
            })}

            {routeTo && <RoutingMachine from={[FARM_LOCATION.lat, FARM_LOCATION.lng]} to={routeTo} />}
          </MapContainer>
        </div>

        {/* Quick Actions for Selected Delivery */}
        {selectedDelivery && (
          <div className="mt-4 flex gap-2">
            <a
              href={getDirectionsUrl(selectedDelivery.buyer_lat, selectedDelivery.buyer_lng)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition"
            >
              🚗 Open Route in Google Maps
            </a>
            <a
              href={getStreetViewUrl(selectedDelivery.buyer_lat, selectedDelivery.buyer_lng)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 font-medium transition"
            >
              📍 Street View
            </a>
          </div>
        )}
      </div>

      {/* LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
          <h2 className="text-xl lg:text-2xl font-bold mb-4 dark:text-white">🚚 Pending Deliveries</h2>
          {pending.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">🎉 No pending deliveries!</p>
          ) : (
            <div className="space-y-3">
              {pending.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setSelectedDelivery(d);
                    if (d.buyer_lat && d.buyer_lng) setFlyTo([d.buyer_lat, d.buyer_lng]);
                  }}
                  className={`border-l-4 border-yellow-400 bg-gray-50 dark:bg-gray-700 p-4 rounded cursor-pointer hover:bg-yellow-50 dark:hover:bg-gray-600 transition ${
                    selectedDelivery?.id === d.id ? 'ring-2 ring-yellow-500' : ''
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
                    <div className="flex-1">
                      <p className="font-bold dark:text-white">{d.order_number || `#${d.order}`}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">👤 {d.order_buyer}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">📍 {d.order_address}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">📞 {d.order_phone}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">📦 {d.order_quantity} {d.is_tray ? 'trays' : 'pcs'}</p>
                      
                      {/* Small quick links inside card */}
                      {d.buyer_lat && d.buyer_lng && (
                        <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <a href={getDirectionsUrl(d.buyer_lat, d.buyer_lng)} target="_blank" rel="noreferrer" className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                            🚗 Navigate
                          </a>
                          <a href={getStreetViewUrl(d.buyer_lat, d.buyer_lng)} target="_blank" rel="noreferrer" className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300">
                            📍 Street View
                          </a>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeliverModal(d);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm whitespace-nowrap"
                    >
                      ✅ Deliver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
          <h2 className="text-xl lg:text-2xl font-bold mb-4 dark:text-white">✅ Completed Deliveries</h2>
          {completed.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No completed deliveries yet</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {completed.map((d) => (
                <div key={d.id} className="border-l-4 border-green-400 bg-gray-50 dark:bg-gray-700 p-4 rounded">
                  <p className="font-bold dark:text-white">{d.order_number || `#${d.order}`}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">👤 {d.order_buyer}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Delivered: {d.delivered_at ? new Date(d.delivered_at).toLocaleString() : 'N/A'}
                  </p>
                  {d.photo_proof && (
                    <img src={d.photo_proof} alt="Proof" className="mt-2 w-24 h-24 object-cover rounded" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DELIVER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div>
                <h3 className="text-lg font-bold dark:text-white">Complete Delivery</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedDelivery?.order_number || `Order #${selectedDelivery?.order}`} · {selectedDelivery?.order_buyer}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 text-2xl leading-none">
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 dark:text-white">📸 Photo Proof</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="w-full text-sm dark:text-gray-300 border rounded p-2 dark:border-gray-600 dark:bg-gray-700"
                />
                {photo && (
                  <img src={URL.createObjectURL(photo)} alt="Preview" className="mt-2 w-full h-40 object-cover rounded border" />
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 dark:text-white">✍️ Buyer Signature</label>
                <div className="border-2 border-gray-300 dark:border-gray-600 rounded bg-white overflow-hidden">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-32' }}
                  />
                </div>
                <button
                  onClick={() => sigCanvas.current?.clear()}
                  className="mt-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Clear signature
                </button>
              </div>
            </div>

            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-2">
              <button onClick={handleMarkDelivered} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-medium">
                ✅ Confirm Delivery
              </button>
              <button onClick={() => setShowFailModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium">
                ❌ Failed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAIL MODAL */}
      {showFailModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4 text-red-600">Delivery Failed</h3>
            <label className="block text-sm font-medium mb-2 dark:text-white">Reason</label>
            <textarea
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-red-500"
              placeholder="e.g., Buyer not available, wrong address..."
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleMarkFailed} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium">
                Confirm Failed
              </button>
              <button onClick={() => setShowFailModal(false)} className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Delivery;