import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Incident, IncidentStatus, IncidentType, User, UserRole, UserStatus, Notification, NotificationType, ActivityLog, ActivityAction } from '../types';
import { GOMA_CENTER } from '../constants';

// --- CONFIGURATION REELLE SUPABASE ---
const SUPABASE_URL = 'https://jpytwlfapvmamtnnvayg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweXR3bGZhcHZtYW10bm52YXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTE1NzYsImV4cCI6MjA4NTE2NzU3Nn0.FGW4QBts3TNzLdENnUjLqBcqYk44ygNFosu94s5YYUA';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILS ---
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
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
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notifId: string): Promise<void>;
  uploadMedia(file: File): Promise<string | null>;
  parseIncident(data: any): Incident;
  sendPromotionInvite(userId: string): Promise<void>;
}

// --- SUPABASE SERVICE IMPLEMENTATION ---
class SupabaseService implements DatabaseService {
  
  // Helper to log actions in the database
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
    // 1. Auth with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || 'password', // Fallback for simple demo flows if needed
    });

    if (authError) throw authError;
    
    // 2. Fetch Profile Details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (profileError) throw profileError;

    await this.logActivity(authData.user.id, 'LOGIN', 'Connexion au système');
    return this.mapProfileToUser(profile);
  }

  async register(email: string, password: string, name: string, phone: string): Promise<User> {
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { display_name: name, phone: phone } // Metadata
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Inscription échouée");

    // 2. Create Profile Entry (If not handled by Postgres Trigger)
    // We try to insert, if conflict (trigger exists), we fetch.
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
    
    // If insert fails, it might be because a Trigger already created it, so we fetch it.
    if (insertError) {
        const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (existingProfile) return this.mapProfileToUser(existingProfile);
    }

    await this.logActivity(authData.user.id, 'REGISTER', 'Création du compte');
    return this.mapProfileToUser(newProfile);
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || []).map(this.mapProfileToUser);
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    await supabase.from('profiles').update({ role }).eq('id', uid);
    await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de rôle vers ${role}`);
  }

  async updateUserStatus(uid: string, status: UserStatus): Promise<void> {
    await supabase.from('profiles').update({ status }).eq('id', uid);
    await this.logActivity(uid, 'PROFILE_UPDATE', `Changement de statut vers ${status}`);
  }

  async getUserActivity(uid: string): Promise<ActivityLog[]> {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', uid)
      .order('timestamp', { ascending: false });
      
    return (data || []).map(log => ({
        id: log.id,
        userId: log.user_id,
        action: log.action as ActivityAction,
        details: log.details,
        timestamp: log.timestamp,
        targetId: log.target_id
    }));
  }

  async getIncidents(): Promise<Incident[]> {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (error) throw error;
    return (data || []).map(this.mapDbToIncident);
  }

  async createIncident(incidentData: Partial<Incident>, user: User): Promise<Incident> {
    const MERGE_RADIUS_METERS = 50;
    const location = incidentData.location || GOMA_CENTER;
    const type = incidentData.type || IncidentType.AUTRE;

    // 1. Fetch active incidents to check for duplicates (Merge Logic)
    const { data: activeIncidents } = await supabase
      .from('incidents')
      .select('*')
      .in('status', [IncidentStatus.EN_ATTENTE, IncidentStatus.VALIDE])
      .eq('type', type);

    let nearbyIncident = null;
    if (activeIncidents) {
        nearbyIncident = activeIncidents.find((inc: any) => {
            const dist = getDistanceFromLatLonInM(inc.lat, inc.lng, location.lat, location.lng);
            return dist <= MERGE_RADIUS_METERS;
        });
    }

    // 2. MERGE IF EXISTS
    if (nearbyIncident) {
        const reporters = nearbyIncident.reporters || [nearbyIncident.reporter_id];
        if (!reporters.includes(user.uid)) {
             const newReporters = [...reporters, user.uid];
             const newCount = (nearbyIncident.report_count || 1) + 1;
             const newScore = Math.min(100, (nearbyIncident.reliability_score || 50) + 15);
             
             const { data: updated } = await supabase
                .from('incidents')
                .update({ 
                    report_count: newCount,
                    reporters: newReporters,
                    reliability_score: newScore,
                    timestamp: Date.now() // Bump timestamp
                })
                .eq('id', nearbyIncident.id)
                .select()
                .single();

             if (updated) {
                 await this.logActivity(user.uid, 'REPORT', `Signalement fusionné: ${type}`, updated.id);
                 return this.mapDbToIncident(updated);
             }
        }
        return this.mapDbToIncident(nearbyIncident);
    }

    // 3. CREATE NEW
    const isSentinel = user.role === UserRole.SENTINELLE;
    const initialStatus = isSentinel ? IncidentStatus.VALIDE : IncidentStatus.EN_ATTENTE;
    const validatedBy = isSentinel ? user.uid : null;

    const newIncidentPayload = {
        type: type,
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

    const { data: created, error } = await supabase.from('incidents').insert(newIncidentPayload).select().single();
    if (error) throw error;

    const actionType = type === IncidentType.SOS ? 'SOS' : 'REPORT';
    await this.logActivity(user.uid, actionType, `Nouveau signalement: ${type}`, created.id);

    // Create Notification
    await supabase.from('notifications').insert({
        user_id: 'ALL',
        title: isSentinel ? "Alerte Sentinelle" : "Nouvel Incident",
        message: `Nouveau signalement : ${type}`,
        type: isSentinel ? NotificationType.ALERT : NotificationType.ACTION,
        timestamp: Date.now(),
        related_incident_id: created.id
    });

    return this.mapDbToIncident(created);
  }

  async voteIncident(incidentId: string, userId: string, voteType: 'like' | 'dislike'): Promise<Incident> {
    // Fetch current state
    const { data: current, error } = await supabase.from('incidents').select('likes, dislikes, reliability_score, status').eq('id', incidentId).single();
    if (error || !current) throw new Error("Incident introuvable");

    let likes = current.likes || [];
    let dislikes = current.dislikes || [];
    let score = current.reliability_score;

    // Remove existing vote
    likes = likes.filter((id: string) => id !== userId);
    dislikes = dislikes.filter((id: string) => id !== userId);

    // Add new vote
    if (voteType === 'like') {
        likes.push(userId);
        score = Math.min(100, score + 10);
    } else {
        dislikes.push(userId);
        score = Math.max(0, score - 15);
    }

    // Update DB
    const updatePayload: any = { likes, dislikes, reliability_score: score };
    
    // Auto validate logic
    if (likes.length >= 3 && current.status === IncidentStatus.EN_ATTENTE) {
        updatePayload.status = IncidentStatus.VALIDE;
        updatePayload.validated_by = 'SYSTEM_AUTO';
    }

    const { data: updated } = await supabase.from('incidents').update(updatePayload).eq('id', incidentId).select().single();
    
    await this.logActivity(userId, 'VOTE', `Vote ${voteType}`, incidentId);
    
    return this.mapDbToIncident(updated);
  }

  async updateIncidentStatus(incidentId: string, status: IncidentStatus, validatorId?: string): Promise<Incident> {
    const payload: any = { status };
    if (validatorId) payload.validated_by = validatorId;

    const { data: updated, error } = await supabase.from('incidents').update(payload).eq('id', incidentId).select().single();
    if (error) throw error;

    if (validatorId) {
        let action: ActivityAction = 'VALIDATE';
        if (status === IncidentStatus.REJETE) action = 'REJECT';
        if (status === IncidentStatus.RESOLU) action = 'RESOLVE';
        await this.logActivity(validatorId, action, `Statut mis à jour: ${status}`, incidentId);
    }

    return this.mapDbToIncident(updated);
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},user_id.eq.ALL`)
        .order('timestamp', { ascending: false })
        .limit(50);
        
    return (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type as NotificationType,
        read: n.read,
        timestamp: n.timestamp,
        relatedIncidentId: n.related_incident_id
    }));
  }

  async markNotificationRead(notifId: string): Promise<void> {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
  }

  async uploadMedia(file: File): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;
        
        // Ensure bucket exists called 'incidents' or 'media' in Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('incidents')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return null;
        }

        const { data } = supabase.storage.from('incidents').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (e) {
        console.error("Exception uploading media", e);
        return null;
    }
  }

  async sendPromotionInvite(userId: string): Promise<void> {
     await supabase.from('notifications').insert({
         user_id: userId,
         title: "Promotion Sentinelle",
         message: "L'administration souhaite vous promouvoir au rang de Sentinelle.",
         type: NotificationType.PROMOTION,
         timestamp: Date.now()
     });
  }

  // --- MAPPERS ---
  
  parseIncident(data: any): Incident {
      return this.mapDbToIncident(data);
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
