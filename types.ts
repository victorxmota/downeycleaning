
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pps: string;
  phone: string;
  password?: string;
}

export interface ScheduleItem {
  id: string;
  userId: string;
  locationName: string;
  address: string;
  dayOfWeek: number;
  hoursPerDay: number;
}

export interface OfficeScheduleConfig {
  dayOfWeek: number;
  hours: number;
  isActive: boolean;
}

export interface Office {
  id: string;
  name: string;
  eircode: string;
  address: string;
  defaultSchedule: OfficeScheduleConfig[];
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface SafetyChecklist {
  // Plan of Action
  knowJobSafety: boolean;
  weatherCheck: boolean;
  safePassInDate: boolean;
  hazardAwareness: boolean;
  floorConditions: boolean;
  // Lifting
  manualHandlingCert: boolean;
  liftingHelp: boolean;
  // Heights
  anchorPoints: boolean;
  ladderFooting: boolean;
  safetyCones: boolean;
  communication: boolean;
  // Equipment
  laddersCheck: boolean;
  sharpEdges: boolean;
  scraperCovers: boolean;
  hotSurfaces: boolean;
  chemicalCourse: boolean;
  chemicalAwareness: boolean;
  tidyEquipment: boolean;
  laddersStored: boolean;
  // PPE (Icons)
  highVis: boolean;
  helmet: boolean;
  goggles: boolean;
  gloves: boolean;
  mask: boolean;
  earMuffs: boolean;
  faceGuard: boolean;
  harness: boolean;
  boots: boolean;
}

export interface TimeRecord {
  id: string;
  userId: string;
  scheduleId?: string;
  locationName: string;
  startTime: string;
  endTime?: string;
  date: string;
  safetyChecklist: SafetyChecklist;
  photoUrl?: string;
  endPhotoUrl?: string;
  startLocation?: GeoLocation;
  endLocation?: GeoLocation;
  notes?: string;
  // Pause features
  isPaused?: boolean;
  pausedAt?: string;
  totalPausedMs?: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
