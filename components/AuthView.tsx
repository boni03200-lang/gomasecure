import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck, Loader2, Info, X, Phone } from 'lucide-react';
import { db } from '../services/supabase'; // CHANGED
import { User } from '../types';

interface AuthViewProps {
  onLogin: (user: User) => void;
  showToast?: (msg: string, type: 'success' | 'error') => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin, showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let user;
      if (isLogin) {
        user = await db.login(email, password);
      } else {
        user = await db.register(email, password, name, phone);
      }
      if (showToast) showToast(`Bienvenue, ${user.displayName}!`, 'success');
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Identifiants invalides ou erreur de connexion.');
      if (showToast) showToast('Erreur de connexion', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (e: string, p: string) => {
      setEmail(e);
      setPassword(p);
      setShowDemoModal(false);
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                    type="text" 
                    placeholder="Nom complet"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required={!isLogin}
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
                    required={!isLogin}
                    />
                </div>
              </>
            )}
            
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

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="password" 
                placeholder="Mot de passe"
                className="w-full bg-black/20 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs text-center font-bold">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? 'Se connecter' : 'Créer un compte'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center space-y-4">
            <button 
              onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
              }}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>

            {isLogin && (
                <button 
                    onClick={() => setShowDemoModal(true)}
                    className="flex items-center text-xs font-bold text-blue-300 hover:text-blue-200 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                >
                    <Info className="w-3 h-3 mr-1.5" />
                    Afficher les comptes démo
                </button>
            )}
          </div>
        </div>
      </div>

      {/* DEMO ACCOUNTS POPUP MODAL */}
      {showDemoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                  <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center">
                          <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                          Comptes de Démonstration
                      </h3>
                      <button onClick={() => setShowDemoModal(false)} className="p-1 hover:bg-gray-200 rounded-full">
                          <X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  <div className="p-4 space-y-3">
                      <p className="text-xs text-gray-500 mb-2">Assurez-vous d'avoir créé ces comptes dans Supabase Auth.</p>
                      
                       <button 
                         onClick={() => fillDemo('mama@goma.cd', 'password')}
                         className="w-full flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors text-left border border-blue-100 group"
                       >
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mr-3 font-bold group-hover:bg-white">S</div>
                          <div>
                              <div className="font-bold text-gray-900">Sentinelle</div>
                              <div className="text-xs text-gray-500">mama@goma.cd</div>
                          </div>
                       </button>

                       <button 
                         onClick={() => fillDemo('jean@goma.cd', 'password')}
                         className="w-full flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-xl transition-colors text-left border border-green-100 group"
                       >
                          <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mr-3 font-bold group-hover:bg-white">C</div>
                          <div>
                              <div className="font-bold text-gray-900">Citoyen</div>
                              <div className="text-xs text-gray-500">jean@goma.cd</div>
                          </div>
                       </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};