import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// getReactNativePersistence só existe no bundle React Native do firebase
// (resolvido pelo Metro no APK); não aparece nos tipos do build web.
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;

const firebaseConfig = {
  apiKey: 'AIzaSyDTWVdRu9Bupexfd5rmlOEd2V5p_ujpEa8',
  authDomain: 'king-bt-7f559.firebaseapp.com',
  projectId: 'king-bt-7f559',
  storageBucket: 'king-bt-7f559.firebasestorage.app',
  messagingSenderId: '859106891704',
  appId: '1:859106891704:web:4c2c5f7233f021ed89214d',
};

// Evita inicializar múltiplas vezes (hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

// No nativo (APK), o Auth precisa de persistência via AsyncStorage.
// Usar getAuth() direto causa crash na inicialização e não guarda a sessão.
export const auth: Auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export default app;
