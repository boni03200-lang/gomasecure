import React, { useState, useEffect } from 'react';
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
import { db, supabase } from './services/supabase'; // Switched to Real Backend
import { User, Incident, TabView, UserRole, IncidentType, IncidentStatus, Notification } from './types';
import { GOMA_CENTER, SOS_MESSAGE_TEMPLATE } from './constants';
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

const AppContent = () => {
  const { setLanguage, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('MAP');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
  };

  // Initial Data Load
  useEffect(() => {
    const initData = async () => {
      try {
        const incs = await db.getIncidents();
        setIncidents(incs);

        const usrs = await db.getAllUsers();
        setUsers(usrs);
      } catch (e: any) {
        if (e.message !== 'signal is aborted without reason') {
           console.error("Error loading initial data", e);
        }
      }
    };

    // Geolocation with Watch for High Accuracy
    let watchId: number;
    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
          (pos) => {
             // Update location continuously for better accuracy
             setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
             console.warn("GPS failed, using default center", err);
             // Only set default if we don't have a location yet
             setUserLocation(prev => prev || GOMA_CENTER);
          },
          { 
             enableHighAccuracy: true, 
             timeout: 10000, 
             maximumAge: 0 // Force fresh location, no caching for realism
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

  // Real-time Subscriptions (Incidents & Notifications)
  useEffect(() => {
      const channel = supabase.channel('realtime_updates')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'incidents' }, 
            (payload) => {
                // For simplicity and consistency, refresh the full list on change
                // In a larger app, we would merge the payload (new/updated row) into state
                db.getIncidents().then(setIncidents);
            }
        )
        .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, []);

  // Poll Notifications (and fallback for data)
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
              if (error.message !== 'signal is aborted without reason' && error.name !== 'AbortError') {
                  console.error("Notification polling error:", error);
              }
          }
      };

      // Initial fetch
      fetchNotifs();
      
      // Also subscribe to notifications for this user
      const notifChannel = supabase.channel(`notifications:${user.uid}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.uid}` },
            (payload) => {
                // Fetch fresh notifications
                fetchNotifs();
                showToast(payload.new.title || 'Nouvelle Notification', 'info');
            }
        )
        .subscribe();

      const interval = setInterval(fetchNotifs, 10000); // Poll less frequently since we have realtime
      
      return () => {
          isMounted = false;
          clearInterval(interval);
          supabase.removeChannel(notifChannel);
      };
  }, [user]);

  const handleCreateIncident = async (data: { type: IncidentType, description: string, media?: File }) => {
    if (!user) return;
    setIsSubmitting(true);
    
    // Determine media type correctly
    let mediaType: 'image' | 'video' | 'audio' = 'image';
    if (data.media) {
        if (data.media.type.startsWith('audio')) mediaType = 'audio';
        else if (data.media.type.startsWith('video')) mediaType = 'video';
    }

    try {
      const resultIncident = await db.createIncident({
        ...data,
        location: userLocation || GOMA_CENTER,
        mediaUrl: data.media ? URL.createObjectURL(data.media) : undefined, // Still local URL for demo if no storage bucket
        mediaType: mediaType
      }, user);

      // Optimistic update not strictly needed with realtime, but good for perceived speed
      setIncidents(prev => [resultIncident, ...prev]);

      setIsSubmitting(false);
      setActiveTab('LIST');
      showToast('Incident signalé avec succès', 'success');
    } catch (e: any) {
      console.error(e);
      setIsSubmitting(false);
      showToast("Erreur lors de l'envoi", 'error');
    }
  };

  const handleVote = async (id: string, type: 'like' | 'dislike') => {
    if (!user) return;
    try {
        const updated = await db.voteIncident(id, user.uid, type);
        setIncidents(prev => prev.map(i => i.id === id ? updated : i));
        showToast('Vote enregistré', 'success');
    } catch (e) {
        console.error(e);
    }
  };

  const handleValidate = async (id: string, isValid: boolean) => {
    if (!user) return;
    try {
        await db.updateIncidentStatus(id, isValid ? IncidentStatus.VALIDE : IncidentStatus.REJETE, user.uid);
        const incs = await db.getIncidents();
        setIncidents(incs);
        showToast(isValid ? 'Incident validé' : 'Incident rejeté', isValid ? 'success' : 'info');
    } catch (e) {
        console.error(e);
    }
  };
  
  const handleUpdateStatus = async (id: string, status: IncidentStatus) => {
      if(!user) return;
      try {
          await db.updateIncidentStatus(id, status, user.uid);
          const incs = await db.getIncidents();
          setIncidents(incs);
          showToast(`Statut mis à jour : ${status}`, 'success');
      } catch (e) {
          console.error(e);
      }
  };

  const handleSOS = async () => {
    if (!user) return;
    try {
        await db.createIncident({
            type: IncidentType.SOS,
            description: SOS_MESSAGE_TEMPLATE,
            location: userLocation || GOMA_CENTER
        }, user);
        
        // No need to fetch manually if realtime is on, but safe to do so
        showToast('Alerte SOS transmise !', 'error');
    } catch (e) {
        console.error(e);
    }
  };

  const markNotificationRead = async (id: string) => {
     try {
         await db.markNotificationRead(id);
         setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
     } catch (e) {
         console.error(e);
     }
  };

  const markAllRead = async () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      try {
          const unread = notifications.filter(n => !n.read);
          await Promise.all(unread.map(n => db.markNotificationRead(n.id)));
      } catch (e) {
          console.error(e);
      }
  };

  if (!user) {
    return <AuthView onLogin={setUser} showToast={showToast} />;
  }

  if (activeTab === 'PROFILE' && user.role === UserRole.ADMINISTRATEUR) {
      return (
          <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <AdminDashboard 
              user={user} 
              incidents={incidents} 
              onLogout={() => setUser(null)} 
              onUpdateStatus={handleUpdateStatus}
              notifications={notifications} 
            />
          </>
      );
  }

  return (
    <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        userRole={user.role} 
        unreadCount={notifications.filter(n => !n.read).length}
        onNotificationClick={() => setIsNotificationPanelOpen(true)}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <NotificationPanel 
        isOpen={isNotificationPanelOpen} 
        onClose={() => setIsNotificationPanelOpen(false)}
        notifications={notifications}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllRead}
      />

      {activeTab === 'MAP' && (
        <MapView 
          incidents={incidents} 
          currentUser={user} 
          onIncidentClick={(inc) => {
             setActiveTab('LIST');
          }} 
          userLocation={userLocation}
        />
      )}
      
      {activeTab === 'LIST' && (
        <div className="h-full overflow-y-auto p-4 pt-16 bg-gray-100 space-y-4">
          {incidents.map(inc => (
            <IncidentCard 
              key={inc.id} 
              incident={inc} 
              currentUser={user} 
              onVote={handleVote} 
              onValidate={handleValidate}
              distance={userLocation ? 50 : undefined} 
            />
          ))}
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

      {activeTab === 'SOS' && (
        <PanicButton onTrigger={handleSOS} />
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
    </Layout>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}