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

export type AdminAuthenticateResponse = { success: true; user: AdminUser } | { success: false };

export type GetMyStationsResponse = {
  success: boolean;
  stations?: Station[];
};

export type GetPendingAdminsResponse = {
  success: boolean;
  admins?: PendingAdmin[];
};

export type CreateStationResponse = {
  success: boolean;
  roomId?: string;
  error?: string;
};

export type ModerateAdminResponse = {
  success: boolean;
};
