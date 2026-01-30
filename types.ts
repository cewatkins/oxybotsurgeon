
export enum Modality {
  AUDIO = 'AUDIO',
  TEXT = 'TEXT'
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface VitalsData {
  time: number;
  heartRate: number;
  oxygen: number;
  sedation: number;
}
