import { View } from 'react-native';
import Svg, { Path, Circle, Ellipse, Line, Rect } from 'react-native-svg';
import { useTheme } from '@/store/ThemeContext';
import type { SkillKey } from '@/logic/skills';

/**
 * Ícone de cada habilidade: desenho em linha dourada (viewBox 24x24) dentro de
 * um círculo escuro com borda dourada, no estilo dos ícones do Atlas.
 */
function Glyph({ skill, c }: { skill: SkillKey; c: string }) {
  const p = { stroke: c, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (skill) {
    case 'smash': // raquete com a bola descendo em velocidade
      return (<>
        <Ellipse cx="14.5" cy="9.5" rx="5" ry="6" transform="rotate(35 14.5 9.5)" {...p} />
        <Line x1="10.6" y1="14.2" x2="4.5" y2="20.5" {...p} />
        <Line x1="3.5" y1="4" x2="6.5" y2="7" {...p} />
        <Line x1="2.5" y1="8" x2="5" y2="10.2" {...p} />
      </>);
    case 'lob': // trajetória em arco por cima, com a bola no ponto mais alto
      return (<>
        <Path d="M3.5 19 Q12 -3 20.5 19" strokeDasharray="2 3" {...p} />
        <Circle cx="12" cy="6.2" r="2.2" fill={c} stroke={c} />
        <Line x1="3" y1="20.5" x2="21" y2="20.5" {...p} />
      </>);
    case 'defesa': // escudo
      return (<Path d="M12 3 L19.5 6 V11.5 C19.5 16 16.3 19.5 12 21 C7.7 19.5 4.5 16 4.5 11.5 V6 Z" {...p} />);
    case 'voleio': // rede com a bola sobre ela
      return (<>
        <Rect x="3.5" y="10" width="17" height="9" rx="1" {...p} />
        <Line x1="9" y1="10" x2="9" y2="19" {...p} />
        <Line x1="15" y1="10" x2="15" y2="19" {...p} />
        <Line x1="3.5" y1="14.5" x2="20.5" y2="14.5" {...p} />
        <Circle cx="12" cy="5.5" r="2" fill={c} stroke={c} />
      </>);
    case 'curtinha': // bola que passa a rede e cai curta logo depois dela
      return (<>
        <Line x1="9" y1="10" x2="9" y2="20" {...p} />
        <Line x1="9" y1="11" x2="9" y2="11" {...p} />
        <Path d="M3.5 8 Q9 2 15 15" strokeDasharray="2 2.5" {...p} />
        <Circle cx="16" cy="17.5" r="2.4" fill={c} stroke={c} />
        <Line x1="3" y1="20.5" x2="21" y2="20.5" {...p} />
      </>);
    case 'saque': // bola lançada para o alto
      return (<>
        <Circle cx="12" cy="6.5" r="3" {...p} />
        <Path d="M12 11 V19" {...p} />
        <Path d="M8.5 15 L12 11.5 L15.5 15" {...p} />
        <Line x1="5" y1="20.5" x2="19" y2="20.5" {...p} />
      </>);
    case 'movimentacao': // setas de deslocamento rápido
      return (<>
        <Path d="M4 6.5 L9 12 L4 17.5" {...p} />
        <Path d="M10 6.5 L15 12 L10 17.5" {...p} />
        <Path d="M16 6.5 L21 12 L16 17.5" {...p} />
      </>);
    case 'posicionamento': // marcador de local
      return (<>
        <Path d="M12 21 C7.5 15.5 5.5 12.6 5.5 9.5 A6.5 6.5 0 0 1 18.5 9.5 C18.5 12.6 16.5 15.5 12 21 Z" {...p} />
        <Circle cx="12" cy="9.5" r="2.4" {...p} />
      </>);
    case 'mental': // lâmpada (ideia / foco)
      return (<>
        <Path d="M9 17.5 H15" {...p} />
        <Path d="M10 20.5 H14" {...p} />
        <Path d="M8.5 14.5 C6.5 13 5.5 11.3 5.5 9 A6.5 6.5 0 0 1 18.5 9 C18.5 11.3 17.5 13 15.5 14.5 V16 H8.5 Z" {...p} />
        <Path d="M10.5 9.5 L12 11 L13.5 9.5" {...p} />
      </>);
    case 'consistencia': // alvo com mira no centro
      return (<>
        <Circle cx="12" cy="12" r="8.5" {...p} />
        <Circle cx="12" cy="12" r="4.8" {...p} />
        <Circle cx="12" cy="12" r="1.3" fill={c} stroke={c} />
      </>);
  }
}

export function SkillIcon({ skill, size = 40 }: { skill: SkillKey; size?: number }) {
  const { colors: Colors } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold + '99',
    }}>
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
        <Glyph skill={skill} c={Colors.gold} />
      </Svg>
    </View>
  );
}
