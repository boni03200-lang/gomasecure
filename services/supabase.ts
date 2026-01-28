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
        console.error("Failed to log activity", e);
    }
  }

  async login(email: string, password?: string): Promise<User> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || 'password',
    });
    if (authError) throw authError;
    
    // On récupère le profil public
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError) {
        console.error("Erreur profil:", profileError);
        throw new Error("Impossible de charger le profil utilisateur. Vérifiez si la table 'profiles' existe.");
    }

    await this.logActivity(authData.user.id, 'LOGIN', 'Connexion au système');
    return this.mapProfileToUser(profile);
  }

  async register(email: string, password: string, name: string, phone: string): Promise<User> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { display_name: name, phone: phone } 
      }
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Inscription échouée");

    // FALLBACK: Manual Profile Insert
    // Try to insert directly in case DB trigger is missing
    const newProfile = {
        id: authData.user.id,
        email: email,
        display_name: name,
        phone: phone,
        role: UserRole.CITOYEN,
        status: UserStatus.ACTIF,
        reputation_score: 50,
        joined_at: Date.now()
    };
    
    const { error: insertError } = await supabase.from('profiles').insert(newProfile);
    // Ignore duplicate key errors (23505) as it means trigger already handled it
    if (insertError && insertError.code !== '23505') {
         console.warn("Profile auto-creation fallback failed or not needed", insertError);
    }

    // Now fetch the final profile to be sure
    let profile = null;
    for(let i=0; i<10; i++) {
        const { data } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (data) { profile = data; break; }
        await new Promise(r => setTimeout(r, 500));
    }

    if (!profile) {
        // Last resort: return the manually constructed profile if fetch fails but user exists
        profile = newProfile;
    }
    
    await this.logActivity(authData.user.id, 'REGISTER', 'Création du compte');
    return this.mapProfileToUser(profile);
  }

  async getAllUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('reputation_score', { ascending: false });
    if (error) {
        if (error.message !== 'signal is aborted without reason') console.error("Error fetching users", error);
        return [];
    }
    return (data || []).map(this.mapProfileToUser);
  }

  async updateUserRole(uid: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', uid);
    await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de rôle vers ${role}`);
  }

  async updateUserStatus(uid: string, status: UserStatus) {
    await supabase.from('profiles').update({ status }).eq('id', uid);
    await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de statut vers ${status}`);
  }

  async getUserActivity(uid: string) {
    const { data, error } = await supabase.from('activity_logs').select('*').eq('user_id', uid).order('timestamp', { ascending: false });
    if (error) {
        if (error.message !== 'signal is aborted without reason') console.error("Error fetching logs", error);
        return [];
    }
    return (data || []).map(log => ({
        id: log.id,
        userId: log.user_id,
        action: log.action as ActivityAction,
        details: log.details,
        timestamp: Number(log.timestamp),
        targetId: log.target_id
    }));
  }

  async getIncidents() {
    const { data, error } = await supabase.from('incidents').select('*').order('timestamp', { ascending: false });
    if (error) {
        if (error.message !== 'signal is aborted without reason') console.error("Erreur incidents:", error);
        return [];
    }
    return (data || []).map(this.mapDbToIncident);
  }

  async createIncident(incidentData: Partial<Incident>, user: User) {
    const location = incidentData.location || GOMA_CENTER;
    const newIncident = {
        type: incidentData.type || IncidentType.AUTRE,
        description: incidentData.description || '',
        lat: location.lat,
        lng: location.lng,
        timestamp: Date.now(),
        reporter_id: user.uid,
        media_url: incidentData.mediaUrl || null,
        media_type: incidentData.mediaType || 'image',
        status: IncidentStatus.EN_ATTENTE,
        reliability_score: user.reputationScore,
        likes: [],
        dislikes: [],
        report_count: 1,
        reporters: [user.uid]
    };
    const { data, error } = await supabase.from('incidents').insert(newIncident).select().single();
    if (error) throw error;

    await this.logActivity(user.uid, 'REPORT', `Signalement: ${incidentData.type}`, data.id);
    
    // Notification automatique pour tous
    try {
        await supabase.from('notifications').insert({
            user_id: 'ALL',
            title: "Nouvel Incident",
            message: `Un incident (${incidentData.type}) a été signalé.`,
            type: NotificationType.ACTION,
            timestamp: Date.now(),
            related_incident_id: data.id
        });
    } catch (e) {
        console.warn("Failed to send notification", e);
    }

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
    const { data, error } = await supabase.from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.eq.ALL`)
        .order('timestamp', { ascending: false })
        .limit(20);

    if (error) {
        // Return empty array on specific errors to prevent crash loop in polling
        if (error.message === 'signal is aborted without reason' || error.message.includes('aborted')) return [];
        console.error("Error fetching notifications", error);
        return [];
    }
        
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
  }

  async markNotificationRead(notifId: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
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

export const db: DatabaseService = new SupabaseService();