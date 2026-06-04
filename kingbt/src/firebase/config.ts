import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDTWVdRu9Bupexfd5rmlOEd2V5p_ujpEa8',
  authDomain: 'king-bt-7f559.firebaseapp.com',
  projectId: 'king-bt-7f559',
  storageBucket: 'king-bt-7f559.firebasestorage.app',
  messagingSenderId: '859106891704',
  appId: '1:859106891704:web:4c2c5f7233f021ed89214d',
};

// Evita inicializar múltiplas vezes (hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;
