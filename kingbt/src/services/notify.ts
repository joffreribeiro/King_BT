import { Alert, Platform } from 'react-native';

/**
 * Aviso curto de um botão só. Alert.alert é no-op no React Native Web
 * (`node_modules/react-native-web/dist/exports/Alert/index.js` é um
 * `static alert() {}` vazio) — sem este desvio, a mensagem nunca aparece
 * na web e o usuário só vê o botão "não fazer nada".
 */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
