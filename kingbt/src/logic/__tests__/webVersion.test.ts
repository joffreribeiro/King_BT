import { entryHashFrom, isNewerBuild, shaFromVersionJson } from '@/logic/webVersion';

describe('version.json do APK', () => {
  it('lê o commit publicado e ignora lixo', () => {
    expect(shaFromVersionJson({ sha: 'e8bfaac0123456789abcdef0123456789abcdef0' })).toBe('e8bfaac0123456789abcdef0123456789abcdef0');
    expect(shaFromVersionJson({ sha: 'zzz' })).toBeNull();
    expect(shaFromVersionJson({})).toBeNull();
    expect(shaFromVersionJson(null)).toBeNull();
    expect(shaFromVersionJson('texto')).toBeNull();
  });
});

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
