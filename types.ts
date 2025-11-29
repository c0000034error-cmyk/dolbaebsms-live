export interface User {
  username: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface Message {
  id?: string;
  sender: string;
  text: string;
  timestamp: number;
  type: 'text' | 'photo' | 'video' | 'audio';
  mediaUrl?: string;
  deleted?: boolean;
  reactions?: Record<string, string>; // username -> emoji
}

export interface ChatPreview {
  user: string;
  lastMessage: Message;
  timestamp: number;
  isOnline: boolean;
}