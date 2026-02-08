
import React, { useState, useEffect } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Loader2, Phone, MapPin, ArrowLeft, KeyRound, CheckCircle } from 'lucide-react';
import { db } from '../services/supabase';
import { User } from '../types';
import { InstallPWA } from './InstallPWA';
import { shouldSuppressError } from '../utils/error';
import { GOMA_COMMUNES } from '../constants';

interface AuthViewProps {
  onLogin: (user: User) => void;
  showToast?: (msg: string, type: 'success' | 'error') => void;
  isPasswordRecovery?: boolean;
  onPasswordResetSuccess?: () => void;
}

type AuthViewMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'UPDATE_PASSWORD';

export const AuthView: React.FC<AuthViewProps> = ({ onLogin, showToast, isPasswordRecovery, onPasswordResetSuccess }) => {
  const [viewMode, setViewMode] = useState<AuthViewMode>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [quartier, setQuartier] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle Prop-Driven Mode Change (e.g., detected recovery link)
  useEffect(() => {
    if (isPasswordRecovery) {
      setViewMode('UPDATE_PASSWORD');
      setError('');
      setSuccessMessage('');
    }
  }, [isPasswordRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (viewMode === 'LOGIN') {
        const user = await db.login(email, password);
        if (showToast) showToast(`Bienvenue, ${user.displayName}!`, 'success');
        onLogin(user);
      } 
      else if (viewMode === 'REGISTER') {
        if (!quartier) {
             throw new Error("Veuillez sélectionner votre quartier de résidence.");
        }
        const user = await db.register(email, password, name, phone, quartier);
        if (showToast) showToast(`Compte créé avec succès!`, 'success');
        onLogin(user);
      }
      else if (viewMode === 'FORGOT_PASSWORD') {
         if (!email) throw new Error("Veuillez entrer votre adresse email.");
         await db.resetPassword(email);
         setSuccessMessage("Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.");
         if (showToast) showToast('Demande traitée', 'success');
      }
      else if (viewMode === 'UPDATE_PASSWORD') {
         if (password !== confirmPassword) throw new Error("Les mots de passe ne correspondent pas.");
         if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
         
         await db.updatePassword(password);
         if (showToast) showToast('Mot de passe mis à jour avec succès.', 'success');
         if (onPasswordResetSuccess) onPasswordResetSuccess();
         setViewMode('LOGIN'); 
      }
    } catch (err: any) {
      if (!shouldSuppressError(err)) {
        console.error(err);
        setError(err.message || 'Une erreur est survenue.');
        if (showToast) showToast(err.message || 'Erreur', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (mode: AuthViewMode) => {
      setViewMode(mode);
      setError('');
      setSuccessMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 w-full h-full bg-red-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden z-10">
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">GomaSecure</h1>
            <p className="text-blue-200 text-sm font-medium">Vigilance Communautaire</p>
          </div>

          {viewMode === 'FORGOT_PASSWORD' && (
              <div className="mb-6 text-center">
                  <h2 className="text-xl font-bold text-white mb-2">Réinitialisation</h2>
                  <p className="text-xs text-gray-300">Entrez votre email pour recevoir un lien de réinitialisation de mot de passe.</p>
              </div>
          )}

          {viewMode === 'UPDATE_PASSWORD' && (
              <div className="mb-6 text-center">
                  <h2 className="text-xl font-bold text-white mb-2">Nouveau Mot de Passe</h2>
                  <p className="text-xs text-gray-300">Veuillez définir votre nouveau mot de passe sécurisé.</p>
              </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {viewMode === 'REGISTER' && (
              <>
                <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                    type="text" 
                    placeholder="Nom complet"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    />
                </div>

                <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                    type="tel" 
                    placeholder="Numéro de téléphone (+243...)"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    />
                </div>

                <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                        value={quartier}
                        onChange={e => setQuartier(e.target.value)}
                        required
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                    >
                        <option value="" disabled className="text-gray-500 bg-gray-900">Sélectionner votre quartier</option>
                        {Object.entries(GOMA_COMMUNES).map(([commune, quartiers]) => (
                            <optgroup key={commune} label={commune} className="bg-gray-900 text-gray-400 font-bold">
                                {quartiers.sort().map(q => (
                                    <option key={q} value={q} className="bg-gray-800 text-white pl-4">
                                        {q}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
              </>
            )}
            
            {(viewMode === 'LOGIN' || viewMode === 'REGISTER' || viewMode === 'FORGOT_PASSWORD') && (
                <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="email" 
                    placeholder="Adresse email"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                />
                </div>
            )}

            {(viewMode === 'LOGIN' || viewMode === 'REGISTER' || viewMode === 'UPDATE_PASSWORD') && (
                <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="password" 
                    placeholder={viewMode === 'UPDATE_PASSWORD' ? "Nouveau mot de passe" : "Mot de passe"}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                </div>
            )}

            {viewMode === 'UPDATE_PASSWORD' && (
                <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                    type="password" 
                    placeholder="Confirmer mot de passe"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                />
                </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs text-center font-bold">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-xs text-center font-bold flex flex-col items-center justify-center">
                <div className="flex items-center mb-1">
                   <CheckCircle className="w-4 h-4 mr-2" /> Demande Envoyée
                </div>
                <span className="text-[10px] text-green-300 font-normal">{successMessage}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {viewMode === 'LOGIN' && 'Se connecter'}
                  {viewMode === 'REGISTER' && 'Créer un compte'}
                  {viewMode === 'FORGOT_PASSWORD' && 'Envoyer le lien'}
                  {viewMode === 'UPDATE_PASSWORD' && 'Mettre à jour'}
                  {viewMode !== 'FORGOT_PASSWORD' && viewMode !== 'UPDATE_PASSWORD' && <ArrowRight className="w-5 h-5 ml-2" />}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center space-y-3">
             {viewMode === 'LOGIN' && (
                 <>
                    <button 
                        onClick={() => switchMode('FORGOT_PASSWORD')}
                        className="text-blue-300 hover:text-white text-xs font-medium transition-colors flex items-center"
                    >
                        <KeyRound className="w-3 h-3 mr-1.5" /> Mot de passe oublié ?
                    </button>
                    <button 
                        onClick={() => switchMode('REGISTER')}
                        className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Pas encore de compte ? S'inscrire
                    </button>
                 </>
             )}

             {viewMode === 'REGISTER' && (
                 <button 
                    onClick={() => switchMode('LOGIN')}
                    className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                    Déjà un compte ? Se connecter
                </button>
             )}

             {(viewMode === 'FORGOT_PASSWORD' || viewMode === 'UPDATE_PASSWORD') && (
                 <button 
                    onClick={() => switchMode('LOGIN')}
                    className="text-gray-400 hover:text-white text-sm font-medium transition-colors flex items-center"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la connexion
                </button>
             )}
          </div>

          <InstallPWA />

        </div>
      </div>
    </div>
  );
};
