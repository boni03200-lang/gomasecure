import React, { useState, useEffect, useMemo } from 'react';
import { Incident, IncidentStatus, IncidentType, User, UserRole, UserStatus, Notification, ActivityLog } from '../types';
import { db } from '../services/supabase';
import { MapView } from './MapView';
import { ReportGenerator } from './ReportGenerator';
import { 
  Search, LogOut, Users, 
  Filter, X, Phone, Check, 
  AlertTriangle, FileAudio, Shield, Ban, History, UserCheck, ArrowLeft, FileDown, Menu, Siren, Mail, Calendar, Sliders, User as UserIcon, Link2, GitMerge, ChevronLeft, CheckCircle, LogIn, PenTool, ThumbsUp, XCircle, AlertCircle, Send
} from 'lucide-react';
import { formatDistanceToNow, format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

declare global {
  interface Window {
    html2pdf: any;
  }
}

interface AdminDashboardProps {
  user: User;
  incidents: Incident[];
  onLogout: () => void;
  onUpdateStatus: (id: string, status: IncidentStatus) => void;
  notifications: Notification[];
}

const COLORS = {
  catPink: '#ec4899',
  catPurple: '#8b5cf6',
  catYellow: '#eab308',
  catGreen: '#22c55e',
  catBlue: '#3b82f6',
  catOrange: '#f97316',
};

// --- CHARTS SUB-COMPONENTS ---
const CategoryChart = ({ incidents }: { incidents: Incident[] }) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => counts[i.type] = (counts[i.type] || 0) + 1);
    return [
      { label: IncidentType.VOL, color: COLORS.catPink, count: counts[IncidentType.VOL] || 0 },
      { label: IncidentType.AGRESSION, color: COLORS.catPurple, count: counts[IncidentType.AGRESSION] || 0 },
      { label: IncidentType.INCENDIE, color: COLORS.catOrange, count: counts[IncidentType.INCENDIE] || 0 },
      { label: IncidentType.ACCIDENT, color: COLORS.catYellow, count: counts[IncidentType.ACCIDENT] || 0 },
      { label: IncidentType.ENLEVEMENT, color: COLORS.catBlue, count: counts[IncidentType.ENLEVEMENT] || 0 },
      { label: IncidentType.SOS, color: '#ef4444', count: counts[IncidentType.SOS] || 0 },
      { label: 'Autres', color: COLORS.catGreen, count: 0 },
    ];
  }, [incidents]);

  return (
    <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
      {data.map((item) => (
        <div key={item.label} className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-300 mb-0.5">
            <span style={{ color: item.color }} className="font-bold px-1 border border-white/10 bg-black/20 rounded">{item.label}</span>
            <span>{item.count}</span>
          </div>
          <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
             <div className="h-full rounded-full" style={{ width: `${(item.count / Math.max(1, incidents.length)) * 100}%`, backgroundColor: item.color }}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TimelineChart = ({ incidents }: { incidents: Incident[] }) => {
  const bars = useMemo(() => {
    const today = new Date();
    const res = [];
    for(let i=13; i>=0; i--) {
      const d = subDays(today, i);
      const start = startOfDay(d).getTime();
      const end = start + 86400000;
      const count = incidents.filter(inc => inc.timestamp >= start && inc.timestamp < end).length;
      res.push({ day: format(d, 'dd'), count });
    }
    return res;
  }, [incidents]);
  const max = Math.max(...bars.map(b => b.count), 1);
  return (
    <div className="h-full flex items-end justify-between space-x-1 pt-2 pb-4 px-2">
       {bars.map((b, i) => (
         <div key={i} className="flex-1 flex flex-col items-center group">
            <div className="w-full bg-green-500/80 hover:bg-green-400 transition-all rounded-t-sm" style={{ height: `${(b.count / max) * 100}%`, minHeight: '4px' }}></div>
            <div className="text-[8px] text-gray-500 mt-1">{b.day}</div>
         </div>
       ))}
    </div>
  );
};

const StatusDonut = ({ incidents }: { incidents: Incident[] }) => {
   const total = incidents.length;
   const resolved = incidents.filter(i => i.status === IncidentStatus.RESOLU).length;
   const active = total - resolved;
   const pct = total > 0 ? (active / total) * 314 : 0;
   return (
     <div className="h-full flex items-center justify-center relative">
        <svg viewBox="0 0 120 120" className="w-24 h-24 transform -rotate-90">
           <circle cx="60" cy="60" r="45" fill="none" stroke="#374151" strokeWidth="20" />
           <circle cx="60" cy="60" r="45" fill="none" stroke="#f97316" strokeWidth="20" strokeDasharray={`${pct} 314`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
           <span className="text-xl font-bold text-white">{active}</span>
           <span className="text-[8px] text-gray-400 uppercase">Actifs</span>
        </div>
     </div>
   );
};

const HeatmapGrid = ({ incidents }: { incidents: Incident[] }) => {
  const grid = Array(7).fill(0).map(() => Array(8).fill(0).map(() => Math.random()));
  const days = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  return (
    <div className="h-full flex flex-col justify-between text-[8px] text-gray-400">
       <div className="flex justify-between px-4 mb-1"><span>00:00</span><span>08:00</span><span>16:00</span><span>24:00</span></div>
       {grid.map((row, i) => (
         <div key={i} className="flex items-center space-x-1 mb-0.5">
            <span className="w-4 text-right pr-1">{days[i]}</span>
            {row.map((val, j) => (
              <div key={j} className="flex-1 h-3 rounded-sm" style={{ backgroundColor: `rgba(132, 204, 22, ${0.2 + (val * 0.8)})` }}></div>
            ))}
         </div>
       ))}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  user, incidents, onLogout, onUpdateStatus, notifications
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<ActivityLog[]>([]);
  
  // -- FILTER STATE --
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filter States
  const [filterDateRange, setFilterDateRange] = useState<'ALL'|'24H'|'7D'|'30D'>('30D');
  const [filterStatuses, setFilterStatuses] = useState<IncidentStatus[]>([]);
  const [filterTypes, setFilterTypes] = useState<IncidentType[]>([]);
  const [filterMinReliability, setFilterMinReliability] = useState<number>(0);

  // User Management Filters
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'ALL' | 'SENTINEL' | 'BANNED'>('ALL');
  
  // Mobile responsive toggle for right panel
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Check for critical SOS
  const criticalSOS = useMemo(() => {
     return incidents.find(i => i.type === IncidentType.SOS && i.status === IncidentStatus.EN_ATTENTE);
  }, [incidents]);

  const refreshUsers = async () => {
    try {
      const u = await db.getAllUsers();
      setUsers(u);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  useEffect(() => {
    // If SOS appears, select it immediately
    if (criticalSOS) {
        setSelectedIncident(criticalSOS);
    }
  }, [criticalSOS]);

  useEffect(() => {
    if (selectedUser) {
      setUserHistory([]); // Clear previous history first for UX accuracy
      db.getUserActivity(selectedUser.uid).then(setUserHistory);
    } else {
      setUserHistory([]);
    }
  }, [selectedUser]);

  // --- FILTER LOGIC OPTIMIZED ---
  const filteredIncidents = useMemo(() => {
    return incidents.filter(i => {
        // 1. Text Search
        const matchesSearch = i.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              i.id.includes(searchTerm);
        if (!matchesSearch) return false;

        // 2. Status Filter
        if (filterStatuses.length > 0 && !filterStatuses.includes(i.status)) return false;

        // 3. Type Filter
        if (filterTypes.length > 0 && !filterTypes.includes(i.type)) return false;

        // 4. Reliability Filter
        if (i.reliabilityScore < filterMinReliability) return false;

        // 5. Date Filter
        const now = Date.now();
        const diff = now - i.timestamp;
        const ONE_DAY = 86400000;
        if (filterDateRange === '24H' && diff > ONE_DAY) return false;
        if (filterDateRange === '7D' && diff > 7 * ONE_DAY) return false;
        if (filterDateRange === '30D' && diff > 30 * ONE_DAY) return false;

        return true;
    });
  }, [incidents, searchTerm, filterStatuses, filterTypes, filterMinReliability, filterDateRange]);

  // Filter Users Logic
  const filteredUsers = useMemo(() => {
      return users.filter(u => {
          const matchesSearch = u.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                                u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                (u.phone && u.phone.includes(userSearchTerm));
          
          let matchesFilter = true;
          if (userFilter === 'SENTINEL') matchesFilter = u.role === UserRole.SENTINELLE;
          if (userFilter === 'BANNED') matchesFilter = u.status === UserStatus.BANNI;

          return matchesSearch && matchesFilter;
      });
  }, [users, userSearchTerm, userFilter]);

  const handleMapClick = () => {
    setSelectedIncident(null);
  };

  const handleInviteSentinel = async () => {
      if (!selectedUser) return;
      if (selectedUser.role === UserRole.SENTINELLE) {
          // Demote immediately if already sentinel (Admin prerogative)
          await db.updateUserRole(selectedUser.uid, UserRole.CITOYEN);
          const updatedUser = { ...selectedUser, role: UserRole.CITOYEN };
          setSelectedUser(updatedUser);
          refreshUsers();
      } else {
          // INVITE if Citoyen
          await db.sendPromotionInvite(selectedUser.uid);
          alert(`Invitation envoyée à ${selectedUser.displayName}`);
      }
  };

  const handleToggleBan = async () => {
    if (!selectedUser) return;
    const newStatus = selectedUser.status === UserStatus.BANNI ? UserStatus.ACTIF : UserStatus.BANNI;
    await db.updateUserStatus(selectedUser.uid, newStatus);
    const updatedUser = { ...selectedUser, status: newStatus };
    setSelectedUser(updatedUser);
    refreshUsers();
  };

  const toggleStatusFilter = (status: IncidentStatus) => {
      setFilterStatuses(prev => 
          prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
      );
  };

  const toggleTypeFilter = (type: IncidentType) => {
      setFilterTypes(prev => 
          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      );
  };

  // HELPER: Link to User Profile
  const openUserProfile = (targetUser?: User) => {
     if (targetUser) {
        setSelectedUser(targetUser);
        setShowUserPanel(true);
        // If mobile panel is closed, user panel will open over it.
     }
  };

  // HELPER: Get Reporters List (Merged Logic)
  const reportersList = useMemo(() => {
      if (!selectedIncident) return [];
      const ids = selectedIncident.reporters && selectedIncident.reporters.length > 0 
          ? selectedIncident.reporters 
          : [selectedIncident.reporterId];
      
      // Map to User objects and remove duplicates just in case
      const uniqueIds = Array.from(new Set(ids));
      return uniqueIds.map(id => users.find(u => u.uid === id)).filter(Boolean) as User[];
  }, [selectedIncident, users]);

  const validator = selectedIncident ? users.find(u => u.uid === selectedIncident.validatedBy) : null;

  const getActionIcon = (action: string) => {
    switch(action) {
      case 'LOGIN': return <LogIn className="w-3 h-3 text-gray-500" />;
      case 'REPORT': return <PenTool className="w-3 h-3 text-blue-500" />;
      case 'VOTE': return <ThumbsUp className="w-3 h-3 text-green-500" />;
      case 'VALIDATE': return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'REJECT': return <XCircle className="w-3 h-3 text-red-600" />;
      case 'SOS': return <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />;
      default: return <History className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden font-sans text-sm">
      
      {/* ALERT OVERLAY FOR SOS */}
      {criticalSOS && (
         <div className="absolute top-0 left-0 right-0 z-50 bg-red-600 text-white p-2 flex items-center justify-between animate-pulse px-4">
             <div className="flex items-center font-black uppercase tracking-wider">
                 <Siren className="w-6 h-6 mr-3 animate-spin" />
                 ALERTE CRITIQUE : SOS DÉTECTÉ
             </div>
             <button 
               onClick={() => setSelectedIncident(criticalSOS)}
               className="bg-white text-red-600 px-4 py-1 rounded font-bold text-xs hover:bg-red-50"
             >
                 VOIR MAINTENANT
             </button>
         </div>
      )}

      <ReportGenerator 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)}
        incidents={incidents}
        users={users}
        currentUser={user}
      />

      <div className="absolute inset-0 z-0">
        <MapView 
          incidents={filteredIncidents} // Use filtered data for map too
          currentUser={user}
          userLocation={null}
          onIncidentClick={setSelectedIncident}
          onMapClick={handleMapClick}
          highlightedId={selectedIncident?.id}
        />
        <div className="absolute inset-0 bg-blue-900/10 pointer-events-none mix-blend-multiply" />
      </div>

      {/* TOP BAR */}
      <div className={`absolute left-0 right-0 h-14 md:h-10 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 z-20 text-gray-300 transition-all ${criticalSOS ? 'top-10' : 'top-0'}`}>
         <div className="flex items-center">
            <div className="bg-yellow-500 text-black p-0.5 rounded-sm mr-2">
               <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-wide text-gray-100 mr-4">GomaSecure <span className="hidden md:inline font-normal text-gray-500">| Centre de Commandement</span></span>
         </div>
         <div className="flex items-center space-x-2 md:space-x-4">
             <button 
               onClick={() => setShowRightPanel(!showRightPanel)}
               className="md:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded"
             >
                <Menu className="w-4 h-4" />
             </button>
             
             <button 
               onClick={() => setIsReportModalOpen(true)}
               className="flex items-center text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-all active:scale-95 border border-blue-500 shadow-lg"
             >
               <FileDown className="w-3 h-3 mr-1.5" />
               <span className="hidden md:inline">Rapport</span>
             </button>

             <button onClick={onLogout} className="hover:text-white" title="Déconnexion"><LogOut className="w-4 h-4" /></button>
         </div>
      </div>

      {/* LEFT TOOLBAR */}
      <div className={`hidden md:flex absolute bottom-0 left-0 w-12 bg-gray-900 border-r border-gray-700 flex-col items-center py-4 z-20 space-y-4 ${criticalSOS ? 'top-24' : 'top-10'}`}>
          
          <button 
              onClick={() => { setShowUserPanel(!showUserPanel); setShowFilterPanel(false); }} 
              className={`p-2 rounded-lg transition-colors ${showUserPanel ? 'text-white bg-blue-600' : 'text-gray-400 hover:text-white'}`}
              title="Gestion Utilisateurs"
          >
            <Users className="w-5 h-5" />
          </button>
          
          <button 
              onClick={() => { setShowFilterPanel(!showFilterPanel); setShowUserPanel(false); }} 
              className={`p-2 rounded-lg transition-colors ${showFilterPanel ? 'text-white bg-blue-600' : 'text-gray-400 hover:text-white'}`}
              title="Filtres Avancés"
          >
              <Filter className="w-5 h-5" />
          </button>
      </div>

      {/* --- FILTER PANEL POPUP --- */}
      {showFilterPanel && (
        <div className={`absolute left-0 md:left-12 bottom-0 w-full md:w-72 bg-gray-900 border-r border-gray-700 z-30 shadow-2xl animate-in slide-in-from-left ${criticalSOS ? 'top-24' : 'top-14 md:top-10'}`}>
            <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 justify-between">
                 <span className="text-gray-200 font-bold text-xs flex items-center"><Sliders className="w-3 h-3 mr-2" /> Filtres Avancés</span>
                 <X className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" onClick={() => setShowFilterPanel(false)} />
            </div>
            
            <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-2.5rem)] custom-scrollbar">
                <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" /> Période
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: '24H', label: '24 Heures' },
                            { id: '7D', label: '7 Jours' },
                            { id: '30D', label: '30 Jours' },
                            { id: 'ALL', label: 'Tout' }
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setFilterDateRange(opt.id as any)}
                                className={`text-[10px] font-bold py-1.5 px-2 rounded border transition-colors ${filterDateRange === opt.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Statut Incident</h4>
                    <div className="space-y-1">
                        {Object.values(IncidentStatus).map(status => (
                            <div 
                                key={status} 
                                onClick={() => toggleStatusFilter(status)}
                                className={`flex items-center p-2 rounded cursor-pointer border transition-colors ${filterStatuses.includes(status) ? 'bg-blue-900/30 border-blue-500/50' : 'bg-transparent border-transparent hover:bg-gray-800'}`}
                            >
                                <div className={`w-3 h-3 rounded-full mr-3 border ${filterStatuses.includes(status) ? 'bg-blue-500 border-white' : 'bg-gray-700 border-gray-600'}`}></div>
                                <span className={`text-xs ${filterStatuses.includes(status) ? 'text-white font-bold' : 'text-gray-400'}`}>{status}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Type d'Incident</h4>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.values(IncidentType).map(type => (
                            <div 
                                key={type} 
                                onClick={() => toggleTypeFilter(type)}
                                className={`text-[10px] p-1.5 rounded cursor-pointer border text-center truncate ${filterTypes.includes(type) ? 'bg-gray-700 border-gray-500 text-white font-bold' : 'bg-gray-800 border-transparent text-gray-500 hover:bg-gray-700'}`}
                            >
                                {type}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <h4 className="text-[10px] uppercase font-bold text-gray-500">Fiabilité Min.</h4>
                        <span className="text-xs font-mono text-blue-400">{filterMinReliability}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={filterMinReliability} 
                        onChange={(e) => setFilterMinReliability(parseInt(e.target.value))}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <button 
                    onClick={() => {
                        setFilterDateRange('30D');
                        setFilterStatuses([]);
                        setFilterTypes([]);
                        setFilterMinReliability(0);
                    }}
                    className="w-full py-2 border border-gray-600 text-gray-400 text-xs font-bold rounded hover:bg-gray-800 hover:text-white transition-colors"
                >
                    Réinitialiser Filtres
                </button>
                
                <div className="text-[10px] text-center text-gray-600 pt-2">
                    {filteredIncidents.length} résultats affichés
                </div>
            </div>
        </div>
      )}

      {/* RIGHT PANEL CONTAINER */}
      {showRightPanel && (
        <div className={`absolute right-0 bottom-0 w-full md:w-[500px] flex flex-col pointer-events-none z-10 animate-in slide-in-from-right duration-300 ${criticalSOS ? 'top-24' : 'top-14 md:top-10'}`}>
            {/* INCIDENT DATA GRID */}
            <div className="pointer-events-auto bg-gray-900/95 border-b border-l border-gray-700 h-1/2 flex flex-col">
                <div className="h-8 bg-gray-800 flex items-center px-2 justify-between border-b border-gray-700">
                    <span className="text-xs font-bold text-gray-300 flex items-center"><ChevronLeft className="w-3 h-3 mr-1"/> Flux ({filteredIncidents.length})</span>
                    <div className="flex space-x-2">
                       <input 
                         type="text" 
                         placeholder="Filtrer ID..." 
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="bg-gray-900 border border-gray-600 rounded px-2 text-xs text-white h-5 w-24 md:w-32 focus:outline-none focus:border-blue-500"
                       />
                    </div>
                </div>

                <div className="flex bg-gray-800 text-[10px] font-bold text-gray-400 border-b border-gray-700 py-1 px-2">
                    <div className="w-16">ID</div>
                    <div className="flex-1">Type</div>
                    <div className="w-16 text-center">Statut</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredIncidents.map((inc, idx) => (
                      <div 
                        key={inc.id}
                        onClick={() => setSelectedIncident(inc)}
                        className={`flex items-center py-2 px-2 border-b border-gray-800 text-[10px] cursor-pointer hover:bg-gray-800 transition-colors ${inc.type === IncidentType.SOS ? 'bg-red-900/40 border-l-2 border-red-500' : ''} ${selectedIncident?.id === inc.id ? 'bg-blue-900/30' : idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-800/30'}`}
                      >
                          <div className="w-16 font-mono text-gray-500 truncate">#{inc.id.split('-')[0]}</div>
                          <div className="flex-1 min-w-0 pr-2">
                              <div className={`font-bold truncate ${inc.type === IncidentType.SOS ? 'text-red-400' : 'text-gray-200'}`}>{inc.type}</div>
                              <div className="text-gray-500 truncate">
                                {formatDistanceToNow(inc.timestamp, { addSuffix: true, locale: fr })}
                              </div>
                              {/* Merge Indicator */}
                              {(inc.reportCount && inc.reportCount > 1) && (
                                <div className="mt-0.5 flex items-center text-blue-400 font-bold">
                                    <GitMerge className="w-3 h-3 mr-1" />
                                    {inc.reportCount} signalements fusionnés
                                </div>
                              )}
                          </div>
                          <div className="w-16 text-center pl-1">
                               <div className={`w-3 h-3 mx-auto border border-gray-600 rounded-sm ${
                                 inc.status === IncidentStatus.VALIDE ? 'bg-green-500' :
                                 inc.status === IncidentStatus.REJETE ? 'bg-red-500' : 
                                 inc.status === IncidentStatus.RESOLU ? 'bg-blue-500' : 'bg-orange-500'
                               }`}></div>
                          </div>
                      </div>
                    ))}
                </div>
            </div>

            {/* ANALYTICS PANELS */}
            <div className="pointer-events-auto flex-1 bg-gray-900/80 backdrop-blur-sm border-l border-gray-700 p-2 grid grid-cols-2 gap-2 overflow-hidden">
                <div className="bg-gray-900/50 border border-gray-700 rounded p-2 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-bold text-gray-100 mb-1 border-b border-gray-700 pb-1">Catégories</h4>
                    <CategoryChart incidents={filteredIncidents} />
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded p-2 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-bold text-gray-100 mb-1 border-b border-gray-700 pb-1">Tendances</h4>
                    <TimelineChart incidents={filteredIncidents} />
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded p-2 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-bold text-gray-100 mb-1 border-b border-gray-700 pb-1">Statuts</h4>
                    <StatusDonut incidents={filteredIncidents} />
                </div>
                <div className="bg-gray-900/50 border border-gray-700 rounded p-2 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-bold text-gray-100 mb-1 border-b border-gray-700 pb-1">Carte Thermique</h4>
                    <HeatmapGrid incidents={filteredIncidents} />
                </div>
            </div>
        </div>
      )}

      {/* POPUP DETAIL CARD */}
      {selectedIncident && (
        <div className="absolute top-1/2 left-1/2 md:left-[20%] transform -translate-x-1/2 -translate-y-1/2 md:translate-x-0 w-[90%] md:w-80 bg-white shadow-2xl z-30 animate-in fade-in zoom-in-95 rounded-sm overflow-hidden border border-gray-200">
           <div className="h-48 bg-gray-200 relative">
               {selectedIncident.mediaUrl ? (
                   selectedIncident.mediaType === 'video' ? <video src={selectedIncident.mediaUrl} className="w-full h-full object-cover" controls /> : 
                   selectedIncident.mediaType === 'audio' ? <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900"><FileAudio className="w-8 h-8 text-blue-400" /><audio controls src={selectedIncident.mediaUrl} className="w-4/5 h-8 mt-2" /></div> : 
                   <img src={selectedIncident.mediaUrl} className="w-full h-full object-cover" alt="Evidence" />
               ) : <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100"><AlertTriangle className="w-12 h-12 opacity-20" /></div>}
               
               <button onClick={() => setSelectedIncident(null)} className="absolute top-2 right-2 bg-black/50 hover:bg-black text-white p-1 rounded-full z-10"><X className="w-4 h-4" /></button>
           </div>
           
           <div className="p-4 text-xs space-y-2 text-gray-600">
               <div className="flex justify-between font-bold text-gray-900">
                   <span className={selectedIncident.type === IncidentType.SOS ? 'text-red-600 uppercase font-black' : ''}>{selectedIncident.type}</span>
                   <span className="text-gray-500">#{selectedIncident.id}</span>
               </div>
               <p className="bg-gray-50 p-2 rounded border border-gray-100 italic">{selectedIncident.description}</p>
               
               {/* CHAIN OF TRUST SECTION - MERGED REPORTERS */}
               <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  
                  {reportersList.length > 0 && (
                    <div className="space-y-1">
                         <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase font-bold mb-1">
                            <span>Signalé par ({reportersList.length})</span>
                            {reportersList.length > 1 && (
                                <div className="flex items-center text-blue-600">
                                    <div className="w-16 h-1 bg-gray-200 rounded-full mr-2 overflow-hidden">
                                        <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, reportersList.length * 33)}%` }}></div>
                                    </div>
                                    Force: {reportersList.length > 2 ? 'Haute' : 'Moyenne'}
                                </div>
                            )}
                         </div>

                         {reportersList.map((rep, idx) => (
                            <div 
                                key={`${rep.uid}-${idx}`}
                                onClick={() => openUserProfile(rep)}
                                className={`flex items-center justify-between p-1.5 rounded cursor-pointer group transition-colors border border-transparent ${idx === 0 ? 'bg-blue-50/50 hover:bg-blue-50 hover:border-blue-100' : 'hover:bg-gray-50 hover:border-gray-200'}`}
                            >
                                <div className="flex items-center text-gray-700 min-w-0">
                                    {/* Icon Indicator: First one is Source, others are Witnesses */}
                                    <div className="mr-2 relative flex-shrink-0">
                                        {rep.role === UserRole.SENTINELLE ? (
                                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                                        ) : (
                                            <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                                        )}
                                        {idx === 0 && (
                                            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col min-w-0">
                                        <span className={`font-bold truncate text-[11px] group-hover:text-blue-600 ${idx === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                                            {rep.displayName}
                                        </span>
                                        <span className="text-[9px] text-gray-400">
                                            {idx === 0 ? 'Source Initiale' : 'Confirmation (50m)'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <span className={`text-[9px] font-bold mr-2 ${rep.reputationScore > 80 ? 'text-green-500' : 'text-orange-400'}`}>
                                        {rep.reputationScore}%
                                    </span>
                                    <Link2 className="w-3 h-3 text-gray-300 group-hover:text-blue-400" />
                                </div>
                            </div>
                         ))}
                    </div>
                  )}

                  {validator && (
                     <div 
                        onClick={() => openUserProfile(validator)}
                        className="flex items-center justify-between p-1.5 rounded bg-green-50/30 hover:bg-green-50 cursor-pointer group transition-colors border border-transparent hover:border-green-100 mt-2"
                     >
                        <div className="flex items-center text-gray-700">
                           <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-600" />
                           <div className="flex flex-col">
                                <span className="font-bold text-[11px] group-hover:text-green-600">Validé par: {validator.displayName}</span>
                                <span className="text-[9px] text-green-600/70">Décision Officielle</span>
                           </div>
                        </div>
                        <Link2 className="w-3 h-3 text-gray-300 group-hover:text-green-400" />
                     </div>
                  )}
               </div>

               <div className="flex items-center justify-between pt-2">
                   <div className="flex space-x-1">
                       {selectedIncident.status === IncidentStatus.EN_ATTENTE && (
                           <>
                               <button 
                                 onClick={() => onUpdateStatus(selectedIncident.id, IncidentStatus.VALIDE)} 
                                 className="bg-green-600 text-white px-2 py-1 rounded flex items-center"
                                 title="Valider (Urgent)"
                               >
                                 <Check className="w-3 h-3 mr-1" /> Valider
                               </button>
                               <button 
                                 onClick={() => {
                                    if(confirm("Attention: Le rejet d'un SOS pour fausse alerte entraînera le bannissement de l'utilisateur. Confirmer ?")) {
                                        onUpdateStatus(selectedIncident.id, IncidentStatus.REJETE);
                                    }
                                 }} 
                                 className="bg-red-600 text-white px-2 py-1 rounded flex items-center"
                                 title={selectedIncident.type === IncidentType.SOS ? "Rejeter & Bannir (Fausse Alerte)" : "Rejeter"}
                               >
                                 <X className="w-3 h-3 mr-1" /> Rejeter
                               </button>
                           </>
                       )}
                       {selectedIncident.status === IncidentStatus.VALIDE && (
                           <button onClick={() => onUpdateStatus(selectedIncident.id, IncidentStatus.RESOLU)} className="bg-blue-600 text-white px-3 py-1 rounded font-bold">RÉSOUDRE</button>
                       )}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* USER MANAGEMENT PANEL */}
      {showUserPanel && (
         <div className={`absolute left-0 md:left-12 bottom-0 w-full md:w-96 bg-gray-900 border-r border-gray-700 z-20 shadow-2xl animate-in slide-in-from-left ${criticalSOS ? 'top-24' : 'top-14 md:top-10'}`}>
             
             {/* Header */}
             <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 justify-between">
                 <div className="flex items-center">
                    {selectedUser && <button onClick={() => setSelectedUser(null)} className="mr-3 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700"><ArrowLeft className="w-4 h-4" /></button>}
                    <span className="text-gray-200 font-bold text-sm tracking-wide">{selectedUser ? 'Profil Utilisateur' : 'Gestion Utilisateurs'}</span>
                 </div>
                 <X className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" onClick={() => setShowUserPanel(false)} />
             </div>
             
             {/* Main Content Area */}
             <div className="flex flex-col h-[calc(100%-3rem)] bg-gray-900">
                 
                 {!selectedUser ? (
                    <>
                        {/* Search & Filter Bar */}
                        <div className="p-3 border-b border-gray-800 space-y-3 bg-gray-850">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                                <input 
                                    type="text" 
                                    placeholder="Rechercher nom, email, tél..." 
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder-gray-600"
                                />
                            </div>
                            <div className="flex space-x-1">
                                {[
                                    { id: 'ALL', label: 'Tous' }, 
                                    { id: 'SENTINEL', label: 'Sentinelles', icon: <Shield className="w-3 h-3 mr-1" /> }, 
                                    { id: 'BANNED', label: 'Bannis', icon: <Ban className="w-3 h-3 mr-1" /> }
                                ].map(filter => (
                                    <button
                                        key={filter.id}
                                        onClick={() => setUserFilter(filter.id as any)}
                                        className={`flex-1 flex items-center justify-center py-1.5 rounded text-[10px] font-bold transition-colors ${userFilter === filter.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                    >
                                        {filter.icon} {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                             <div className="text-[10px] uppercase text-gray-500 font-bold mb-2 px-2 flex justify-between">
                                 <span>Utilisateurs ({filteredUsers.length})</span>
                                 <span>Réputation</span>
                             </div>
                             {filteredUsers.map(u => (
                                 <div key={u.uid} onClick={() => setSelectedUser(u)} className="flex items-center p-3 mb-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-600 group transition-all">
                                     <div className="relative">
                                        <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 shadow-md border border-gray-600 group-hover:border-blue-500/50">
                                            {u.displayName.charAt(0)}
                                        </div>
                                        {u.role === UserRole.SENTINELLE && (
                                            <div className="absolute -bottom-1 -right-0 bg-blue-500 rounded-full p-0.5 border-2 border-gray-800">
                                                <Shield className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                        {u.status === UserStatus.BANNI && (
                                            <div className="absolute -bottom-1 -right-0 bg-red-500 rounded-full p-0.5 border-2 border-gray-800">
                                                <Ban className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                     </div>
                                     
                                     <div className="flex-1 overflow-hidden min-w-0 mr-3">
                                         <div className="text-gray-200 text-xs font-bold truncate flex items-center">
                                            {u.displayName}
                                         </div>
                                         <div className="text-gray-400 text-[10px] truncate flex items-center mt-0.5">
                                             <Phone className="w-3 h-3 mr-1 text-green-500" />
                                             {u.phone || 'Non renseigné'}
                                         </div>
                                         <div className="text-gray-600 text-[10px] truncate">{u.email}</div>
                                     </div>

                                     {/* Reputation Bar Mini */}
                                     <div className="w-16 flex flex-col items-end">
                                          <div className={`text-[10px] font-bold mb-0.5 ${u.reputationScore > 80 ? 'text-green-500' : u.reputationScore < 30 ? 'text-red-500' : 'text-orange-500'}`}>
                                              {u.reputationScore}%
                                          </div>
                                          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full ${u.reputationScore > 80 ? 'bg-green-500' : u.reputationScore < 30 ? 'bg-red-500' : 'bg-orange-500'}`} 
                                                style={{ width: `${u.reputationScore}%` }}
                                              ></div>
                                          </div>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </>
                 ) : (
                    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                        {/* Detail Header */}
                        <div className="bg-gray-800 p-6 flex flex-col items-center border-b border-gray-700">
                             <div className="w-20 h-20 bg-gradient-to-br from-gray-700 to-gray-600 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-3 shadow-xl ring-4 ring-gray-900">
                                 {selectedUser.displayName.charAt(0)}
                             </div>
                             <h3 className="text-lg font-bold text-white">{selectedUser.displayName}</h3>
                             <div className="flex items-center text-gray-400 text-xs mb-2">
                                <Mail className="w-3 h-3 mr-1" /> {selectedUser.email}
                             </div>
                             
                             {/* PHONE NUMBER CALL TO ACTION */}
                             <a 
                               href={selectedUser.phone ? `tel:${selectedUser.phone}` : '#'}
                               className={`flex items-center justify-center space-x-2 mb-4 py-1.5 px-4 rounded-full border transition-transform active:scale-95 ${selectedUser.phone ? 'bg-green-900/20 border-green-700 cursor-pointer hover:bg-green-900/40' : 'bg-gray-700/50 border-gray-600 cursor-not-allowed opacity-50'}`}
                             >
                                 <Phone className={`w-3 h-3 ${selectedUser.phone ? 'text-green-400' : 'text-gray-500'}`} />
                                 <span className={`font-mono font-bold text-xs tracking-wider ${selectedUser.phone ? 'text-gray-200' : 'text-gray-500'}`}>
                                    {selectedUser.phone || 'Aucun numéro'}
                                 </span>
                             </a>

                             <div className="flex space-x-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${selectedUser.role === UserRole.SENTINELLE ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                                    {selectedUser.role}
                                </span>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${selectedUser.status === UserStatus.BANNI ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-green-900/30 text-green-400 border-green-800'}`}>
                                    {selectedUser.status}
                                </span>
                             </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-px bg-gray-700 border-b border-gray-700">
                            <div className="bg-gray-800 p-3 text-center">
                                <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Réputation</span>
                                <span className={`text-xl font-bold ${selectedUser.reputationScore > 80 ? 'text-green-500' : 'text-orange-500'}`}>{selectedUser.reputationScore}</span>
                            </div>
                            <div className="bg-gray-800 p-3 text-center">
                                <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Depuis</span>
                                <span className="text-sm font-bold text-white">{formatDistanceToNow(selectedUser.joinedAt, { addSuffix: true })}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-700 bg-gray-900">
                            <button 
                                onClick={handleInviteSentinel} 
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${selectedUser.role === UserRole.SENTINELLE ? 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700' : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'}`}
                            >
                                {selectedUser.role === UserRole.SENTINELLE ? <XCircle className="w-5 h-5 mb-1" /> : <Send className="w-5 h-5 mb-1" />}
                                <span className="text-[10px] font-bold">{selectedUser.role === UserRole.SENTINELLE ? 'Rétrograder Citoyen' : 'Inviter Sentinelle'}</span>
                            </button>
                            
                            <button 
                                onClick={handleToggleBan} 
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${selectedUser.status === UserStatus.BANNI ? 'bg-green-600 border-green-500 text-white hover:bg-green-500' : 'bg-red-900/20 border-red-800 text-red-500 hover:bg-red-900/40'}`}
                            >
                                {selectedUser.status === UserStatus.BANNI ? <UserCheck className="w-5 h-5 mb-1"/> : <Ban className="w-5 h-5 mb-1"/>}
                                <span className="text-[10px] font-bold">{selectedUser.status === UserStatus.BANNI ? 'Réhabiliter Compte' : 'Bannir Utilisateur'}</span>
                            </button>
                        </div>

                        {/* Activity History */}
                        <div className="flex-1 p-4 bg-gray-900">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center">
                                <History className="w-3 h-3 mr-2" /> Historique Exact
                            </h4>
                            <div className="space-y-4 pl-2 border-l border-gray-800">
                                {userHistory.length === 0 ? (
                                    <p className="text-xs text-gray-600 italic pl-2">Aucune activité enregistrée.</p>
                                ) : (
                                    userHistory.map((log) => (
                                        <div key={log.id} className="relative pl-6">
                                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center overflow-hidden">
                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                                            </div>
                                            
                                            <div className="flex items-start">
                                                <div className="mr-3 mt-0.5">
                                                    {getActionIcon(log.action)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-200">{log.action}</p>
                                                    <p className="text-[11px] text-gray-400 leading-tight">{log.details}</p>
                                                    <p className="text-[9px] text-gray-600 mt-0.5 font-mono">{format(log.timestamp, 'dd/MM/yyyy HH:mm')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                 )}
             </div>
         </div>
      )}

      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: #111827; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }`}</style>
    </div>
  );
};