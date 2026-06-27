import { parseRoomShareUrl } from "./collab";

const UNAVAILABLE_ROOM_LINK_LABEL = "Invite link unavailable";

const compactRoomId = (roomId: string) => (roomId.length > 12 ? `${roomId.slice(0, 8)}...` : roomId);

export type RoomShareLinkView = {
  canCopy: boolean;
  display: string;
  title: string;
  url?: string;
};

export const getRoomShareLinkView = (shareUrl?: string, expectedRoomId?: string): RoomShareLinkView => {
  const parsedRoom = shareUrl ? parseRoomShareUrl(shareUrl) : null;

  if (!parsedRoom || (expectedRoomId && parsedRoom.roomId !== expectedRoomId)) {
    return {
      canCopy: false,
      display: UNAVAILABLE_ROOM_LINK_LABEL,
      title: shareUrl ?? UNAVAILABLE_ROOM_LINK_LABEL,
    };
  }

  const parsedUrl = new URL(parsedRoom.shareUrl);

  return {
    canCopy: true,
    display: `${parsedUrl.origin}/#room=${compactRoomId(parsedRoom.roomId)},...`,
    title: parsedRoom.shareUrl,
    url: parsedRoom.shareUrl,
  };
};
