import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './config';

const storage = getStorage(app);

export async function uploadProfilePhoto(
  groupId: string,
  playerId: string,
  uri: string
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `groups/${groupId}/players/${playerId}/avatar.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
