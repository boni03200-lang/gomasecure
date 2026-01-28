import React from 'react';
import { Incident, IncidentStatus, User, UserRole } from '../types';
import { ThumbsUp, ThumbsDown, Check, X, Clock, MapPin, FileAudio, Image as ImageIcon, Video, Shield, Activity, User as UserIcon, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

interface IncidentCardProps {
  incident: Incident;
  currentUser: User;
  onVote: (id: string, type: 'like' | 'dislike') => void;
  onValidate: (id: string, isValid: boolean) => void;
  distance?: number; 
  compact?: boolean;
  domId?: string; 
  className?: string; 
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ 
  incident, 
  currentUser, 
  onVote, 
  onValidate, 
  distance, 
  compact = false, 
  domId,
  className = "" 
}) => {
  const { t } = useLanguage();
  const isSentinel = currentUser.role === UserRole.SENTINELLE;
  const isReporter = currentUser.uid === incident.reporterId;
  const hasVoted = incident.likes.includes(currentUser.uid) || incident.dislikes.includes(currentUser.uid);
  const isNearby = distance !== undefined && distance <= 100;

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case IncidentStatus.VALIDE: return 'bg-green-100 text-green-700 border-green-200';
      case IncidentStatus.REJETE: return 'bg-red-100 text-red-700 border-red-200';
      case IncidentStatus.RESOLU: return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const getStatusLabel = (status: IncidentStatus) => {
    switch (status) {
      case IncidentStatus.VALIDE: return t('VALIDE');
      case IncidentStatus.REJETE: return t('REJETE');
      case IncidentStatus.RESOLU: return t('RESOLU');
      default: return t('EN_ATTENTE');
    }
  };

  const renderMedia = () => {
    if (!incident.mediaUrl) return null;

    if (incident.mediaType === 'audio') {
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl flex items-center border border-blue-100">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-3 shadow-sm text-blue-600">
            <FileAudio className="w-5 h-5" />
          </div>
          <audio controls src={incident.mediaUrl} className="w-full h-8" />
        </div>
      );
    }

    if (incident.mediaType === 'video') {
      return (
        <div className="relative rounded-xl overflow-hidden bg-black shadow-sm">
          <video controls src={incident.mediaUrl} className="w-full h-56 object-cover" />
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center font-bold">
            <Video className="w-3 h-3 mr-1" /> {t('video')}
          </div>
        </div>
      );
    }

    return (
      <div className="relative rounded-xl overflow-hidden shadow-sm group">
        <img src={incident.mediaUrl} alt="Preuve" className="w-full h-56 object-cover bg-gray-100 transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center font-bold">
          <ImageIcon className="w-3 h-3 mr-1" /> {t('evidence')}
        </div>
      </div>
    );
  };

  const reportCount = incident.reportCount || 1;

  return (
    <div 
      id={domId} 
      className={`bg-white rounded-2xl shadow-[0_2px_15px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden ${className} ${!className.includes('p-') ? (compact ? 'p-3' : 'p-5 mb-4') : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start">
           <div className="mr-3">
             <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm relative">
                <UserIcon className="w-5 h-5 text-gray-500" />
                {reportCount > 1 && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                        +{reportCount - 1}
                    </div>
                )}
             </div>
           </div>
           <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-gray-900 text-sm">{t(incident.type)}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(incident.status)}`}>
                  {getStatusLabel(incident.status)}
                </span>
              </div>
              <div className="flex items-center mt-1 space-x-3 text-xs text-gray-400 font-medium">
                 <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {formatDistanceToNow(incident.timestamp, { addSuffix: true, locale: fr })}</span>
                 {distance !== undefined && (
                   <span className={`flex items-center ${isNearby ? 'text-green-600' : ''}`}>
                     <MapPin className="w-3 h-3 mr-1" /> {Math.round(distance)}m
                   </span>
                 )}
              </div>
              {reportCount > 1 && (
                  <div className="flex items-center mt-1 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded w-fit">
                      <Users className="w-3 h-3 mr-1" /> Signalé par {reportCount} personnes
                  </div>
              )}
           </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-700 text-sm mb-4 leading-relaxed pl-1">{incident.description}</p>

      {/* Media */}
      {incident.mediaUrl && (
        <div className="mb-4">
          {renderMedia()}
        </div>
      )}

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 bg-gray-50/80 p-2.5 rounded-xl">
         <div className="flex space-x-4">
             <div className="flex items-center font-medium">
                 <ThumbsUp className="w-4 h-4 mr-1.5 text-green-500 fill-green-500/20" />
                 {incident.likes.length}
             </div>
             <div className="flex items-center font-medium">
                 <ThumbsDown className="w-4 h-4 mr-1.5 text-red-500 fill-red-500/20" />
                 {incident.dislikes.length}
             </div>
         </div>
         <div className="flex items-center">
             <Activity className="w-3 h-3 mr-1.5 text-gray-400" />
             <span className="text-gray-400 mr-1">{t('reliability')}:</span>
             <span className={`font-bold ${incident.reliabilityScore > 60 ? 'text-green-600' : incident.reliabilityScore > 30 ? 'text-orange-500' : 'text-red-500'}`}>
                {incident.reliabilityScore}%
             </span>
         </div>
      </div>

      {/* Actions Logic */}
      {!compact && incident.status === IncidentStatus.EN_ATTENTE && (
        <div className="pt-2">
          {isSentinel ? (
            /* SENTINEL VALIDATION ACTIONS */
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => onValidate(incident.id, true)}
                className="flex items-center justify-center py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-200 transition-all active:scale-95"
              >
                <Check className="w-4 h-4 mr-2" /> {t('validate')}
              </button>
              <button 
                onClick={() => onValidate(incident.id, false)}
                className="flex items-center justify-center py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
              >
                <X className="w-4 h-4 mr-2" /> {t('reject')}
              </button>
            </div>
          ) : isReporter ? (
             /* REPORTER STATUS VIEW (No Voting on own report) */
             <div className="text-center py-3 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-col items-center justify-center">
                <span className="text-xs text-blue-800 font-bold mb-0.5">{t('your_report')}</span>
                <span className="text-[10px] text-blue-600">{t('wait_confirmation')}</span>
             </div>
          ) : (
             /* CITIZEN VOTING ACTIONS */
             isNearby && !hasVoted ? (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onVote(incident.id, 'like')}
                  className="flex items-center justify-center py-2.5 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 rounded-xl text-sm font-bold transition-all active:scale-95"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" /> {t('vote_true')}
                </button>
                <button 
                  onClick={() => onVote(incident.id, 'dislike')}
                  className="flex items-center justify-center py-2.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-sm font-bold transition-all active:scale-95"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" /> {t('vote_false')}
                </button>
              </div>
             ) : !isNearby ? (
                <div className="text-center py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs text-gray-400 font-medium italic">{t('too_far')}</span>
                </div>
             ) : (
                <div className="flex items-center justify-center py-2 bg-green-50 rounded-lg text-green-700 text-xs font-bold border border-green-100">
                    <Shield className="w-3 h-3 mr-2" />
                    {t('thanks_vote')}
                </div>
             )
          )}
        </div>
      )}
    </div>
  );
};