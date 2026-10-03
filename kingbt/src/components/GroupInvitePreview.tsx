import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import type { GroupPreview } from '@/firebase/groupCodes';

/** Em que pé está a pessoa com este grupo. */
export type InviteStatus = 'none' | 'member' | 'pending';

interface Props {
  preview: GroupPreview;
  status: InviteStatus;
  busy?: boolean;
  onRequest: () => void;
  /** Já é membro: abre o grupo. */
  onOpen?: () => void;
  onBack: () => void;
}

/**
 * Como a pessoa vê o grupo ao abrir um convite, ANTES de pedir para entrar:
 * nome, privacidade e descrição. Entrar depende da aprovação de um admin.
 */
export function GroupInvitePreview({ preview, status, busy, onRequest, onOpen, onBack }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const name = preview.name || `Grupo ${preview.code}`;

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <View style={s.band} />
        <View style={s.body}>
          <View style={s.logo}><Text style={s.logoEmoji}>🐝</Text></View>
          <Text style={s.tag}>{preview.visibility === 'publico' ? 'PÚBLICO' : 'PRIVADO'}</Text>
          <Text style={s.name}>{name}</Text>
          <Text style={s.desc}>{preview.description || 'Este grupo ainda não tem descrição.'}</Text>
          <Text style={s.code}>Código {preview.code}</Text>

          {status === 'member' ? (
            <TouchableOpacity style={s.primary} onPress={onOpen} activeOpacity={0.85} accessibilityRole="button">
              <Text style={s.primaryText}>Você já é membro · Abrir grupo</Text>
            </TouchableOpacity>
          ) : status === 'pending' ? (
            <View style={[s.primary, s.primaryOff]}>
              <Text style={[s.primaryText, { color: Colors.gold }]}>Pedido enviado · aguardando o admin</Text>
            </View>
          ) : (
            <TouchableOpacity style={[s.primary, busy && { opacity: 0.6 }]} onPress={onRequest} disabled={busy} activeOpacity={0.85} accessibilityRole="button">
              {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.primaryText}>Pedir para entrar</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.secondary} onPress={onBack} disabled={busy} accessibilityRole="button">
            <Text style={s.secondaryText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {status === 'none' && (
        <View style={s.info}>
          <Text style={s.infoText}>
            <Text style={s.infoStrong}>Depois do pedido: </Text>
            o administrador recebe um aviso, vê o seu nome e toca em Aprovar ou Recusar. Até lá você não vê os eventos, rankings e conquistas do grupo.
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: Spacing.md },
  card: { backgroundColor: Colors.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden' },
  band: { height: 6, backgroundColor: Colors.gold },
  body: { padding: Spacing.lg, alignItems: 'center', gap: 6 },
  logo: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: Colors.gold, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 30 },
  tag: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.gold, marginTop: 6 },
  name: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 31, color: Colors.text, textAlign: 'center' },
  desc: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: Colors.muted, textAlign: 'center', marginVertical: 4 },
  code: { fontFamily: FontFamily.number, fontSize: 13, letterSpacing: 1, color: Colors.faint, marginBottom: 6 },
  primary: { alignSelf: 'stretch', minHeight: 52, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md, marginTop: 4 },
  primaryOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.gold },
  primaryText: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.bg, textAlign: 'center' },
  secondary: { alignSelf: 'stretch', minHeight: 46, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  info: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md },
  infoText: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 21, color: Colors.muted },
  infoStrong: { fontFamily: FontFamily.titleBold, color: Colors.text },
});
