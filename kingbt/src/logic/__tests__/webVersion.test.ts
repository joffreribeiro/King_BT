import { entryHashFrom, isNewerBuild } from '@/logic/webVersion';

describe('webVersion', () => {
  it('lê o hash do pacote principal no HTML publicado', () => {
    const html = '<script src="/_expo/static/js/web/entry-f124c40125897faae6935a5667e7a892.js" defer></script>';
    expect(entryHashFrom(html)).toBe('f124c40125897faae6935a5667e7a892');
  });
  it('sem hash (servidor de desenvolvimento) devolve null', () => {
    expect(entryHashFrom('<script src="/node_modules/expo-router/entry.bundle?platform=web"></script>')).toBeNull();
    expect(entryHashFrom('')).toBeNull();
    expect(entryHashFrom(undefined)).toBeNull();
  });
  it('só há versão nova quando os dois hashes existem e diferem', () => {
    expect(isNewerBuild('aaaaaaaa', 'bbbbbbbb')).toBe(true);
    expect(isNewerBuild('aaaaaaaa', 'aaaaaaaa')).toBe(false);
    expect(isNewerBuild(null, 'bbbbbbbb')).toBe(false);
    expect(isNewerBuild('aaaaaaaa', null)).toBe(false);
  });
});
