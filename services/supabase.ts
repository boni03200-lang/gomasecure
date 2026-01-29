import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Incident, IncidentStatus, IncidentType, User, UserRole, UserStatus, Notification, NotificationType, ActivityLog, ActivityAction } from '../types';
import { GOMA_CENTER } from '../constants';

// --- CONFIGURATION REELLE SUPABASE ---
const SUPABASE_URL = 'https://jpytwlfapvmamtnnvayg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweXR3bGZhcHZtYW10bm52YXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTE1NzYsImV4cCI6MjA4NTE2NzU3Nn0.FGW4QBts3TNzLdENnUjLqBcqYk44ygNFosu94s5YYUA';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false
  }
});

// --- HELPER FOR ERROR HANDLING ---
const isAbortError = (error: any): boolean => {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    error?.name === 'AbortError' ||
    msg.includes('aborted') ||
    msg.includes('signal is aborted')
  );
};

// --- INTERFACE COMMUNE ---
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
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notifId: string): Promise<void>;
  uploadMedia(file: File): Promise<string | null>;
  parseIncident(data: any): Incident;
  sendPromotionInvite(userId: string): Promise<void>;
}

// --- SUPABASE SERVICE IMPLEMENTATION ---
class SupabaseService implements DatabaseService {
  private async logActivity(userId: string, action: ActivityAction, details: string, targetId?: string) {
    try {
        await supabase.from('activity_logs').insert({
        user_id: userId,
        action,
        details,
        timestamp: Date.now(),
        target_id: targetId
        });
    } catch (e) {
        // Silent fail for logs
    }
  }

  async login(email: string, password?: string): Promise<User> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || 'password',
    });
    if (authError) throw authError;

    // --- DEV HACK: AUTO-PROMOTE EXISTING ADMIN ACCOUNTS ---
    if (email.toLowerCase().includes('admin')) {
        await supabase.from('profiles').update({ 
            role: UserRole.ADMINISTRATEUR,
            reputation_score: 100 
        }).eq('id', authData.user.id);
    }
    // -----------------------------------------------------
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError) {
        console.error("Erreur profil:", profileError);
        const newProfile = {
            id: authData.user.id,
            email: email,
            role: email.includes('admin') ? UserRole.ADMINISTRATEUR : UserRole.CITOYEN,
            status: UserStatus.ACTIF,
            reputation_score: 50,
            joined_at: Date.now()
        };
        await supabase.from('profiles').insert(newProfile);
        return this.mapProfileToUser(newProfile);
    }

    await this.logActivity(authData.user.id, 'LOGIN', 'Connexion au système');
    return this.mapProfileToUser(profile);
  }

  async register(email: string, password: string, name: string, phone: string): Promise<User> {
    // 1. SignUp
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { display_name: name, phone: phone } 
      }
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Inscription échouée");

    // 2. Logic for Admin Role
    const isAdmin = email.toLowerCase().includes('admin');
    const role = isAdmin ? UserRole.ADMINISTRATEUR : UserRole.CITOYEN;
    const reputationScore = isAdmin ? 100 : 50;

    // 3. Force UPSERT Profile
    const profileData = {
        id: authData.user.id,
        email: email,
        display_name: name,
        phone: phone,
        role: role,
        status: UserStatus.ACTIF,
        reputation_score: reputationScore,
        joined_at: Date.now()
    };

    const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData);

    if (upsertError) {
        console.error("Profile creation/update failed:", upsertError);
    }
    
    await this.logActivity(authData.user.id, 'REGISTER', 'Création du compte');
    return this.mapProfileToUser(profileData);
  }

  async getAllUsers() {
    try {
        const { data, error } = await supabase.from('profiles').select('*').order('reputation_score', { ascending: false });
        if (error) {
            if (error.code !== '20') console.error("Error fetching users", error);
            return [];
        }
        return (data || []).map(this.mapProfileToUser);
    } catch (e: any) {
        if (isAbortError(e)) return [];
        console.error(e);
        return [];
    }
  }

  async updateUserRole(uid: string, role: UserRole) {
    try {
        await supabase.from('profiles').update({ role }).eq('id', uid);
        await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de rôle vers ${role}`);
    } catch (e) {
        if (!isAbortError(e)) console.error(e);
    }
  }

  async updateUserStatus(uid: string, status: UserStatus) {
    try {
        await supabase.from('profiles').update({ status }).eq('id', uid);
        await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de statut vers ${status}`);
    } catch (e) {
        if (!isAbortError(e)) console.error(e);
    }
  }

  async getUserActivity(uid: string) {
    try {
        const { data, error } = await supabase.from('activity_logs')
            .select('*')
            .eq('user_id', uid)
            .order('timestamp', { ascending: false });
            
        if (error) return [];
        
        return (data || []).map(log => ({
            id: log.id,
            userId: log.user_id,
            action: log.action as ActivityAction,
            details: log.details,
            timestamp: Number(log.timestamp),
            targetId: log.target_id
        }));
    } catch (e: any) {
        if (isAbortError(e)) return [];
        return [];
    }
  }

  async getIncidents() {
    try {
        const { data, error } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
        if (error) return [];
        return (data || []).map(this.mapDbToIncident);
    } catch (e: any) {
        if (isAbortError(e)) return [];
        console.error(e);
        return [];
    }
  }

  async uploadMedia(file: File): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop() || 'tmp';
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const bucketName = 'incidents'; 

        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, file);

        if (!uploadError) {
            const { data } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);
            return data.publicUrl;
        }

        console.warn("Storage upload failed, fallback to Base64.");

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                if (base64String.length > 3000000) { 
                    resolve(null);
                } else {
                    resolve(base64String);
                }
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

    } catch (e) {
        return null;
    }
  }

  async createIncident(incidentData: Partial<Incident>, user: User) {
    const location = incidentData.location || GOMA_CENTER;
    
    // SENTINEL LOGIC: Auto-validation
    // If the user is a Sentinel, their report is trusted instantly.
    const isSentinel = user.role === UserRole.SENTINELLE;
    const initialStatus = isSentinel ? IncidentStatus.VALIDE : IncidentStatus.EN_ATTENTE;
    const validatedBy = isSentinel ? user.uid : null;

    const newIncident = {
        type: incidentData.type || IncidentType.AUTRE,
        description: incidentData.description || '',
        lat: location.lat,
        lng: location.lng,
        timestamp: Date.now(),
        reporter_id: user.uid,
        media_url: incidentData.mediaUrl || null,
        media_type: incidentData.mediaType || 'image',
        status: initialStatus,
        validated_by: validatedBy,
        reliability_score: user.reputationScore,
        likes: [],
        dislikes: [],
        report_count: 1,
        reporters: [user.uid]
    };
    const { data, error } = await supabase.from('incidents').insert(newIncident).select().single();
    if (error) throw error;

    await this.logActivity(user.uid, 'REPORT', `Signalement: ${incidentData.type} (Statut: ${initialStatus})`, data.id);
    
    // Notification Logic
    try {
        const title = isSentinel ? "Alerte Sentinelle" : "Nouvel Incident";
        const message = isSentinel 
            ? `Une sentinelle a signalé et validé un incident : ${incidentData.type}`
            : `Un incident (${incidentData.type}) a été signalé.`;
        
        // If Validated (Sentinel), send ALERT (Danger confirmed). If Waiting (Citoyen), send ACTION (Need verification).
        const type = isSentinel ? NotificationType.ALERT : NotificationType.ACTION;

        await supabase.from('notifications').insert({
            user_id: 'ALL',
            title: title,
            message: message,
            type: type,
            timestamp: Date.now(),
            related_incident_id: data.id
        });
    } catch (e) { console.warn(e); }

    return this.mapDbToIncident(data);
  }

  async voteIncident(incidentId: string, userId: string, voteType: 'like' | 'dislike') {
    const { data: current } = await supabase.from('incidents').select('likes, dislikes, reliability_score').eq('id', incidentId).single();
    if (!current) throw new Error("Incident non trouvé");

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
    
    const { data: updated, error } = await supabase.from('incidents')
        .update({ likes, dislikes, reliability_score: score })
        .eq('id', incidentId)
        .select()
        .single();
        
    if (error) throw error;
    await this.logActivity(userId, 'VOTE', `Vote ${voteType} sur incident`, incidentId);
    return this.mapDbToIncident(updated);
  }

  async updateIncidentStatus(incidentId: string, status: IncidentStatus, validatorId?: string) {
    const updatePayload: any = { status };
    if (validatorId) updatePayload.validated_by = validatorId;
    
    const { data: updated, error } = await supabase.from('incidents')
        .update(updatePayload)
        .eq('id', incidentId)
        .select()
        .single();
        
    if (error) throw error;
    
    if (validatorId) await this.logActivity(validatorId, 'VALIDATE', `Statut mis à jour: ${status}`, incidentId);
    
    return this.mapDbToIncident(updated);
  }

  async getNotifications(userId: string) {
    try {
        const { data, error } = await supabase.from('notifications')
            .select('*')
            .or(`user_id.eq.${userId},user_id.eq.ALL`)
            .order('timestamp', { ascending: false })
            .limit(20);

        if (error) return [];
            
        return (data || []).map(n => ({
            id: n.id,
            userId: n.user_id,
            title: n.title,
            message: n.message,
            type: n.type as NotificationType,
            read: n.read,
            timestamp: Number(n.timestamp),
            relatedIncidentId: n.related_incident_id
        }));
    } catch (e: any) {
        if (isAbortError(e)) return [];
        return [];
    }
  }

  async markNotificationRead(notifId: string) {
    try {
        await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    } catch (e) {
        if (!isAbortError(e)) console.error(e);
    }
  }

  async sendPromotionInvite(userId: string) {
    try {
        await supabase.from('notifications').insert({
            user_id: userId,
            title: "Promotion Sentinelle",
            message: "L'administration souhaite vous promouvoir au rang de Sentinelle. Acceptez-vous cette responsabilité ?",
            type: NotificationType.PROMOTION,
            timestamp: Date.now(),
            read: false
        });
    } catch (e) {
        if (!isAbortError(e)) console.error(e);
    }
  }

  parseIncident(d: any): Incident {
      return this.mapDbToIncident(d);
  }

  private mapProfileToUser(p: any): User {
      return {
          uid: p.id,
          displayName: p.display_name || p.email,
          email: p.email,
          phone: p.phone,
          role: p.role as UserRole,
          status: p.status as UserStatus,
          reputationScore: p.reputation_score || 50,
          joinedAt: Number(p.joined_at) || Date.now()
      };
  }

  private mapDbToIncident(d: any): Incident {
      return {
          id: d.id,
          type: d.type as IncidentType,
          description: d.description,
          location: { lat: d.lat, lng: d.lng },
          timestamp: Number(d.timestamp),
          reporterId: d.reporter_id,
          mediaUrl: d.media_url,
          mediaType: d.media_type as any,
          status: d.status as IncidentStatus,
          validatedBy: d.validated_by,
          likes: d.likes || [],
          dislikes: d.dislikes || [],
          reliabilityScore: d.reliability_score || 50,
          reportCount: d.report_count || 1,
          reporters: d.reporters || []
      };
  }
}

// EXPORT THE REAL SERVICE
export const db: DatabaseService = new SupabaseService();