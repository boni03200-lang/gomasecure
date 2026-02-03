
export enum UserRole {
  CITOYEN = 'CITOYEN',
  SENTINELLE = 'SENTINELLE',
  ADMINISTRATEUR = 'ADMINISTRATEUR'
}

export enum UserStatus {
  ACTIF = 'ACTIF',
  BANNI = 'BANNI',
  SUSPENDU = 'SUSPENDU'
}

export enum IncidentType {
  VOL = 'VOL',
  AGRESSION = 'AGRESSION',
  INCENDIE = 'INCENDIE',
  ACCIDENT = 'ACCIDENT',
  ENLEVEMENT = 'ENLEVEMENT', // Kidnapping mentioned in SOS context
  SOS = 'SOS', // Alerte Silencieuse
  AUTRE = 'AUTRE'
}

export enum IncidentStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDE = 'VALIDE', // Confirmed by Sentinel
  REJETE = 'REJETE', // Rejected by Sentinel/Admin
  RESOLU = 'RESOLU' // Processed by Authorities
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  quartier?: string;
  reputationScore: number; // For promoting to Sentinel
  joinedAt: number;
}

export interface Incident {
  id: string;
  type: IncidentType;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  address?: string; // Human readable address from Reverse Geocoding
  timestamp: number;
  reporterId: string;
  mediaUrl?: string; // Photo/Audio/Video
  mediaType?: 'image' | 'video' | 'audio';
  status: IncidentStatus;
  validatedBy?: string; // Sentinel ID
  likes: string[]; // List of user IDs who confirmed
  dislikes: string[]; // List of user IDs who flagged false
  reliabilityScore: number; // Calculated based on votes/reporter score
  reportCount?: number; // Number of people reporting similar incident
  reporters?: string[]; // Array of user IDs who reported this (for merging)
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  timestamp: number;
  relatedIncidentId?: string;
}

export enum NotificationType {
  ALERT = 'ALERT', // Nearby danger
  INFO = 'INFO', // General info
  ACTION = 'ACTION', // Sentinel validation request
  PROMOTION = 'PROMOTION' // Invite to become Sentinel
}

export type TabView = 'MAP' | 'LIST' | 'REPORT' | 'PROFILE' | 'SOS';

// --- NOUVEAUX TYPES POUR L'HISTORIQUE ---
export type ActivityAction = 'LOGIN' | 'REGISTER' | 'REPORT' | 'VOTE' | 'VALIDATE' | 'REJECT' | 'RESOLVE' | 'SOS' | 'PROFILE_UPDATE';

export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  details: string;
  timestamp: number;
  targetId?: string; // ID de l'incident ou de l'objet concerné
}
