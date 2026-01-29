import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Incident, IncidentStatus, User, IncidentType } from '../types';
import { Layers, Navigation, Crosshair, Map as MapIcon, Clock, ThumbsUp, ArrowRight, FileAudio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

// Fix for default Leaflet marker icons in React
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const isValidLatLng = (lat: any, lng: any): boolean => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  return !Number.isNaN(latNum) && !Number.isNaN(lngNum) && Number.isFinite(latNum) && Number.isFinite(lngNum);
};

const getSafePosition = (location: { lat: any; lng: any } | null | undefined): { lat: number; lng: number } | null => {
  if (!location || !isValidLatLng(location.lat, location.lng)) return null;
  return { lat: Number(location.lat), lng: Number(location.lng) };
};

const getSvgIcon = (type: IncidentType, color: string, isSelected: boolean) => {
  const paths: Record<string, string> = {
    [IncidentType.VOL]: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />',
    [IncidentType.AGRESSION]: '<circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><path d="M8 20v2h8v-2" /><path d="M12.5 17l-2.5-3-2.5 3" /><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />',
    [IncidentType.INCENDIE]: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.246-3.246-3-4.5 1.7 1.34 2.86 2.56 3.5 3.5.83 1.22 1.35 2.38 1.5 3.5" /><path d="M16 11.5a3.5 3.5 0 0 0-3-3c-1.38 0-2.3.92-3.14 2.14C9.06 12.1 8.5 13.5 8.5 15c0 2.2 1.79 4 4 4s4-1.79 4-4c0-1.34-.35-2.61-.95-3.5Z" />',
    [IncidentType.ACCIDENT]: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />',
    [IncidentType.ENLEVEMENT]: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" />',
    [IncidentType.SOS]: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />',
    [IncidentType.AUTRE]: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
  };

  const path = paths[type] || paths[IncidentType.AUTRE];
  const bg = isSelected ? '#111827' : 'white';
  const stroke = isSelected ? 'white' : color;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="background: ${bg}; border-radius: 50%; padding: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); width: 100%; height: 100%; border: 2px solid ${color};">
      ${path}
    </svg>
  `;
};

const getMarkerIcon = (status: IncidentStatus, type: IncidentType, isSelected: boolean) => {
  const size = isSelected ? 64 : 44;
  const iconSize: [number, number] = [size, size];
  const anchor: [number, number] = [size / 2, size / 2];

  if (type === IncidentType.SOS) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: #ef4444; width: ${size + 8}px; height: ${size + 8}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 0 20px rgba(239, 68, 68, 0.6); animation: ping 1s infinite;">
               <svg xmlns="http://www.w3.org/2000/svg" width="${size - 12}" height="${size - 12}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
             </div>`,
      iconSize: [size + 8, size + 8],
      iconAnchor: [size / 2 + 4, size / 2 + 4]
    });
  }

  let color = '#3b82f6';
  if (status === IncidentStatus.VALIDE) color = '#22c55e';
  if (status === IncidentStatus.REJETE) color = '#ef4444';
  if (status === IncidentStatus.EN_ATTENTE) color = '#f97316';

  return L.divIcon({
    className: `custom-svg-marker ${isSelected ? 'z-[1000]' : ''}`,
    html: `<div style="width: ${size}px; height: ${size}px; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: ${isSelected ? 'scale(1.1) translateY(-10px)' : 'scale(1)'}">
            ${getSvgIcon(type, color, isSelected)}
            ${isSelected ? `<div style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${color};"></div>` : ''}
           </div>`,
    iconSize: iconSize,
    iconAnchor: anchor,
  });
};

interface MapViewProps {
  incidents: Incident[];
  currentUser: User | null;
  onIncidentClick: (incident: Incident) => void;
  onMarkerClick?: (incident: Incident) => void;
  onMapClick?: () => void;
  userLocation: { lat: number, lng: number, accuracy?: number } | null;
  highlightedId?: string | null;
  selectedId?: string | null;
}

const LocationMarker = ({ position, accuracy }: { position: { lat: number, lng: number }, accuracy?: number }) => {
  const safePos = getSafePosition(position);
  if (!safePos) return null;

  return (
    <>
      <Marker 
        position={safePos} 
        icon={L.divIcon({
          className: 'user-location-pulse-container',
          html: `<div class="user-location-pulse"></div>
                 <div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })}
        zIndexOffset={-100}
      />
      {accuracy && accuracy < 2000 && (
         <Circle 
            center={safePos} 
            radius={accuracy} 
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1, opacity: 0.5 }} 
         />
      )}
    </>
  );
};

const MapController = ({ highlightedId, incidents, centerOnUser, userLocation }: { highlightedId?: string | null, incidents: Incident[], centerOnUser: number, userLocation: { lat: number, lng: number } | null }) => {
  const map = useMap();
  
  // Handle Highlight Incident
  useEffect(() => {
    if (highlightedId) {
      const target = incidents.find(i => i.id === highlightedId);
      const safePos = getSafePosition(target?.location);
      if (safePos) {
        map.flyTo(safePos, 17, { animate: true, duration: 1.2, easeLinearity: 0.5 });
      }
    }
  }, [highlightedId, incidents, map]);

  // Handle User Centering
  useEffect(() => {
    if (centerOnUser > 0 && userLocation) {
       map.flyTo(userLocation, 16, { animate: true, duration: 0.8 });
    }
  }, [centerOnUser, userLocation, map]);

  return null;
};

const MapClickHandler = ({ onMapClick }: { onMapClick?: () => void }) => {
  useMapEvents({ click: () => onMapClick && onMapClick() });
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ 
  incidents, 
  onIncidentClick,
  onMarkerClick,
  onMapClick,
  userLocation, 
  highlightedId,
  selectedId 
}) => {
  const { t } = useLanguage();
  const defaultCenter = { lat: -1.6585, lng: 29.2205 };
  const [mapType, setMapType] = useState<'STREET' | 'SATELLITE'>('STREET');
  const [centerTrigger, setCenterTrigger] = useState(0);
  const markerRefs = useRef<{[key: string]: L.Marker | null}>({});

  const validIncidents = useMemo(() => {
    return incidents.filter(incident => !!getSafePosition(incident.location));
  }, [incidents]);

  // Handle auto-opening popup for selectedId
  // Include incidents in deps to re-open popup if marker re-renders due to status change
  useEffect(() => {
    if (selectedId && markerRefs.current[selectedId] && !onMarkerClick) {
      markerRefs.current[selectedId]?.openPopup();
    }
  }, [selectedId, incidents, onMarkerClick]);

  // Styles de cartes professionnels
  const tiles = {
    STREET: {
       url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
       attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    SATELLITE: {
       url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
       attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  };

  return (
    <div className="h-full w-full relative z-0 bg-gray-100 overflow-hidden">
      <style>
        {`
          @keyframes ping {
            75%, 100% {
              transform: scale(1.5);
              opacity: 0;
            }
          }
          /* Custom Leaflet Popup Styles */
          .leaflet-popup-content-wrapper {
            border-radius: 16px;
            padding: 0;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          }
          .leaflet-popup-content {
            margin: 0;
            width: 260px !important;
          }
          .leaflet-popup-tip-container {
            width: 20px;
            height: 10px;
          }
        `}
      </style>
      
      {/* Floating Controls - Mobile Optimized Position */}
      <div className="absolute top-[calc(4rem+env(safe-area-inset-top))] right-4 z-[400] flex flex-col space-y-3">
         
         {/* Map Layer Toggle */}
         <button 
            onClick={() => setMapType(prev => prev === 'STREET' ? 'SATELLITE' : 'STREET')}
            className="w-12 h-12 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/50 flex items-center justify-center text-gray-700 active:scale-95 transition-all"
         >
            {mapType === 'STREET' ? <Layers className="w-6 h-6" /> : <MapIcon className="w-6 h-6" />}
         </button>

         {/* Recenter GPS */}
         <button 
            onClick={() => setCenterTrigger(c => c + 1)}
            className={`w-12 h-12 rounded-2xl shadow-lg border flex items-center justify-center active:scale-95 transition-all ${userLocation ? 'bg-blue-600 text-white border-blue-500 shadow-blue-200' : 'bg-white/90 text-gray-400 border-white/50'}`}
         >
            {userLocation ? <Navigation className="w-6 h-6" /> : <Crosshair className="w-6 h-6 animate-pulse" />}
         </button>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={14} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution={tiles[mapType].attribution}
          url={tiles[mapType].url}
          maxZoom={19}
        />
        
        <MapController 
           highlightedId={highlightedId} 
           incidents={validIncidents} 
           centerOnUser={centerTrigger}
           userLocation={userLocation}
        />
        
        <MapClickHandler onMapClick={onMapClick} />
        
        {userLocation && <LocationMarker position={userLocation} accuracy={userLocation.accuracy} />}
        
        {validIncidents.map((incident) => {
          const safePos = getSafePosition(incident.location);
          if (!safePos) return null;
          return (
            <Marker 
              key={`${incident.id}_${incident.status}_${incident.type}`} 
              ref={(ref) => { markerRefs.current[incident.id] = ref; }}
              position={safePos}
              icon={getMarkerIcon(incident.status, incident.type, incident.id === selectedId)}
              eventHandlers={{
                click: (e) => {
                  // STOP PROPAGATION TO MAP (Prevents map click handler from firing and deselecting)
                  if (e.originalEvent) {
                      e.originalEvent.stopPropagation();
                      // REMOVED preventDefault to allow standard popup behavior
                  }

                  // If onMarkerClick is provided (special mode), trigger it and prevent/close popup
                  if (onMarkerClick) {
                      onMarkerClick(incident);
                      e.target.closePopup();
                  }
                },
              }}
              zIndexOffset={incident.id === selectedId ? 1000 : 0}
            >
              <Popup closeButton={false} offset={[0, -20]}>
                <div className="flex flex-col">
                   <div className="relative h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
                      {incident.mediaUrl ? (
                         incident.mediaType === 'video' ? 
                            <video src={incident.mediaUrl} className="w-full h-full object-cover" /> :
                         incident.mediaType === 'audio' ?
                            <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50 p-2">
                                <FileAudio className="w-8 h-8 text-blue-500 mb-1" />
                                <span className="text-[10px] text-blue-400 font-bold uppercase">Note Vocale</span>
                            </div> :
                            <img src={incident.mediaUrl} className="w-full h-full object-cover" alt="Preuve" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                           <div 
                              className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: getSvgIcon(incident.type, '#9ca3af', false) }}
                           />
                         </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur text-white text-[10px] font-bold rounded-full uppercase">
                         {t(incident.status)}
                      </div>
                   </div>
                   <div className="p-3">
                      <div className="flex justify-between items-start mb-1">
                         <h3 className="font-bold text-gray-900 text-sm">{t(incident.type)}</h3>
                         <span className="text-[10px] text-gray-500 flex items-center bg-gray-100 px-1.5 py-0.5 rounded">
                           <Clock className="w-3 h-3 mr-1" />
                           {formatDistanceToNow(incident.timestamp, { locale: fr, addSuffix: true }).replace('environ ', '')}
                         </span>
                      </div>
                      <p className="text-gray-600 text-xs line-clamp-2 mb-3 leading-relaxed">
                        {incident.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-2 text-xs font-bold text-gray-500">
                             <div className="flex items-center"><ThumbsUp className="w-3 h-3 mr-1 text-green-500" /> {incident.likes.length}</div>
                         </div>
                         <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               onIncidentClick(incident); // Open full view
                            }}
                            className="text-blue-600 text-xs font-bold flex items-center hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                         >
                            Voir détails <ArrowRight className="w-3 h-3 ml-1" />
                         </button>
                      </div>
                   </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};