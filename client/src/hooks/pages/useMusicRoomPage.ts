import { useParams } from '@tanstack/react-router';
import { useMusicRoom } from '../../features/participant/hooks/useMusicRoom';

export function useMusicRoomPage() {
  const { roomId } = useParams({ from: '/r/$roomId' }) as { roomId: string };
  const musicRoom = useMusicRoom(roomId);

  return {
    roomId,
    ...musicRoom
  };
}
