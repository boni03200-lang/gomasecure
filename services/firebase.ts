import { Incident, IncidentStatus, IncidentType, User, UserRole, UserStatus, Notification, NotificationType, ActivityLog, ActivityAction } from '../types';
import { GOMA_CENTER } from '../constants';

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

// --- MOCK DATA ---
const MOCK_USERS: User[] = [
  { uid: 'u1', displayName: 'Jean Citoyen', email: 'jean@goma.cd', phone: '+243999999999', role: UserRole.CITOYEN, status: UserStatus.ACTIF, quartier: 'Birere', reputationScore: 45, joinedAt: Date.now() - 10000000 },
  { uid: 'u2', displayName: 'Mama Sentinelle', email: 'mama@goma.cd', phone: '+243888888888', role: UserRole.SENTINELLE, status: UserStatus.ACTIF, quartier: 'Katindo', reputationScore: 92, joinedAt: Date.now() - 20000000 },
  { uid: 'u3', displayName: 'Admin Chef', email: 'admin@police.goma.cd', phone: '+243000000000', role: UserRole.ADMINISTRATEUR, status: UserStatus.ACTIF, reputationScore: 100, joinedAt: Date.now() - 30000000 },
  { uid: 'u4', displayName: 'Pierre Voisin', email: 'pierre@goma.cd', phone: '+243777777777', role: UserRole.CITOYEN, status: UserStatus.ACTIF, quartier: 'Katindo', reputationScore: 60, joinedAt: Date.now() - 5000000 },
];

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc1',
    type: IncidentType.VOL,
    description: 'Vol de sac à main par deux individus à moto.',
    location: { lat: GOMA_CENTER.lat + 0.001, lng: GOMA_CENTER.lng + 0.001 },
    timestamp: Date.now() - 3600000,
    reporterId: 'u1',
    status: IncidentStatus.EN_ATTENTE,
    likes: [],
    dislikes: [],
    reliabilityScore: 50,
    mediaUrl: 'https://picsum.photos/400/300',
    mediaType: 'image',
    reportCount: 1,
    reporters: ['u1']
  },
  {
    id: 'inc2',
    type: IncidentType.INCENDIE,
    description: 'Feu de maison près du marché. Pompiers demandés.',
    location: { lat: GOMA_CENTER.lat - 0.002, lng: GOMA_CENTER.lng - 0.001 },
    timestamp: Date.now() - 7200000,
    reporterId: 'u4',
    status: IncidentStatus.VALIDE,
    validatedBy: 'u2',
    likes: ['u1', 'u2'],
    dislikes: [],
    reliabilityScore: 95,
    reportCount: 3, 
    reporters: ['u4', 'u1', 'u5']
  }
];

// --- SERVICE CLASS ---
class MockFirebaseService {
  private users = MOCK_USERS;
  private incidents = MOCK_INCIDENTS;
  private notifications: Notification[] = [];
  private activityLogs: ActivityLog[] = [];

  constructor() {
      // Seed initial logs
      this.logActivity('u1', 'REPORT', 'Signalement initial de vol', Date.now() - 3600000, 'inc1');
      this.logActivity('u4', 'REPORT', 'Signalement initial incendie', Date.now() - 7200000, 'inc2');
      this.logActivity('u1', 'VOTE', 'Confirmation incendie', Date.now() - 7100000, 'inc2');
      this.logActivity('u2', 'VALIDATE', 'Validation incendie', Date.now() - 7000000, 'inc2');
      this.logActivity('u3', 'LOGIN', 'Connexion Admin', Date.now() - 100000);
  }

  // Helper to log actions
  private logActivity(userId: string, action: ActivityAction, details: string, timestamp = Date.now(), targetId?: string) {
      this.activityLogs.unshift({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          action,
          details,
          timestamp,
          targetId
      });
  }
  
  // Auth Simulation
  async login(email: string, password?: string): Promise<User> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
           this.logActivity(user.uid, 'LOGIN', 'Connexion au système');
           resolve(user);
        } else {
           reject(new Error("Utilisateur non trouvé"));
        }
      }, 800);
    });
  }

  async register(email: string, password: string, name: string, phone: string): Promise<User> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (this.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
                reject(new Error("Email déjà utilisé"));
                return;
            }
            const newUser: User = {
                uid: `u${Date.now()}`,
                displayName: name,
                email: email,
                phone: phone,
                role: UserRole.CITOYEN,
                status: UserStatus.ACTIF,
                reputationScore: 50,
                joinedAt: Date.now()
            };
            this.users.push(newUser);
            this.logActivity(newUser.uid, 'REGISTER', 'Création du compte');
            resolve(newUser);
        }, 1000);
    });
  }

  async getAllUsers(): Promise<User[]> {
    return Promise.resolve([...this.users]);
  }

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const idx = this.users.findIndex(u => u.uid === uid);
    if(idx > -1) {
        this.users[idx].role = role;
        // Log is usually system/admin action, but we can store it associated with the target user for history
        this.logActivity(uid, 'PROFILE_UPDATE', `Rôle modifié vers ${role}`);
    }
  }

  async updateUserStatus(uid: string, status: UserStatus): Promise<void> {
    const idx = this.users.findIndex(u => u.uid === uid);
    if(idx > -1) {
        this.users[idx].status = status;
        this.logActivity(uid, 'PROFILE_UPDATE', `Statut compte modifié: ${status}`);
    }
  }
  
  async getUserActivity(uid: string): Promise<ActivityLog[]> {
    return this.activityLogs.filter(log => log.userId === uid).sort((a, b) => b.timestamp - a.timestamp);
  }

  // Incident Management
  async getIncidents(): Promise<Incident[]> {
    return new Promise((resolve) => setTimeout(() => resolve([...this.incidents]), 300));
  }

  async createIncident(incidentData: Partial<Incident>, user: User): Promise<Incident> {
    const MERGE_RADIUS_METERS = 50;
    const location = incidentData.location || GOMA_CENTER;
    const type = incidentData.type || IncidentType.AUTRE;

    // 1. Check for existing similar active incidents nearby to MERGE
    const nearbyIncidentIndex = this.incidents.findIndex(inc => {
        if (inc.status !== IncidentStatus.EN_ATTENTE && inc.status !== IncidentStatus.VALIDE) return false;
        if (inc.type !== type) return false; // Must be same type
        
        const dist = getDistanceFromLatLonInM(
            inc.location.lat, inc.location.lng,
            location.lat, location.lng
        );
        return dist <= MERGE_RADIUS_METERS;
    });

    // 2. MERGE LOGIC
    if (nearbyIncidentIndex !== -1) {
        const existing = this.incidents[nearbyIncidentIndex];
        
        if (!existing.reporters?.includes(user.uid)) {
            existing.reportCount = (existing.reportCount || 1) + 1;
            existing.reporters = [...(existing.reporters || [existing.reporterId]), user.uid];
            existing.reliabilityScore = Math.min(100, existing.reliabilityScore + 15);
            existing.timestamp = Date.now();
            
            this.incidents[nearbyIncidentIndex] = { ...existing };
            
            this.logActivity(user.uid, 'REPORT', `Signalement fusionné: ${type} (via merge)`, Date.now(), existing.id);

            this.createNotification({
                title: "Signalement Fusionné",
                message: `Un incident similaire a été détecté à proximité. Votre signalement a été ajouté pour renforcer l'alerte.`,
                type: NotificationType.INFO,
                userId: user.uid,
                relatedIncidentId: existing.id
            });
        }
        return existing;
    }

    // 3. CREATE NEW LOGIC
    const newIncident: Incident = {
      id: `inc_${Date.now()}`,
      type: type,
      description: incidentData.description || '',
      location: location,
      timestamp: Date.now(),
      reporterId: user.uid,
      status: IncidentStatus.EN_ATTENTE,
      likes: [],
      dislikes: [],
      reliabilityScore: user.reputationScore,
      mediaUrl: incidentData.mediaUrl,
      mediaType: incidentData.mediaType || 'image',
      reportCount: 1,
      reporters: [user.uid]
    };
    
    this.incidents.unshift(newIncident);
    
    // Log Activity
    const actionType = type === IncidentType.SOS ? 'SOS' : 'REPORT';
    this.logActivity(user.uid, actionType, `Nouveau signalement: ${type}`, Date.now(), newIncident.id);
    
    // Notify Sentinels
    this.createNotification({
        title: "Nouvel Incident",
        message: `Un incident (${newIncident.type}) nécessite validation.`,
        type: NotificationType.ACTION,
        userId: 'u2',
        relatedIncidentId: newIncident.id
    });

    return newIncident;
  }

  async voteIncident(incidentId: string, userId: string, voteType: 'like' | 'dislike'): Promise<Incident> {
    const incidentIndex = this.incidents.findIndex(i => i.id === incidentId);
    if (incidentIndex === -1) throw new Error("Incident not found");

    const incident = this.incidents[incidentIndex];
    
    incident.likes = incident.likes.filter(id => id !== userId);
    incident.dislikes = incident.dislikes.filter(id => id !== userId);

    if (voteType === 'like') {
      incident.likes.push(userId);
      incident.reliabilityScore = Math.min(100, incident.reliabilityScore + 10);
    } else {
      incident.dislikes.push(userId);
      incident.reliabilityScore = Math.max(0, incident.reliabilityScore - 15);
    }
    
    this.logActivity(userId, 'VOTE', `Vote ${voteType === 'like' ? 'confirmation' : 'démenti'} sur incident`, Date.now(), incidentId);

    if (incident.likes.length >= 5 && incident.status === IncidentStatus.EN_ATTENTE) {
        incident.status = IncidentStatus.VALIDE;
        incident.validatedBy = 'SYSTEM_AUTO';
        this.logActivity('SYSTEM', 'VALIDATE', 'Validation automatique (seuil votes atteint)', Date.now(), incidentId);
    }

    this.incidents[incidentIndex] = { ...incident };
    return incident;
  }

  async updateIncidentStatus(incidentId: string, status: IncidentStatus, validatorId?: string): Promise<Incident> {
    const incidentIndex = this.incidents.findIndex(i => i.id === incidentId);
    const incident = this.incidents[incidentIndex];
    incident.status = status;
    if (validatorId) {
        incident.validatedBy = validatorId;
        
        let action: ActivityAction = 'VALIDATE';
        if (status === IncidentStatus.REJETE) action = 'REJECT';
        if (status === IncidentStatus.RESOLU) action = 'RESOLVE';
        
        this.logActivity(validatorId, action, `Changement statut vers ${status}`, Date.now(), incidentId);
    }
    
    this.createNotification({
        title: `Mise à jour Incident`,
        message: `Votre signalement a été marqué comme ${status}.`,
        type: NotificationType.INFO,
        userId: incident.reporterId,
        relatedIncidentId: incident.id
    });

    this.incidents[incidentIndex] = { ...incident };
    return incident;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.filter(n => n.userId === userId || n.userId === 'ALL');
  }

  private createNotification(data: Partial<Notification>) {
      const notif: Notification = {
          id: `notif_${Date.now()}`,
          userId: data.userId || 'ALL',
          title: data.title || 'Info',
          message: data.message || '',
          type: data.type || NotificationType.INFO,
          read: false,
          timestamp: Date.now(),
          relatedIncidentId: data.relatedIncidentId
      };
      this.notifications.unshift(notif);
  }

  async markNotificationRead(notifId: string): Promise<void> {
      const idx = this.notifications.findIndex(n => n.id === notifId);
      if(idx > -1) this.notifications[idx].read = true;
  }
}

export const db = new MockFirebaseService();