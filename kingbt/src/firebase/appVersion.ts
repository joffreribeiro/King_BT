import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';

const appVersionDoc = () => doc(db, 'config', 'appVersion');

/**
 * Timestamp (epoch ms) do build mais antigo ainda aceito. Clientes com
 * EXPO_PUBLIC_BUILD_TIME menor que esse valor ficam bloqueados até
 * atualizar (ver src/store/UpdateContext.tsx). null = sem obrigatoriedade.
 */
export async function getMinRequiredBuildTime(): Promise<number | null> {
  try {
    const snap = await getDoc(appVersionDoc());
    const v = snap.data()?.minBuildTime;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Marca `buildTime` como a versão mínima obrigatória, ou remove a obrigatoriedade com `null`. */
export async function setMinRequiredBuildTime(buildTime: number | null): Promise<void> {
  await setDoc(appVersionDoc(), { minBuildTime: buildTime }, { merge: true });
}
