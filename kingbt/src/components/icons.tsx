import Svg, { Path, Circle, Line } from 'react-native-svg';

/**
 * Sistema de ícones único do app. Todos no mesmo desenho: viewBox 24×24,
 * traço de 2, pontas arredondadas e sem preenchimento — antes havia SVGs
 * inline na tab bar convivendo com emoji e glifos de texto (`⌕`, `✕`, `≡`)
 * espalhados pelas telas, cada um com um peso visual diferente.
 */
export type IconName =
  | 'feed' | 'competitions' | 'ranking' | 'profile'
  | 'crown' | 'search' | 'filter' | 'bell' | 'share' | 'clone'
  | 'trash' | 'compare' | 'clock' | 'chevronLeft' | 'close' | 'more' | 'plus'
  | 'users' | 'chart' | 'calendar' | 'settings' | 'menu'
  | 'edit' | 'qr' | 'logout' | 'swap' | 'check' | 'x' | 'comment';

type Props = { name: IconName; size?: number; color: string };

export function Icon({ name, size = 22, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths(name, stroke)}
    </Svg>
  );
}

function paths(name: IconName, s: any) {
  switch (name) {
    // ── Tab bar (mantidos exatamente como estavam no _layout) ──────────────
    case 'feed':
      return <Path d="M3 12h3l3-7 3 14 3-10 3 5h3" {...s} />;
    case 'competitions':
      return <>
        <Path d="M8 2h8v8a4 4 0 01-8 0V2z" {...s} strokeLinecap={undefined} />
        <Path d="M5 3H3v4a4 4 0 004 4M19 3h2v4a4 4 0 01-4 4M12 14v4M9 21h6" {...s} strokeLinejoin={undefined} />
      </>;
    case 'ranking':
      return <>
        <Path d="M7 3h10v9c0 2.76-2.24 5-5 5s-5-2.24-5-5V3z" {...s} strokeLinecap={undefined} />
        <Path d="M7 7H4v3a3 3 0 003 3M17 7h3v3a3 3 0 01-3 3M12 17v2M9 21h6" {...s} strokeLinejoin={undefined} />
      </>;
    case 'profile':
      return <>
        <Circle cx="12" cy="8" r="4" {...s} strokeLinecap={undefined} strokeLinejoin={undefined} />
        <Path d="M4 21c0-3.87 3.58-7 8-7s8 3.13 8 7" {...s} strokeLinejoin={undefined} />
      </>;

    // ── Novos ──────────────────────────────────────────────────────────────
    case 'crown':
      return <Path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" {...s} />;
    case 'search':
      return <>
        <Circle cx="11" cy="11" r="7" {...s} strokeLinecap={undefined} strokeLinejoin={undefined} />
        <Line x1="20" y1="20" x2="16.2" y2="16.2" {...s} strokeLinejoin={undefined} />
      </>;
    case 'filter':
      return <Path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" {...s} />;
    case 'bell':
      return <>
        <Path d="M18 9a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7z" {...s} />
        <Path d="M13.7 20a2 2 0 01-3.4 0" {...s} strokeLinejoin={undefined} />
      </>;
    case 'share':
      return <Path d="M12 16V4m0 0L8 8m4-4l4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" {...s} />;
    case 'clone':
      return <>
        <Path d="M9 3h9a2 2 0 012 2v9" {...s} />
        <Path d="M15 8H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z" {...s} />
      </>;
    case 'trash':
      return <Path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5" {...s} />;
    case 'compare':
      return <Path d="M8 4L4 8l4 4M4 8h13M16 20l4-4-4-4M20 16H7" {...s} />;
    case 'clock':
      return <>
        <Circle cx="12" cy="12" r="9" {...s} strokeLinecap={undefined} strokeLinejoin={undefined} />
        <Path d="M12 7v5l3 2" {...s} strokeLinejoin={undefined} />
      </>;
    case 'chevronLeft':
      return <Path d="M15 5l-7 7 7 7" {...s} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6L6 18" {...s} />;
    case 'more':
      return <>
        <Circle cx="5" cy="12" r="1.6" fill={s.stroke} stroke="none" />
        <Circle cx="12" cy="12" r="1.6" fill={s.stroke} stroke="none" />
        <Circle cx="19" cy="12" r="1.6" fill={s.stroke} stroke="none" />
      </>;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...s} />;
    case 'users':
      return <>
        <Circle cx="9" cy="8" r="3.5" {...s} strokeLinecap={undefined} strokeLinejoin={undefined} />
        <Path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" {...s} strokeLinejoin={undefined} />
        <Path d="M16 5.5a3.5 3.5 0 010 6.6M18 14.5c2.1.9 3.5 2.9 3.5 5.5" {...s} strokeLinejoin={undefined} />
      </>;
    case 'chart':
      return <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...s} />;
    case 'calendar':
      return <>
        <Path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" {...s} />
        <Path d="M8 2v4M16 2v4M4 10h16" {...s} strokeLinejoin={undefined} />
      </>;
    case 'settings':
      return <>
        <Circle cx="12" cy="12" r="3" {...s} strokeLinecap={undefined} strokeLinejoin={undefined} />
        <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M19.1 4.9l-2.2 2.2M7.1 16.9l-2.2 2.2" {...s} strokeLinejoin={undefined} />
      </>;
    case 'menu':
      return <Path d="M4 7h16M4 12h16M4 17h16" {...s} />;
    case 'edit':
      return <Path d="M4 20h4L20 8a2.8 2.8 0 00-4-4L4 16v4zM14 6l4 4" {...s} />;
    case 'qr':
      return <>
        <Path d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6z" {...s} />
        <Path d="M14 14h2v2h-2v-2zM18 14h2v2h-2v-2zM14 18h2v2h-2v-2zM18 18h2v2h-2v-2z" {...s} />
      </>;
    case 'logout':
      return <Path d="M9 20H6a2 2 0 01-2-2V6a2 2 0 012-2h3M16 16l4-4-4-4M20 12H9" {...s} />;
    case 'swap':
      return <Path d="M4 8h13l-3-3M20 16H7l3 3" {...s} />;
    case 'check':
      return <Path d="M4 12.5l5 5L20 6.5" {...s} />;
    case 'x':
      return <Path d="M6 6l12 12M18 6L6 18" {...s} />;
    case 'comment':
      return <Path d="M20 12a7.5 7.5 0 01-10.9 6.7L4 20l1.3-4.1A7.5 7.5 0 1120 12z" {...s} />;
  }
}
