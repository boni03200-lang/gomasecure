
import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { MapView } from './components/MapView';
import { IncidentCard } from './components/IncidentCard';
import { IncidentForm } from './components/IncidentForm';
import { PanicButton } from './components/PanicButton';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthView } from './components/AuthView';
import { NotificationPanel } from './components/NotificationPanel';
import { UserProfile } from './components/UserProfile';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { db, supabase } from './services/supabase'; 
import { User, Incident, TabView, UserRole, IncidentType, IncidentStatus, Notification } from './types';
import { GOMA_CENTER, SOS_MESSAGE_TEMPLATE, INCIDENT_VISIBILITY_RADIUS } from './constants';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  const icon = type === 'success' ? <CheckCircle className="w-5 h-5" /> : type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[3000] ${bg} text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 animate-in slide-in-from-top-4 duration-300 min-w-[200px] justify-center`}>
      {icon}
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
};

const isAbortError = (e: any) => {
    const msg = e instanceof Error ? e.message : (typeof e === 'string' ? e : '');
    return e?.name === 'AbortError' || msg.includes('aborted') || msg.includes('signal is aborted');
};

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d;
}

const AppContent = () => {
  const { setLanguage, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('MAP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, accuracy?: number} | null>(null);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
  };

  // --- DATA FILTERING LOGIC ---
  const publicIncidents = useMemo(() => {
    if (!user) return [];

    if (user.role === UserRole.ADMINISTRATEUR) {
        return incidents;
    }

    return incidents.filter(inc => {
        // Only show incidents resolved or validated, OR created by me
        // OR pending incidents nearby
        if (inc.status === IncidentStatus.REJETE && inc.reporterId !== user.uid) return false;
        
        // Always show own reports
        if (inc.reporterId === user.uid) return true;

        if (!userLocation) return false;

        const dist = getDistanceFromLatLonInM(
            userLocation.lat, userLocation.lng,
            inc.location.lat, inc.location.lng
        );

        // Show broadly (5km) for situational awareness, 
        // BUT interaction will be limited by INCIDENT_VISIBILITY_RADIUS in the Card component
        return dist <= 5000; 
    });
  }, [incidents, user, userLocation]);

  useEffect(() => {
    const initData = async () => {
      try {
        const incs = await db.getIncidents();
        setIncidents(incs);
        const usrs = await db.getAllUsers();
        setUsers(usrs);
      } catch (e: any) {
        if (!isAbortError(e)) {
           console.error("Error loading initial data", e);
        }
      }
    };

    let watchId: number;
    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
          (pos) => {
             setUserLocation({ 
                 lat: pos.coords.latitude, 
                 lng: pos.coords.longitude,
                 accuracy: pos.coords.accuracy
             });
          },
          (err) => {
             console.warn("GPS failed", err);
          },
          { 
             enableHighAccuracy: true, 
             timeout: 10000, 
             maximumAge: 0 
          }
       );
    } else {
        setUserLocation(GOMA_CENTER);
    }

    initData();

    return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
      const channel = supabase.channel('realtime_updates')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'incidents' }, 
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newInc = db.parseIncident(payload.new);
                    setIncidents(prev => {
                        if (prev.some(i => i.id === newInc.id)) return prev;
                        const newList = [newInc, ...prev];
                        return newList.sort((a, b) => b.timestamp - a.timestamp);
                    });
                    
                    if ((newInc.type === IncidentType.SOS || newInc.type === IncidentType.AGRESSION) && user?.role === UserRole.ADMINISTRATEUR) {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        audio.play().catch(e => console.log('Audio autoplay blocked'));
                        showToast(`ALERTE: NOUVEAU ${newInc.type} DÉTECTÉ`, 'error');
                    } else if (user?.role === UserRole.ADMINISTRATEUR) {
                        showToast(`Nouveau signalement: ${newInc.type}`, 'info');
                    }

                } else if (payload.eventType === 'UPDATE') {
                    const updatedInc = db.parseIncident(payload.new);
                    setIncidents(prev => {
                        const list = prev.map(i => i.id === updatedInc.id ? updatedInc : i);
                        return list.sort((a, b) => b.timestamp - a.timestamp);
                    });
                } else if (payload.eventType === 'DELETE') {
                    setIncidents(prev => prev.filter(i => i.id !== payload.old.id));
                }
            }
        )
        .subscribe();

      return () => {
          supabase.removeChannel(channel).catch(() => {});
      };
  }, [user]);

  useEffect(() => {
      if (!user) return;
      let isMounted = true;
      const fetchNotifs = async () => {
          try {
              const notifs = await db.getNotifications(user.uid);
              if (isMounted) {
                  setNotifications(notifs.sort((a, b) => b.timestamp - a.timestamp));
              }
          } catch (error: any) {
              if (!isAbortError(error)) {
                  console.error("Notification polling error:", error);
              }
          }
      };
      fetchNotifs();
      const notifChannel = supabase.channel(`notifications:${user.uid}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.uid}` },
            (payload) => {
                fetchNotifs();
                showToast(payload.new.title || 'Nouvelle Notification', 'info');
            }
        )
        .subscribe();
      const interval = setInterval(fetchNotifs, 10000);
      return () => {
          isMounted = false;
          clearInterval(interval);
          supabase.removeChannel(notifChannel).catch(() => {});
      };
  }, [user]);

  const handleCreateIncident = async (data: { type: IncidentType, description: string, media?: File }) => {
    if (!user) return;
    
    if (!userLocation) {
        showToast("Acquisition GPS en cours... Veuillez patienter.", "error");
        return;
    }

    if (userLocation.accuracy && userLocation.accuracy > 100) {
        showToast(`Signal GPS trop faible (±${Math.round(userLocation.accuracy)}m). Déplacez-vous à ciel ouvert.`, 'error');
        return;
    }

    setIsSubmitting(true);
    
    // Improved Media Type Detection
    let mediaType: 'image' | 'video' | 'audio' = 'image';
    if (data.media) {
        const file = data.media;
        if (file.type.startsWith('video')) {
            mediaType = 'video';
        } else if (file.type.startsWith('audio')) {
            mediaType = 'audio';
        } else if (file.type.startsWith('image')) {
            mediaType = 'image';
        } else {
            // Fallback: Check extension if MIME type is generic/missing
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['mp4', 'mov', 'webm', 'ogg', 'avi', 'mkv', '3gp'].includes(ext || '')) {
                mediaType = 'video';
            } else if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext || '')) {
                mediaType = 'audio';
            }
        }
    }

    try {
      let finalMediaUrl: string | undefined = undefined;
      if (data.media) {
          showToast("Téléchargement du média...", "info");
          const uploadedUrl = await db.uploadMedia(data.media);
          if (uploadedUrl) {
              finalMediaUrl = uploadedUrl;
          } else {
              showToast("Echec upload média.", "error");
              finalMediaUrl = undefined;
          }
      }

      const resultIncident = await db.createIncident({
        ...data,
        location: userLocation,
        mediaUrl: finalMediaUrl, 
        mediaType: mediaType
      }, user);

      setIncidents(prev => {
          const list = [resultIncident, ...prev];
          return list.sort((a, b) => b.timestamp - a.timestamp);
      });

      setIsSubmitting(false);
      setActiveTab('LIST');
      showToast('Incident signalé avec succès', 'success');
    } catch (e: any) {
      if (!isAbortError(e)) {
          showToast("Erreur lors de l'envoi", 'error');
      }
      setIsSubmitting(false);
    }
  };

  const handleVote = async (id: string, type: 'like' | 'dislike') => {
    if (!user) return;

    const incident = incidents.find(i => i.id === id);
    if (incident && userLocation) {
        const dist = getDistanceFromLatLonInM(userLocation.lat, userLocation.lng, incident.location.lat, incident.location.lng);
        const maxRadius = INCIDENT_VISIBILITY_RADIUS[incident.type] || 200;
        
        if (dist > maxRadius) {
            showToast(`Trop loin ! (Rayon max: ${maxRadius}m)`, 'error');
            return;
        }
    }

    try {
      const updated = await db.voteIncident(id, user.uid, type);
      setIncidents(prev => prev.map(i => i.id === id ? updated : i));
      showToast('Vote enregistré', 'success');
    } catch (e: any) {
      if (!isAbortError(e)) {
          showToast('Erreur lors du vote', 'error');
      }
    }
  };

  const handleSOS = async () => {
    if (!userLocation) {
        showToast("GPS requis pour SOS", "error");
        return;
    }
    await handleCreateIncident({
        type: IncidentType.SOS,
        description: SOS_MESSAGE_TEMPLATE
    });
  };

  const renderContent = () => {
    if (!user) {
        return <AuthView onLogin={setUser} showToast={showToast} />;
    }

    if (user.role === UserRole.ADMINISTRATEUR) {
        return (
            <AdminDashboard 
                user={user} 
                incidents={incidents} 
                onLogout={() => setUser(null)} 
                onUpdateStatus={async (id, status) => {
                    await db.updateIncidentStatus(id, status, user.uid);
                    showToast('Statut mis à jour', 'success');
                }}
                notifications={notifications}
            />
        );
    }

    if (activeTab === 'SOS') {
        return <PanicButton onTrigger={handleSOS} />;
    }

    return (
        <Layout 
           activeTab={activeTab} 
           onTabChange={setActiveTab} 
           userRole={user.role} 
           unreadCount={notifications.filter(n => !n.read).length}
           onNotificationClick={() => setIsNotificationPanelOpen(true)}
        >
          {activeTab === 'MAP' && (
            <div className="h-full relative">
                <MapView 
                  incidents={publicIncidents} 
                  currentUser={user}
                  onIncidentClick={(inc) => {
                      setSelectedIncidentId(inc.id);
                      setActiveTab('LIST');
                  }}
                  onMapClick={() => setSelectedIncidentId(null)}
                  userLocation={userLocation}
                  highlightedId={selectedIncidentId}
                />
            </div>
          )}

          {activeTab === 'LIST' && (
             <div className="h-full bg-gray-50 overflow-y-auto px-4 py-4 space-y-4">
                 <h2 className="text-xl font-black text-gray-900 mb-2 px-2">Fil d'actualité</h2>
                 {publicIncidents.map(inc => (
                    <IncidentCard 
                        key={inc.id} 
                        incident={inc} 
                        currentUser={user} 
                        onVote={handleVote} 
                        onValidate={async (id, isValid) => {
                           const status = isValid ? IncidentStatus.VALIDE : IncidentStatus.REJETE;
                           await db.updateIncidentStatus(id, status, user.uid);
                        }}
                        distance={userLocation ? getDistanceFromLatLonInM(userLocation.lat, userLocation.lng, inc.location.lat, inc.location.lng) : undefined}
                        domId={inc.id === selectedIncidentId ? `incident-${inc.id}` : undefined}
                        className={inc.id === selectedIncidentId ? 'ring-2 ring-blue-500' : ''}
                    />
                 ))}
                 {publicIncidents.length === 0 && (
                     <div className="text-center py-20 text-gray-400">
                         <p>Aucun incident à proximité.</p>
                     </div>
                 )}
             </div>
          )}

          {activeTab === 'REPORT' && (
            <IncidentForm 
                onSubmit={handleCreateIncident} 
                onCancel={() => setActiveTab('MAP')} 
                isSubmitting={isSubmitting}
                userLocation={userLocation}
            />
          )}

          {activeTab === 'PROFILE' && (
             <UserProfile 
                user={user} 
                incidents={incidents} 
                onLogout={() => setUser(null)}
                onLanguageChange={() => setLanguage(language === 'fr' ? 'sw' : 'fr')}
                onToggleNotifications={() => {}}
             />
          )}

          {selectedIncidentId && activeTab === 'LIST' && (() => {
               setTimeout(() => {
                   const el = document.getElementById(`incident-${selectedIncidentId}`);
                   if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
               }, 100);
               return null;
          })()}

          <NotificationPanel 
             isOpen={isNotificationPanelOpen}
             onClose={() => setIsNotificationPanelOpen(false)}
             notifications={notifications}
             onMarkRead={(id) => db.markNotificationRead(id)}
             onMarkAllRead={() => {
                 notifications.forEach(n => !n.read && db.markNotificationRead(n.id));
                 setNotifications(prev => prev.map(n => ({ ...n, read: true })));
             }}
             onNavigate={(id) => {
                 setSelectedIncidentId(id);
                 setActiveTab('LIST');
                 setIsNotificationPanelOpen(false);
             }}
             onPromotionResponse={async (notifId, accept) => {
                 if (accept) {
                     await db.updateUserRole(user.uid, UserRole.SENTINELLE);
                     setUser(prev => prev ? ({ ...prev, role: UserRole.SENTINELLE }) : null);
                     showToast("Félicitations! Vous êtes maintenant Sentinelle.", "success");
                 }
                 await db.markNotificationRead(notifId);
             }}
          />
        </Layout>
    );
  };

  return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {renderContent()}
      </>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
