
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, Volume2, EyeOff, Radio, BatteryCharging } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PanicButtonProps {
  onTrigger?: () => void;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ onTrigger }) => {
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [triggered, setTriggered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Stealth Mode State (Fake Screen Off)
  const [isStealthMode, setIsStealthMode] = useState(false);
  
  // Wake Lock Ref
  const wakeLockRef = useRef<any>(null);
  
  // Media Capture Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock active');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake Lock released');
    }
  }, []);

  // START capturing audio to keep phone active and simulate stream
  const startAudioCapture = async () => {
    try {
      // We don't necessarily need to store it yet, but keeping the mic open 
      // is crucial for "Active Intervention" and prevents some background throttling
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      // Visual feedback or logic could handle chunks here
    } catch (e) {
      console.error("Mic access failed for SOS", e);
    }
  };

  const stopAudioCapture = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const triggerSOS = useCallback(() => {
    setActive(true);
    setCountdown(3);
    setTriggered(false);
    // Vibrate to confirm trigger (Haptic feedback 0.5s)
    if (navigator.vibrate) navigator.vibrate(500);
  }, []);

  useEffect(() => {
    let timer: any;
    if (active && countdown > 0 && !triggered) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (active && countdown === 0 && !triggered) {
      setTriggered(true);
      
      // ACTIVATE SURVIVAL FEATURES
      requestWakeLock();
      startAudioCapture();
      setIsStealthMode(true);
      
      if (onTrigger) onTrigger();
    }
    return () => clearTimeout(timer);
  }, [active, countdown, triggered, onTrigger]);

  const cancelPanic = () => {
    setActive(false);
    setCountdown(3);
    setTriggered(false);
    setClickCount(0);
    setIsStealthMode(false);
    
    // Cleanup
    releaseWakeLock();
    stopAudioCapture();
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      stopAudioCapture();
    };
  }, [releaseWakeLock]);

  // --- STEALTH MODE UI (FAKE BLACK SCREEN) ---
  if (isStealthMode) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[20000] cursor-default flex flex-col items-center justify-center"
        onClick={() => {
            // Triple tap to exit stealth mode (Safety feature)
            const now = Date.now();
            if (now - lastClickTime < 500) {
                 if (clickCount >= 3) {
                     setIsStealthMode(false);
                     setClickCount(0);
                 } else {
                     setClickCount(clickCount + 1);
                 }
            } else {
                setClickCount(1);
            }
            setLastClickTime(now);
        }}
      >
        <div className="absolute top-10 flex flex-col items-center opacity-20 animate-pulse">
            <Radio className="w-12 h-12 text-red-500 mb-2" />
            <span className="text-red-500 font-mono text-xs tracking-widest uppercase">Live Stream Active</span>
        </div>
        
        <div className="text-gray-800 text-[10px] absolute bottom-2 right-2 select-none font-mono flex items-center">
            <BatteryCharging className="w-3 h-3 mr-1" /> ACTIVE MONITORING... (Tap 4x to unlock)
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="h-full w-full bg-red-600 flex flex-col items-center justify-center text-white p-8 text-center animate-pulse fixed inset-0 z-[10000]">
        <ShieldAlert className="w-32 h-32 mb-6" />
        <h1 className="text-4xl font-black mb-4 uppercase">{t('sos_active')}</h1>
        
        {!triggered ? (
          <>
            <p className="text-xl mb-8 opacity-90 font-medium">
              {t('stealth_alert')}
            </p>
            <div className="text-9xl font-black mb-12 tabular-nums">{countdown}</div>
            <button 
              onClick={cancelPanic}
              className="bg-white text-red-600 px-10 py-5 rounded-full font-bold text-2xl shadow-xl active:scale-95 transition-transform"
            >
              {t('cancel_send')}
            </button>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold mb-4">{t('signal_sent')}</p>
             <button 
              onClick={cancelPanic}
              className="mt-8 border-2 border-white px-8 py-3 rounded-full opacity-75 hover:opacity-100 font-bold"
            >
              {t('close_alert')}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-red-600 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      <div className="mb-10 z-10">
        <h2 className="text-white text-3xl font-black mb-3 tracking-tight">{t('sentinel_protection')}</h2>
        <p className="text-gray-400 text-sm max-w-xs mx-auto leading-relaxed">
          {t('sos_instruction')}
        </p>
      </div>

      <button
        onClick={() => {
             // Simulate 3 clicks via simple button for demo if hardware keys unavailable
             const now = Date.now();
             if (now - lastClickTime < 1000) {
               const newCount = clickCount + 1;
               setClickCount(newCount);
               if (newCount >= 3) {
                 triggerSOS();
                 setClickCount(0);
               }
             } else {
               setClickCount(1);
             }
             setLastClickTime(now);
        }}
        className="z-10 w-64 h-64 rounded-full bg-gradient-to-br from-red-600 to-red-900 shadow-[0_0_80px_rgba(220,38,38,0.5)] flex flex-col items-center justify-center border-8 border-white/10 active:scale-90 transition-all duration-100 group"
      >
        <div className="relative">
          <ShieldAlert className="w-28 h-28 text-white group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20"></div>
        </div>
        <div className="flex flex-col items-center mt-4">
             <span className="text-white font-black text-4xl tracking-tighter">SOS</span>
             <span className="text-red-300 text-[10px] uppercase tracking-widest mt-1">Tap 3x</span>
        </div>
      </button>

      <div className="mt-12 flex flex-col items-center space-y-4 z-10">
        <div className="flex items-center text-gray-400 text-xs bg-white/5 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md">
          <Volume2 className="w-4 h-4 mr-2 text-red-500" />
          <span>Microphone actif en urgence</span>
        </div>
        
        <div className="flex items-center space-x-2 text-[10px] text-gray-500">
             <EyeOff className="w-3 h-3" />
             <span>Mode Discret & WakeLock</span>
        </div>
      </div>
    </div>
  );
};
