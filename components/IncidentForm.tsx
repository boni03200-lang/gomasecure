
import React, { useState, useRef, useEffect } from 'react';
import { IncidentType } from '../types';
import { Camera, MapPin, Mic, StopCircle, Trash2, Play, Pause, Loader2, X, FolderOpen, RefreshCw, AlertTriangle, Flame, Wallet, Skull, Car, UserMinus, HelpCircle, Siren, FileAudio, Video } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface IncidentFormProps {
  onSubmit: (data: { type: IncidentType; description: string; media?: File }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
}

const MAX_RECORDING_TIME = 30; // 30s limit

export const IncidentForm: React.FC<IncidentFormProps> = ({ onSubmit, onCancel, isSubmitting, userLocation }) => {
  const { t } = useLanguage();
  const [type, setType] = useState<IncidentType>(IncidentType.VOL);
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>("Chargement de l'adresse...");
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'PHOTO' | 'VIDEO'>('PHOTO');
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
        audioPlayerRef.current = null;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); 

  // Address lookup effect
  useEffect(() => {
    if (userLocation) {
        const fetchAddress = async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}&zoom=18&addressdetails=1`);
                if (response.ok) {
                    const data = await response.json();
                    setResolvedAddress(data.display_name || "Adresse inconnue");
                }
            } catch (e) {
                setResolvedAddress("Emplacement GPS (Hors ligne)");
            }
        };
        fetchAddress();
    } else {
        setResolvedAddress("Recherche GPS...");
    }
  }, [userLocation]);

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, isCameraOpen]);

  useEffect(() => {
    if ((isRecording || isVideoRecording) && recordingTime >= MAX_RECORDING_TIME) {
      if (isRecording) stopRecording();
      if (isVideoRecording) stopVideoRecording();
    }
  }, [recordingTime, isRecording, isVideoRecording]);

  const handleMediaSelect = (file: File) => {
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setRecordingTime(0);

    setMedia(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    setIsCameraOpen(false);
    stopCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleMediaSelect(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioFile = new File([blob], `voice_note.${ext}`, { type: mimeType });
        handleMediaSelect(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert("Impossible d'accéder au micro. Vérifiez les permissions.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };
  
  const startCamera = async () => {
    try {
      stopCamera();
      const constraints = { 
        video: { facingMode: facingMode },
        audio: true 
      };
      
      let stream;
      try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
          console.warn("Audio permission failed for camera, trying video only");
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
      }

      setCameraStream(stream);
      setIsCameraOpen(true);
      setCameraMode('PHOTO');
    } catch (err) {
      alert("Impossible d'accéder à la caméra.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setIsVideoRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    setTimeout(() => startCamera(), 100); 
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "captured_photo.jpg", { type: "image/jpeg" });
            handleMediaSelect(file);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const startVideoRecording = () => {
      if (!cameraStream) return;
      
      const recorder = new MediaRecorder(cameraStream);
      videoRecorderRef.current = recorder;
      videoChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'video/webm';
          const blob = new Blob(videoChunksRef.current, { type: mimeType });
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const file = new File([blob], `captured_video.${ext}`, { type: mimeType });
          handleMediaSelect(file);
      };
      
      recorder.start();
      setIsVideoRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
  };

  const stopVideoRecording = () => {
      if (videoRecorderRef.current && isVideoRecording) {
          videoRecorderRef.current.stop();
          setIsVideoRecording(false);
          clearInterval(timerRef.current);
      }
  };

  const handleCameraTrigger = () => {
      if (cameraMode === 'PHOTO') {
          takePhoto();
      } else {
          if (isVideoRecording) {
              stopVideoRecording();
          } else {
              startVideoRecording();
          }
      }
  };

  const deleteMedia = () => {
    setMedia(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordingTime(0);
    if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
    }
    setIsPlaying(false);
  }

  const togglePlayAudio = () => {
    if (!previewUrl) return;

    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(previewUrl);
      audioPlayerRef.current.onended = () => setIsPlaying(false);
      audioPlayerRef.current.onerror = (e) => {
          console.error("Audio playback error", e);
          setIsPlaying(false);
          alert("Erreur de lecture audio.");
      };
    }

    if (audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(e => {
                console.error("Play failed", e);
                setIsPlaying(false);
            });
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description && !media) return;
    onSubmit({ type, description, media: media || undefined });
  };

  const getIconForType = (t: IncidentType) => {
    switch(t) {
      case IncidentType.VOL: return <Wallet className="w-5 h-5" />;
      case IncidentType.AGRESSION: return <Skull className="w-5 h-5" />;
      case IncidentType.INCENDIE: return <Flame className="w-5 h-5" />;
      case IncidentType.ACCIDENT: return <Car className="w-5 h-5" />;
      case IncidentType.ENLEVEMENT: return <UserMinus className="w-5 h-5" />;
      case IncidentType.SOS: return <Siren className="w-5 h-5" />;
      case IncidentType.AUTRE: return <HelpCircle className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const renderCameraInterface = () => (
    <div className="fixed inset-0 bg-black z-[3000] flex flex-col">
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
        <canvas ref={canvasRef} className="hidden" />
        
        {isVideoRecording && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-red-600/80 px-4 py-1 rounded-full text-white font-mono font-bold animate-pulse">
                {formatTime(recordingTime)}
            </div>
        )}

        <button onClick={stopCamera} className="absolute top-4 right-4 p-3 bg-black/40 text-white rounded-full backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="bg-black flex flex-col items-center pb-8 pt-4">
         {!isVideoRecording && (
             <div className="flex space-x-6 mb-6 text-sm font-bold uppercase tracking-wider">
                 <button 
                    onClick={() => setCameraMode('PHOTO')}
                    className={`${cameraMode === 'PHOTO' ? 'text-yellow-400 scale-110' : 'text-gray-500'} transition-all`}
                 >
                    Photo
                 </button>
                 <button 
                    onClick={() => setCameraMode('VIDEO')}
                    className={`${cameraMode === 'VIDEO' ? 'text-yellow-400 scale-110' : 'text-gray-500'} transition-all`}
                 >
                    Vidéo
                 </button>
             </div>
         )}

         <div className="flex items-center justify-around w-full px-8">
            <div className="w-12"></div>
            <button 
                onClick={handleCameraTrigger} 
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                    cameraMode === 'VIDEO' 
                        ? (isVideoRecording ? 'border-red-500 bg-red-900/50' : 'border-white bg-white/20')
                        : 'border-white bg-white/20'
                } active:scale-95`}
            >
                <div className={`rounded-full transition-all ${
                    cameraMode === 'VIDEO'
                        ? (isVideoRecording ? 'w-8 h-8 bg-red-600 rounded-sm' : 'w-16 h-16 bg-red-600')
                        : 'w-16 h-16 bg-white'
                }`}></div>
            </button>
            
            {!isVideoRecording ? (
                 <button onClick={switchCamera} className="p-4 rounded-full bg-gray-800 text-white"><RefreshCw className="w-6 h-6" /></button>
            ) : (
                <div className="w-12"></div>
            )}
         </div>
      </div>
    </div>
  );

  const isAudioMedia = media?.type.startsWith('audio');

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {isCameraOpen && renderCameraInterface()}

      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-4 shadow-sm z-10 border-b border-gray-100 flex items-center justify-between">
         <div className="w-full">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">{t('new_report')}</h2>
            <div className="flex items-start text-xs font-medium text-blue-600 mt-1 max-w-[85%]">
              <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
              {userLocation ? (
                <div className="flex flex-col">
                    <span className="font-bold">{resolvedAddress}</span>
                    <span className="text-gray-400 text-[10px]">
                        {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} (±{Math.round(userLocation.accuracy || 0)}m)
                    </span>
                </div>
              ) : (
                 <span className="animate-pulse">{t('gps_pending')}</span>
              )}
            </div>
         </div>
         <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-6 space-y-6 pb-32">
        {/* Incident Types Grid */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{t('report_type')}</label>
          <div className="grid grid-cols-3 gap-3">
            {Object.values(IncidentType).map((tVal) => (
              <button
                key={tVal}
                type="button"
                onClick={() => setType(tVal)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl text-[10px] font-bold transition-all shadow-sm aspect-[4/3] border ${
                  type === tVal
                    ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200 ring-2 ring-blue-500 ring-offset-2'
                    : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-full mb-2 flex items-center justify-center ${type === tVal ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                   {getIconForType(tVal)}
                </div>
                {t(tVal)}
              </button>
            ))}
          </div>
        </div>

        {/* Media Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{t('proofs')}</label>
          
          {!media && !isRecording && (
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    type="button"
                    onClick={startRecording}
                    className="col-span-2 py-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl shadow-lg shadow-orange-100 flex flex-col items-center justify-center text-white active:scale-95 transition-transform"
                 >
                    <Mic className="w-8 h-8 mb-2" />
                    <span className="font-bold text-sm uppercase tracking-wide">{t('vocal')}</span>
                 </button>
                 
                 <button type="button" onClick={startCamera} className="p-4 bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
                    <Camera className="w-6 h-6 mb-2 text-blue-500" />
                    <span className="text-[10px] font-bold">Caméra</span>
                 </button>

                 <label className="p-4 bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer">
                    <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleFileChange} />
                    <FolderOpen className="w-6 h-6 mb-2 text-green-500" />
                    <span className="text-[10px] font-bold">{t('gallery')}</span>
                 </label>
             </div>
          )}

          {isRecording && (
             <button type="button" onClick={stopRecording} className="w-full py-8 bg-red-50 border-2 border-red-500 rounded-2xl flex flex-col items-center justify-center animate-pulse">
                <StopCircle className="w-12 h-12 text-red-600 mb-2" />
                <div className="flex items-center space-x-1">
                   <span className="text-2xl font-black text-red-600 font-mono">{formatTime(recordingTime)}</span>
                   <span className="text-xs text-red-400 font-bold">/ {formatTime(MAX_RECORDING_TIME)}</span>
                </div>
                <span className="text-xs font-bold text-red-400 mt-1 uppercase">{t('tap_to_stop')}</span>
             </button>
          )}

          {media && (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm">
                  {isAudioMedia ? (
                      <div className="p-4 flex items-center justify-between bg-white">
                         <div className="flex items-center">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mr-3">
                                <FileAudio className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="mr-3">
                                <div className="text-xs font-bold text-gray-800">Fichier Audio</div>
                                <div className="text-[10px] text-gray-500 uppercase">{media.name.substring(0, 15)}...</div>
                            </div>
                         </div>
                         <div className="flex items-center space-x-2">
                             <button 
                                 type="button" 
                                 onClick={togglePlayAudio} 
                                 className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors shadow-blue-200 shadow-lg"
                             >
                                 {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                             </button>
                             <button type="button" onClick={deleteMedia} className="p-3 text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-4 h-4"/></button>
                         </div>
                      </div>
                  ) : (
                      <>
                        {media.type.startsWith('video') ? (
                            <video src={previewUrl!} className="w-full max-h-60 object-cover" controls />
                        ) : (
                            <img src={previewUrl!} className="w-full max-h-60 object-cover" />
                        )}
                        <button type="button" onClick={deleteMedia} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors"><Trash2 className="w-4 h-4"/></button>
                      </>
                  )}
              </div>
          )}
        </div>

        {/* Text Details */}
        <div className="space-y-3">
           <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">{t('details')}</label>
           <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none min-h-[100px] text-sm"
            placeholder={t('details_placeholder')}
          />
        </div>
      </form>

      {/* Footer Submit */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-white border-t border-gray-100 z-20">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !userLocation || (!description && !media)}
          className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-black disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center"
        >
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : t('send_report')}
        </button>
      </div>
    </div>
  );
};
