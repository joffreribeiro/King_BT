import Constants from 'expo-constants';

/**
 * Versão do app. Nos APKs o workflow define EXPO_PUBLIC_APP_VERSION = versão + número do build
 * (a mesma do nome do arquivo KINGBT_<versão>.apk); na web e em build local cai na versão do app.json.
 */
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? Constants.expoConfig?.version ?? '1.0.0';
