import {
  collection, doc, addDoc, updateDoc, arrayUnion, arrayRemove,
  onSnapshot, query, orderBy, limit, Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';

export type FeedItem = {
  id: string;
  type: 'match_result' | 'rank_change' | 'comp_done' | 'rivalry_milestone';
  compId: string;
  compName: string;
  matchId?: string;
  format?: string;
  sideA?: { ids: string[]; name: string; score: number };
  sideB?: { ids: string[]; name: string; score: number };
  timestamp: Timestamp;
  reactions: Record<string, string[]>;
  comments: { uid: string; name: string; text: string; ts: Timestamp }[];
  // rank_change
  playerId?: string;
  playerName?: string;
  oldPos?: number;
  newPos?: number;
  newPoints?: number;
  // rivalry_milestone
  milestoneType?: 'streak_broken' | 'new_carrasco' | 'new_fregues' | 'first_win_over';
  milestoneEmoji?: string;
  milestoneTitle?: string;
  milestoneDesc?: string;
  involvedIds?: string[];
};

const feedCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'feed');

export function subscribeFeed(
  groupId: string,
  onData: (items: FeedItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const q = query(feedCol(groupId), orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedItem));
      onData(items);
    },
    err => onError?.(err)
  );
}

export async function createFeedItem(
  groupId: string,
  item: Omit<FeedItem, 'id'>
): Promise<void> {
  await addDoc(feedCol(groupId), item);
}

export async function toggleReaction(
  groupId: string,
  feedId: string,
  emoji: string,
  uid: string,
  hasReacted: boolean
): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'feed', feedId);
  await updateDoc(ref, {
    [`reactions.${emoji}`]: hasReacted ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function addComment(
  groupId: string,
  feedId: string,
  uid: string,
  name: string,
  text: string
): Promise<void> {
  const ref = doc(db, 'groups', groupId, 'feed', feedId);
  await updateDoc(ref, {
    comments: arrayUnion({ uid, name, text, ts: Timestamp.now() }),
  });
}
