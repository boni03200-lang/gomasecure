
import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, ArrowDown } from 'lucide-react';

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. Check if already installed (Standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // 2. Detect iOS Device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Capture Android Install Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
        setShowIOSInstructions(true);
    } else if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    }
  };

  // If already installed, hide button
  if (isInstalled) return null;
  
  // If not Android prompt AND not iOS, hide button (Desktop/Unsupported)
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <div className="mt-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mobile</span>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">Application</span>
          </div>
          <button
          onClick={handleInstallClick}
          className="w-full bg-gradient-to-r from-gray-800 to-gray-900 hover:from-black hover:to-black text-white py-4 px-6 rounded-2xl flex items-center justify-center space-x-4 transition-all active:scale-95 border border-gray-700 shadow-xl group"
          >
          <div className="bg-gray-700 p-2 rounded-lg group-hover:bg-gray-600 transition-colors">
              <Smartphone className="w-6 h-6 text-blue-400" />
          </div>
          <div className="text-left flex-1">
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                  {isIOS ? 'Disponible sur iOS' : 'Disponible sur Android'}
              </div>
              <div className="font-bold text-sm">Installer l'Application</div>
          </div>
          <Download className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
          </button>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 relative overflow-hidden">
                <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                    <X className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                        <Smartphone className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Installer sur iPhone</h3>
                    <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                        Apple nécessite une installation manuelle. Suivez ces 2 étapes simples :
                    </p>
                    
                    <div className="w-full space-y-4 text-left">
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm mr-3 flex-shrink-0">
                                <Share className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-bold text-gray-700">1. Appuyez sur le bouton "Partager" en bas de votre navigateur.</span>
                        </div>
                        <div className="flex items-center justify-center">
                             <ArrowDown className="w-5 h-5 text-gray-300" />
                        </div>
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 shadow-sm mr-3 flex-shrink-0">
                                <PlusSquare className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-bold text-gray-700">2. Sélectionnez "Sur l'écran d'accueil" dans le menu.</span>
                        </div>
                    </div>

                    <div className="mt-6 text-[10px] text-gray-400 font-medium bg-gray-50 px-3 py-2 rounded-lg">
                        L'application apparaîtra ensuite sur votre écran comme une application native.
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
