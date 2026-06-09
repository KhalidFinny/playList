export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  author: string;
  artist?: string;
  thumbnail?: string;
}

export interface PendingSong {
  id: string;
  youtubeId: string;
  title: string;
  author: string;
  status: string;
  submittedBy: string;
  createdAt: string;
}

export interface SearchResult {
  youtubeId: string;
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface PendingAdmin extends AdminUser {
  createdAt: string;
}

export interface Station {
  id: string;
  passkey: string;
  createdAt: string;
}
