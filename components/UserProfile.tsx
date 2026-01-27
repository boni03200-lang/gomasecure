import React, { useMemo } from 'react';
import { User, Incident, IncidentStatus, UserRole } from '../types';
import { Shield, Star, LogOut, Clock, MapPin, CheckCircle, XCircle, AlertTriangle, ChevronRight, Settings, Bell, Languages } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

interface UserProfileProps {
  user: User;
  incidents: Incident[];
  onLogout: () => void;
  onLanguageChange: () => void;
  onToggleNotifications: () => void; // Placeholder logic
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, incidents, onLogout, onLanguageChange }) => {
  const { t, language } = useLanguage();

  const myIncidents = useMemo(() => {
    return incidents.filter(i => i.reporterId === user.uid).sort((a, b) => b.timestamp - a.timestamp);
  }, [incidents, user.uid]);

  const stats = useMemo(() => {
    const total = myIncidents.length;
    const validated = myIncidents.filter(i => i.status === IncidentStatus.VALIDE || i.status === IncidentStatus.RESOLU).length;
    const rejected = myIncidents.filter(i => i.status === IncidentStatus.REJETE).length;
    return { total, validated, rejected };
  }, [myIncidents]);

  const getReputationLevel = (score: number) => {
    if (score >= 90) return { label: 'Expert', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' };
    if (score >= 70) return { label: 'Fiable', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' };
    if (score >= 40) return { label: 'Membre', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    return { label: 'Nouveau', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' };
  };

  const reputation = getReputationLevel(user.reputationScore);

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header Profile */}
      <div className="bg-white pt-10 pb-8 px-6 rounded-b-[2.5rem] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
        
        <div className="relative flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500 mb-3 relative">
            {user.displayName.charAt(0)}
            {user.role === UserRole.SENTINELLE && (
               <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white" title="Sentinelle">
                  <Shield className="w-4 h-4" />
               </div>
            )}
          </div>
          
          <h2 className="text-xl font-black text-gray-900">{user.displayName}</h2>
          <p className="text-gray-500 text-sm mb-4">{user.email}</p>

          <div className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center ${reputation.bg} ${reputation.color} ${reputation.border}`}>
             <Star className="w-3 h-3 mr-1.5 fill-current" />
             {reputation.label} • {user.reputationScore} pts
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-between mt-8 px-4">
           <div className="text-center">
              <div className="text-xl font-black text-gray-900">{stats.total}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Signalements</div>
           </div>
           <div className="w-px bg-gray-100"></div>
           <div className="text-center">
              <div className="text-xl font-black text-green-600">{stats.validated}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Validés</div>
           </div>
           <div className="w-px bg-gray-100"></div>
           <div className="text-center">
              <div className="text-xl font-black text-blue-600">{user.joinedAt ? formatDistanceToNow(user.joinedAt, { locale: fr }).replace('environ ', '') : '1j'}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ancienneté</div>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        
        {/* Settings Card */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
           <button onClick={onLanguageChange} className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center">
                 <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mr-3">
                    <Languages className="w-4 h-4" />
                 </div>
                 <span className="text-sm font-bold text-gray-700">Langue</span>
              </div>
              <div className="flex items-center">
                 <span className="text-xs font-bold text-gray-400 mr-2 uppercase">{language === 'fr' ? 'Français' : 'Swahili'}</span>
                 <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
           </button>
        </div>

        {/* History Section */}
        <div>
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-2">{t('tab_list')} ({myIncidents.length})</h3>
           {myIncidents.length === 0 ? (
             <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 border-dashed">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucun signalement effectué.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {myIncidents.map(inc => (
                 <div key={inc.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center overflow-hidden">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
                         inc.type === 'SOS' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                       }`}>
                          {inc.type === 'SOS' ? <AlertTriangle className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                       </div>
                       <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">{t(inc.type)}</h4>
                          <p className="text-xs text-gray-500 truncate">{formatDistanceToNow(inc.timestamp, { addSuffix: true, locale: fr })}</p>
                       </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      inc.status === IncidentStatus.VALIDE ? 'bg-green-100 text-green-700' :
                      inc.status === IncidentStatus.REJETE ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                       {t(inc.status)}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        <button 
           onClick={onLogout}
           className="w-full py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-bold text-sm shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center"
        >
           <LogOut className="w-4 h-4 mr-2" />
           Déconnexion
        </button>
        
        <div className="h-8"></div>
      </div>
    </div>
  );
};