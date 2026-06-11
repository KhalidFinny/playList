export type SongBasic = {
  id: string;
  youtubeId: string;
  title: string;
  author?: string;
};

export type RoomState = {
  playbackControllerSocketId: string | null;
  nowPlaying: SongBasic | null;
  nextTrack: SongBasic | null;
  isPlaying: boolean;
  passkey: string | null;
  queue: any[] | null;
  lastAccessedAt: number;
};

const ROOM_STATE_TTL_MS = 6 * 60 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

class RoomManager {
  private rooms = new Map<string, RoomState>();

  public constructor() {
    const cleanupTimer = setInterval(() => this.cleanupInactiveRooms(), ROOM_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref?.();
  }

  private getOrInitRoom(roomId: string): RoomState {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        playbackControllerSocketId: null,
        nowPlaying: null,
        nextTrack: null,
        isPlaying: false,
        passkey: null,
        queue: null,
        lastAccessedAt: Date.now(),
      });
    }

    const room = this.rooms.get(roomId)!;
    room.lastAccessedAt = Date.now();
    return room;
  }

  private cleanupInactiveRooms(): void {
    const cutoff = Date.now() - ROOM_STATE_TTL_MS;
    for (const [roomId, state] of this.rooms) {
      if (!state.playbackControllerSocketId && state.lastAccessedAt < cutoff) {
        this.rooms.delete(roomId);
      }
    }
  }

  // --- QUEUE ---

  public getQueue(roomId: string): any[] | null {
    return this.getOrInitRoom(roomId).queue;
  }

  public setQueue(roomId: string, queue: any[]): void {
    const room = this.getOrInitRoom(roomId);
    room.queue = queue;
  }

  // --- PLAYBACK CONTROLLER ---
  
  public getPlaybackController(roomId: string): string | null {
    return this.getOrInitRoom(roomId).playbackControllerSocketId;
  }

  public registerPlaybackController(roomId: string, socketId: string): boolean {
    const room = this.getOrInitRoom(roomId);
    if (room.playbackControllerSocketId && room.playbackControllerSocketId !== socketId) {
      return false; // Already taken
    }
    room.playbackControllerSocketId = socketId;
    return true;
  }

  public unregisterPlaybackController(roomId: string, socketId: string): void {
    const room = this.getOrInitRoom(roomId);
    if (room.playbackControllerSocketId === socketId) {
      room.playbackControllerSocketId = null;
    }
  }

  public unregisterControllerIfAny(socketId: string): string | null {
    // If a socket disconnects, find if it was an EO and clean it up. Returns roomId.
    for (const [roomId, state] of this.rooms.entries()) {
      if (state.playbackControllerSocketId === socketId) {
        state.playbackControllerSocketId = null;
        return roomId;
      }
    }
    return null;
  }

  // --- PLAYBACK STATE ---

  public getNowPlaying(roomId: string): SongBasic | null {
    return this.getOrInitRoom(roomId).nowPlaying;
  }

  public setNowPlaying(roomId: string, song: SongBasic | null): void {
    const room = this.getOrInitRoom(roomId);
    room.nowPlaying = song;
  }

  public setIsPlaying(roomId: string, playing: boolean): void {
    const room = this.getOrInitRoom(roomId);
    room.isPlaying = playing;
  }

  public getIsPlaying(roomId: string): boolean {
    return this.getOrInitRoom(roomId).isPlaying;
  }

  public getPasskey(roomId: string): string | null {
    return this.getOrInitRoom(roomId).passkey;
  }

  public setPasskey(roomId: string, passkey: string): void {
    const room = this.getOrInitRoom(roomId);
    room.passkey = passkey;
  }
}

export const roomManager = new RoomManager();
