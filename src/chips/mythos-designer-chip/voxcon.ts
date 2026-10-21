export type VoxconSource = 'COMMAND' | 'OPERATOR' | 'SHIPWIDE' | 'FLEET' | 'MISSION' | 'SYSTEM' | 'USER' | 'AI';

export interface VoxconMessage {
  id: string;
  source: VoxconSource;
  text: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  isCommand?: boolean;
}
