
import { IncidentType } from './types';

export const GOMA_CENTER = {
  lat: -1.6585,
  lng: 29.2205
};

export const MOCK_DELAY = 800;

export const REPUTATION_THRESHOLD_SENTINEL = 80;

export const SOS_MESSAGE_TEMPLATE = "ALERTE SOS: Danger imminent signalé à cette position. Audio furtif activé.";

// --- ADAPTIVE RADII (IN METERS) ---
// Prevents "Butterfly to Flame": Allows validating large events from far away.
export const INCIDENT_VISIBILITY_RADIUS: Record<IncidentType, number> = {
  [IncidentType.VOL]: 150,        // Local event, requires proximity
  [IncidentType.AGRESSION]: 200,  // Local event
  [IncidentType.ACCIDENT]: 500,   // Visible from street corner
  [IncidentType.INCENDIE]: 2000,  // Visible from km away (SAFE DISTANCE)
  [IncidentType.ENLEVEMENT]: 300, 
  [IncidentType.SOS]: 1000,       // Community alert, wide range
  [IncidentType.AUTRE]: 200
};

// --- DANGER ZONES ---
// If user is within this radius of these types, show SAFETY WARNING
export const DANGEROUS_INCIDENTS = [IncidentType.INCENDIE, IncidentType.AGRESSION, IncidentType.SOS, IncidentType.ACCIDENT];
export const DANGER_RADIUS = 100; // meters
