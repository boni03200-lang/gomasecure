import React from 'react';
import { Notification, NotificationType } from '../types';
import { X, Bell, CheckCircle2, AlertTriangle, Info, Check, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (incidentId: string) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen, onClose, notifications, onMarkRead, onMarkAllRead, onNavigate
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleNotificationClick = (notif: Notification) => {
    onMarkRead(notif.id);
    if (notif.relatedIncidentId) {
        onNavigate(notif.relatedIncidentId);
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.ALERT: return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case NotificationType.ACTION: return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (type: NotificationType, read: boolean) => {
    if (read) return 'bg-white';
    switch (type) {
      case NotificationType.ALERT: return 'bg-red-50 border-red-100';
      case NotificationType.ACTION: return 'bg-green-50 border-green-100';
      default: return 'bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex justify-end pointer-events-none">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      
      <div className="w-full max-w-sm h-full bg-white shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-gray-700 mr-2" />
            <h2 className="font-bold text-lg text-gray-900">{t('notifications')}</h2>
            <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {notifications.filter(n => !n.read).length}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Bell className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-medium">{t('no_notif')}</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${getBgColor(notif.type, notif.read)} ${notif.read ? 'border-transparent' : 'shadow-sm hover:shadow-md'}`}
              >
                {!notif.read && (
                   <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full"></div>
                )}
                <div className="flex items-start">
                   <div className={`mt-0.5 p-2 rounded-full ${notif.read ? 'bg-gray-100' : 'bg-white'}`}>
                      {getIcon(notif.type)}
                   </div>
                   <div className="ml-3 flex-1">
                      <h4 className={`text-sm font-bold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</h4>
                      <p className={`text-xs mt-1 leading-relaxed ${notif.read ? 'text-gray-500' : 'text-gray-700'}`}>{notif.message}</p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400 block font-medium">
                            {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: fr })}
                        </span>
                        {notif.relatedIncidentId && (
                            <span className="flex items-center text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                Voir <ArrowRight className="w-3 h-3 ml-1" />
                            </span>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <button 
            onClick={onMarkAllRead}
            disabled={notifications.every(n => n.read)}
            className="w-full py-3 flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            <span>{t('mark_all_read')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};