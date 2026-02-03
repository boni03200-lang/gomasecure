
import { createClient } from '@supabase/supabase-js';
import { Incident, IncidentStatus, IncidentType, User, UserRole, UserStatus, Notification, NotificationType, ActivityLog, ActivityAction } from '../types';
import { GOMA_CENTER } from '../constants';

/* 
   === SUPABASE SQL SETUP INSTRUCTIONS ===
   Run this SQL in your Supabase SQL Editor to create the required tables:

   -- 1. Enable RLS (Row Level Security) is recommended but for this demo we'll keep it open or you can configure policies.
   
   -- 2. Create Users Table
   create table public.users (
     uid uuid references auth.users not null primary key,
     display_name text,
     email text,
     phone text,
     role text default 'CITOYEN',
     status text default 'ACTIF',
     reputation_score int default 50,
     joined_at bigint,
     quartier text
   );

   -- 3. Create Incidents Table
   create table public.incidents (
     id uuid default gen_random_uuid() primary key,
     type text not null,
     description text,
     location jsonb not null, -- Stores {lat: number, lng: number}
     address text,
     timestamp bigint,
     reporter_id uuid references public.users(uid),
     media_url text,
     media_type text,
     status text default 'EN_ATTENTE',
     validated_by uuid references public.users(uid),
     likes text[] default '{}',
     dislikes text[] default '{}',
     reliability_score int default 50,
     report_count int default 1,
     reporters text[] default '{}'
   );

   -- 4. Create Notifications Table
   create table public.notifications (
     id uuid default gen_random_uuid() primary key,
     user_id text, -- 'ALL' or uuid
     title text,
     message text,
     type text,
     read boolean default false,
     timestamp bigint,
     related_incident_id uuid references public.incidents(id)
   );

   -- 5. Create Activity Logs Table
   create table public.activity_logs (
     id uuid default gen_random_uuid() primary key,
     user_id uuid references public.users(uid),
     action text,
     details text,
     timestamp bigint,
     target_id text
   );

   -- 6. Storage Bucket
   -- Go to Storage > Create a new bucket named 'evidence' and make it Public.
*/

// --- ENVIRONMENT CONFIG ---
const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {}
  
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const isValidConfig = supabaseUrl && supabaseAnonKey;
if (!isValidConfig) {
  console.warn("⚠️ Supabase Credentials missing or invalid. App is running in fallback mode.");
  console.warn("Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or Vercel project settings.");
}

// Export the real client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

// --- UTILS ---
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        if (!response.ok) return "Adresse inconnue";
        const data = await response.json();
        
        const addr = data.address;
        if (!addr) return "Emplacement GPS";

        const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || "";
        const city = addr.city || addr.town || addr.village || "";
        
        if (street && city) return `${street}, ${city}`;
        if (street) return street;
        if (city) return city;
        return data.display_name?.split(',')[0] || "Emplacement GPS";
    } catch (e) {
        console.warn("Geocoding failed", e);
        return "Emplacement GPS (Hors ligne)";
    }
}

// --- INTERFACE ---
interface DatabaseService {
  login(email: string, password?: string): Promise<User>;
  register(email: string, password: string, name: string, phone: string): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(uid: string, role: UserRole): Promise<void>;
  updateUserStatus(uid: string, status: UserStatus): Promise<void>;
  getUserActivity(uid: string): Promise<ActivityLog[]>;
  getIncidents(): Promise<Incident[]>;
  createIncident(incidentData: Partial<Incident>, user: User): Promise<Incident>;
  voteIncident(incidentId: string, userId: string, voteType: 'like' | 'dislike'): Promise<Incident>;
  updateIncidentStatus(incidentId: string, status: IncidentStatus, validatorId?: string): Promise<Incident>;
  updateIncidentLocation(incidentId: string, location: { lat: number; lng: number }): Promise<void>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notifId: string): Promise<void>;
  uploadMedia(file: File): Promise<string | null>;
  parseIncident(data: any): Incident;
  sendPromotionInvite(userId: string): Promise<void>;
}

// --- REAL SERVICE IMPLEMENTATION ---
class SupabaseService implements DatabaseService {

  // --- HELPER: LOGGING ---
  private async logActivity(userId: string, action: ActivityAction, details: string, targetId?: string) {
      if (!isValidConfig) return; // Skip if no config
      try {
          await supabase.from('activity_logs').insert({
              user_id: userId,
              action,
              details,
              timestamp: Date.now(),
              target_id: targetId
          });
      } catch (e) {
          console.error("Failed to log activity", e);
      }
  }

  // --- HELPER: REPUTATION SYSTEM ---
  private async updateUserReputation(userId: string, points: number, reason: string) {
      if (!isValidConfig || !userId) return;

      try {
          // 1. Get current score
          const { data: user, error } = await supabase.from('users').select('reputation_score').eq('uid', userId).single();
          if (error || !user) return;

          // 2. Calculate new score (Bounded 0 - 100)
          const currentScore = user.reputation_score || 50;
          const newScore = Math.max(0, Math.min(100, currentScore + points));

          if (newScore === currentScore) return;

          // 3. Update
          await supabase.from('users').update({ reputation_score: newScore }).eq('uid', userId);

          // 4. Log
          await this.logActivity(userId, 'PROFILE_UPDATE', `Réputation ${points > 0 ? '+' : ''}${points}: ${reason}`);

          // 5. Notify User
          await this.createNotification({
              userId,
              type: points > 0 ? NotificationType.INFO : NotificationType.ALERT,
              title: "Mise à jour Réputation",
              message: `Votre score de fiabilité a ${points > 0 ? 'augmenté' : 'diminué'} de ${Math.abs(points)} points. Motif: ${reason}`
          });

      } catch (e) {
          console.error("Failed to update reputation", e);
      }
  }

  // --- HELPER: VOTER REPUTATION BATCHING ---
  private async processVoterReputation(likes: string[], dislikes: string[], status: IncidentStatus) {
      if (!isValidConfig) return;
      
      const distinctLikes = [...new Set(likes)];
      const distinctDislikes = [...new Set(dislikes)];

      // Logic: Reward interaction that aligns with the final outcome
      if (status === IncidentStatus.VALIDE) {
          // Validated: Likers were right (+2), Dislikers were wrong (-2)
          await Promise.all([
              ...distinctLikes.map(uid => this.updateUserReputation(uid, 2, "Confirmation validée (Bon jugement)")),
              ...distinctDislikes.map(uid => this.updateUserReputation(uid, -2, "Démenti incorrect (Erreur de jugement)"))
          ]);
      } else if (status === IncidentStatus.REJETE) {
          // Rejected: Likers were wrong (-5), Dislikers were right (+5)
          // Penalty is higher for supporting fake news
          await Promise.all([
              ...distinctLikes.map(uid => this.updateUserReputation(uid, -5, "Soutien à une fausse information")),
              ...distinctDislikes.map(uid => this.updateUserReputation(uid, 5, "Vigilance confirmée (Fake news repérée)"))
          ]);
      }
  }

  // --- AUTH ---
  async login(email: string, password?: string): Promise<User> {
    if (!isValidConfig) throw new Error("Service indisponible (Configuration manquante)");
    if (!password) throw new Error("Mot de passe requis");
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Erreur utilisateur");

    const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', authData.user.id)
        .single();
    
    if (profileError || !userProfile) throw new Error("Profil introuvable");
    
    await this.logActivity(userProfile.uid, 'LOGIN', 'Connexion réussie');
    return this.mapUser(userProfile);
  }

  async register(email: string, password: string, name: string, phone: string): Promise<User> {
    if (!isValidConfig) throw new Error("Service indisponible (Configuration manquante)");
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Erreur création auth");

    const newUser: User = {
        uid: authData.user.id,
        displayName: name,
        email: email,
        phone: phone,
        role: email.includes('admin') ? UserRole.ADMINISTRATEUR : UserRole.CITOYEN,
        status: UserStatus.ACTIF,
        reputationScore: 50,
        joinedAt: Date.now()
    };

    const { error: dbError } = await supabase.from('users').insert({
        uid: newUser.uid,
        display_name: newUser.displayName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        status: newUser.status,
        reputation_score: newUser.reputationScore,
        joined_at: newUser.joinedAt
    });

    if (dbError) throw dbError;

    await this.logActivity(newUser.uid, 'REGISTER', 'Création de compte');
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
      if (!isValidConfig) return [];
      const { data } = await supabase.from('users').select('*');
      return (data || []).map(this.mapUser);
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
      if (!isValidConfig) return;
      await supabase.from('users').update({ role }).eq('uid', uid);
      await this.logActivity(uid, 'PROFILE_UPDATE', `Role: ${role}`);
  }

  async updateUserStatus(uid: string, status: UserStatus): Promise<void> {
      if (!isValidConfig) return;
      await supabase.from('users').update({ status }).eq('uid', uid);
      await this.logActivity(uid, 'PROFILE_UPDATE', `Statut: ${status}`);
  }

  async getUserActivity(uid: string): Promise<ActivityLog[]> {
      if (!isValidConfig) return [];
      const { data } = await supabase.from('activity_logs')
        .select('*')
        .eq('user_id', uid)
        .order('timestamp', { ascending: false });
      
      return (data || []).map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          action: row.action,
          details: row.details,
          timestamp: row.timestamp,
          targetId: row.target_id
      }));
  }

  // --- INCIDENTS ---
  async getIncidents(): Promise<Incident[]> {
      if (!isValidConfig) return [];
      const { data } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
      return (data || []).map(this.mapIncident);
  }

  async createIncident(incidentData: Partial<Incident>, user: User): Promise<Incident> {
      if (!isValidConfig) throw new Error("Service indisponible");
      const MERGE_RADIUS = 50; 
      const location = incidentData.location || GOMA_CENTER;
      const type = incidentData.type || IncidentType.AUTRE;
      
      const address = await reverseGeocode(location.lat, location.lng);

      // Merge Logic (unchanged)
      const { data: candidates } = await supabase
          .from('incidents')
          .select('*')
          .eq('type', type)
          .neq('status', IncidentStatus.RESOLU)
          .neq('status', IncidentStatus.REJETE);
      
      let mergeTarget = null;
      if (candidates) {
          for (const cand of candidates) {
               const dist = getDistanceFromLatLonInM(cand.location.lat, cand.location.lng, location.lat, location.lng);
               if (dist <= MERGE_RADIUS) {
                   mergeTarget = cand;
                   break;
               }
          }
      }

      if (mergeTarget) {
          const currentReporters = mergeTarget.reporters || [mergeTarget.reporter_id];
          if (!currentReporters.includes(user.uid)) {
              const updatedReporters = [...currentReporters, user.uid];
              const newCount = (mergeTarget.report_count || 1) + 1;
              const newScore = Math.min(100, (mergeTarget.reliability_score || 50) + 10);
              
              const { data: updated, error } = await supabase
                .from('incidents')
                .update({ 
                    report_count: newCount,
                    reporters: updatedReporters,
                    reliability_score: newScore,
                    timestamp: Date.now() 
                })
                .eq('id', mergeTarget.id)
                .select()
                .single();
              
              if (!error && updated) {
                  await this.logActivity(user.uid, 'REPORT', `Signalement fusionné: ${type}`, updated.id);
                  await this.createNotification({
                      userId: user.uid,
                      title: "Signalement Fusionné",
                      message: "Incident similaire détecté. Votre signalement renforce l'alerte.",
                      type: NotificationType.INFO,
                      relatedIncidentId: updated.id
                  });
                  return this.mapIncident(updated);
              }
          }
          return this.mapIncident(mergeTarget);
      }

      const isSentinel = user.role === UserRole.SENTINELLE;
      const initialStatus = isSentinel ? IncidentStatus.VALIDE : IncidentStatus.EN_ATTENTE;
      
      const newIncident = {
          type,
          description: incidentData.description,
          location: location, 
          address,
          timestamp: Date.now(),
          reporter_id: user.uid,
          status: initialStatus,
          validated_by: isSentinel ? user.uid : null,
          likes: [],
          dislikes: [],
          reliability_score: user.reputationScore, // INIT FROM CITIZEN REPUTATION
          media_url: incidentData.mediaUrl,
          media_type: incidentData.mediaType || 'image',
          report_count: 1,
          reporters: [user.uid]
      };

      const { data: created, error } = await supabase.from('incidents').insert(newIncident).select().single();
      
      if (error) {
          console.error("Create incident error", error);
          throw error;
      }

      const action = type === IncidentType.SOS ? 'SOS' : 'REPORT';
      await this.logActivity(user.uid, action, `Nouveau: ${type} à ${address}`, created.id);

      await this.createNotification({
          userId: 'ALL',
          title: isSentinel ? "Alerte Sentinelle" : "Nouvel Incident",
          message: `${type} signalé à ${address}`,
          type: isSentinel ? NotificationType.ALERT : NotificationType.ACTION,
          relatedIncidentId: created.id
      });
      
      // If sentinel created it, immediate reward
      if (isSentinel) {
          await this.updateUserReputation(user.uid, 5, "Signalement Sentinelle Validé");
      }

      return this.mapIncident(created);
  }

  async voteIncident(incidentId: string, userId: string, voteType: 'like' | 'dislike'): Promise<Incident> {
      if (!isValidConfig) throw new Error("Service indisponible");
      const { data: current } = await supabase.from('incidents').select('*').eq('id', incidentId).single();
      if (!current) throw new Error("Incident not found");

      let likes = current.likes || [];
      let dislikes = current.dislikes || [];
      let score = current.reliability_score;

      likes = likes.filter((id: string) => id !== userId);
      dislikes = dislikes.filter((id: string) => id !== userId);

      if (voteType === 'like') {
          likes.push(userId);
          score = Math.min(100, score + 10);
      } else {
          dislikes.push(userId);
          score = Math.max(0, score - 15);
      }

      let status = current.status;
      let validatedBy = current.validated_by;
      let justAutoValidated = false;

      // 3 Votes Auto-Validate
      if (likes.length >= 3 && status === IncidentStatus.EN_ATTENTE) {
          status = IncidentStatus.VALIDE;
          validatedBy = null;
          justAutoValidated = true;
      }

      const { data: updated, error } = await supabase
        .from('incidents')
        .update({ likes, dislikes, reliability_score: score, status, validated_by: validatedBy })
        .eq('id', incidentId)
        .select()
        .single();
      
      if (error) throw error;
      await this.logActivity(userId, 'VOTE', `Vote ${voteType}`, incidentId);

      // Reward on Auto-Validation
      if (justAutoValidated) {
          // Reward Reporter
          await this.updateUserReputation(current.reporter_id, 5, "Validation par la communauté");
          // Reward ALL Voters
          await this.processVoterReputation(likes, dislikes, IncidentStatus.VALIDE);
      }

      return this.mapIncident(updated);
  }

  async updateIncidentStatus(incidentId: string, status: IncidentStatus, validatorId?: string): Promise<Incident> {
      if (!isValidConfig) throw new Error("Service indisponible");
      
      const { data: current } = await supabase.from('incidents').select('reporter_id, status, likes, dislikes').eq('id', incidentId).single();
      
      const { data: updated, error } = await supabase
        .from('incidents')
        .update({ status, validated_by: validatorId })
        .eq('id', incidentId)
        .select()
        .single();
      
      if (error) throw error;

      if (validatorId) {
          await this.logActivity(validatorId, 'VALIDATE', `Statut: ${status}`, incidentId);
      }

      // REPUTATION IMPACT LOGIC
      if (current && current.status !== status) {
          // 1. Reporter Impact
          const reporterId = current.reporter_id;
          if (reporterId) {
              if (status === IncidentStatus.VALIDE) await this.updateUserReputation(reporterId, 5, "Incident Validé");
              else if (status === IncidentStatus.RESOLU) await this.updateUserReputation(reporterId, 10, "Incident Résolu (Information Utile)");
              else if (status === IncidentStatus.REJETE) await this.updateUserReputation(reporterId, -15, "Signalement Rejeté/Faux");
          }

          // 2. Voter Interaction Impact
          // Only process interaction reputation if status changes to definitive state (VALID or REJECTED)
          if (status === IncidentStatus.VALIDE || status === IncidentStatus.REJETE) {
              await this.processVoterReputation(current.likes || [], current.dislikes || [], status);
          }
      }

      return this.mapIncident(updated);
  }

  async updateIncidentLocation(incidentId: string, location: { lat: number; lng: number }): Promise<void> {
      if (!isValidConfig) return;
      await supabase
        .from('incidents')
        .update({ location, timestamp: Date.now() }) 
        .eq('id', incidentId);
  }

  // --- NOTIFICATIONS ---
  async getNotifications(userId: string): Promise<Notification[]> {
      if (!isValidConfig) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.eq.ALL`)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      return (data || []).map(this.mapNotification);
  }

  async markNotificationRead(notifId: string): Promise<void> {
      if (!isValidConfig) return;
      await supabase.from('notifications').update({ read: true }).eq('id', notifId);
  }

  private async createNotification(data: Partial<Notification>) {
      if (!isValidConfig) return;
      await supabase.from('notifications').insert({
          user_id: data.userId || 'ALL',
          title: data.title || 'Info',
          message: data.message || '',
          type: data.type || NotificationType.INFO,
          read: false,
          timestamp: Date.now(),
          related_incident_id: data.relatedIncidentId
      });
  }

  // --- STORAGE ---
  async uploadMedia(file: File): Promise<string | null> {
      if (!isValidConfig) return null;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file);

      if (uploadError) {
          console.error("Upload error", uploadError);
          return null;
      }

      const { data } = supabase.storage.from('evidence').getPublicUrl(filePath);
      return data.publicUrl;
  }

  async sendPromotionInvite(userId: string): Promise<void> {
      await this.createNotification({
          userId,
          title: "Promotion Sentinelle",
          message: "L'administration souhaite vous promouvoir au rang de Sentinelle.",
          type: NotificationType.PROMOTION
      });
  }

  // --- MAPPERS (Snake Case DB -> Camel Case App) ---
  public parseIncident(data: any): Incident {
      return this.mapIncident(data);
  }

  private mapUser(row: any): User {
      return {
          uid: row.uid,
          displayName: row.display_name,
          email: row.email,
          phone: row.phone,
          role: row.role as UserRole,
          status: row.status as UserStatus,
          reputationScore: row.reputation_score,
          joinedAt: row.joined_at,
          quartier: row.quartier
      };
  }

  private mapIncident(row: any): Incident {
      return {
          id: row.id,
          type: row.type as IncidentType,
          description: row.description,
          location: row.location, 
          address: row.address,
          timestamp: row.timestamp,
          reporterId: row.reporter_id,
          mediaUrl: row.media_url,
          mediaType: row.media_type,
          status: row.status as IncidentStatus,
          validatedBy: row.validated_by,
          likes: row.likes || [],
          dislikes: row.dislikes || [],
          reliabilityScore: row.reliability_score,
          reportCount: row.report_count,
          reporters: row.reporters || []
      };
  }

  private mapNotification(row: any): Notification {
      return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          message: row.message,
          type: row.type as NotificationType,
          read: row.read,
          timestamp: row.timestamp,
          relatedIncidentId: row.related_incident_id
      };
  }
}

export const db: DatabaseService = new SupabaseService();
