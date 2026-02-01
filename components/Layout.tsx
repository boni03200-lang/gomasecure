
import React, { useState, useEffect } from 'react';
import { TabView, UserRole } from '../types';
import { Map, List, Plus, User, AlertTriangle, Bell, Maximize, Minimize } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
  userRole?: UserRole;
  unreadCount?: number;
  onNotificationClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, onTabChange, userRole, unreadCount = 0, onNotificationClick
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((e) => console.log(e));
      } else {
          document.exitFullscreen();
      }
  };

  return (
    // Use 100dvh (Dynamic Viewport Height) for mobile browser address bar handling
    <div className="flex flex-col h-[100dvh] w-full bg-gray-50 relative font-sans overflow-hidden">
      <header className="absolute top-0 left-0 right-0 h-auto pt-[calc(1rem+env(safe-area-inset-top))] pb-2 px-4 z-[401] flex items-center justify-between pointer-events-none">
         <div className="pointer-events-auto bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg border border-gray-200 flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">GS</div>
            <span className="font-bold text-gray-800 text-sm pr-2">GomaSecure</span>
         </div>
         
         <div className="flex items-center space-x-2 pointer-events-auto">
             {/* Notification Bell */}
             <button 
                onClick={onNotificationClick}
                className="bg-white/90 w-10 h-10 rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 active:scale-95 transition-all hover:bg-gray-50 relative"
             >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                    </span>
                )}
             </button>

             <button 
                onClick={toggleFullscreen}
                className="hidden md:flex bg-white/90 w-10 h-10 rounded-full shadow-lg border border-gray-200 items-center justify-center text-gray-700 active:scale-95 transition-all hover:bg-gray-50"
             >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
             </button>
         </div>
      </header>

      {/* Main Content - Padded bottom to account for nav bar */}
      <main className="flex-1 w-full h-full pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</main>

      {/* Bottom Navigation with Safe Area Support */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] z-[402] shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center h-16 px-6">
          <NavButton active={activeTab === 'MAP'} onClick={() => onTabChange('MAP')} icon={<Map />} label={t('tab_map')} />
          <NavButton active={activeTab === 'LIST'} onClick={() => onTabChange('LIST')} icon={<List />} label={t('tab_list')} />
          
          <div className="relative -top-6">
             <button onClick={() => onTabChange('REPORT')} className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-blue-500/40 shadow-xl text-white border-[4px] border-gray-50 active:scale-95 transition-transform">
               <Plus className="w-8 h-8" />
             </button>
          </div>

          <NavButton active={activeTab === 'SOS'} onClick={() => onTabChange('SOS')} icon={<AlertTriangle />} label="SOS" isAlert />
          <NavButton active={activeTab === 'PROFILE'} onClick={() => onTabChange('PROFILE')} icon={<User />} label={t('tab_profile')} />
        </div>
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label, isAlert }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center w-12 ${active ? (isAlert ? 'text-red-600' : 'text-blue-600') : 'text-gray-400'} active:scale-90 transition-transform`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-bold mt-1">{label}</span>
  </button>
);
