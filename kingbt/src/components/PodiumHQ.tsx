import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Polygon, Circle, Ellipse } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '@/theme';

const { width: SW } = Dimensions.get('window');

export interface PodiumEntry {
  name: string;
  points: number;
  color: string;
}

interface PodiumHQProps {
  first:  PodiumEntry;
  second: PodiumEntry;
  third:  PodiumEntry;
}

const C = {
  gold:   '#F5C842',
  silver: '#C0CAD2',
  bronze: '#D08840',
};

function Sparkle({ x, y, delay, size = 5 }: { x: number; y: number; delay: number; size?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#FDD844',
      opacity: anim,
      transform: [{ scale: anim }],
    }} />
  );
}

function Crown({ type, size = 56 }: { type: 'gold' | 'silver' | 'bronze'; size?: number }) {
  const colors = {
    gold:   { top: '#FFE860', mid: '#F0B820', bot: '#8A5E04', band: '#E8B820', gem: '#FFF8A0' },
    silver: { top: '#E8EDF2', mid: '#B0BCC6', bot: '#60707A', band: '#D0D8E0', gem: '#A0B0C0' },
    bronze: { top: '#E89050', mid: '#C06820', bot: '#6A3208', band: '#D87828', gem: '#C07030' },
  }[type];
  const isGold = type === 'gold';
  const vbW = isGold ? 130 : 110;
  const vbH = isGold ? 84  : 72;
  const ratio = size / Math.max(vbW, vbH);
  const dw = vbW * ratio;
  const dh = vbH * ratio;

  return (
    <View style={{ width: dw, height: dh }}>
      <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={dw} height={dh}>
        <Defs>
          <LinearGradient id={`cv-${type}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={colors.top}/>
            <Stop offset="35%"  stopColor={colors.mid}/>
            <Stop offset="100%" stopColor={colors.bot}/>
          </LinearGradient>
          <LinearGradient id={`cb-${type}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%"   stopColor={colors.bot}/>
            <Stop offset="50%"  stopColor={colors.band}/>
            <Stop offset="100%" stopColor={colors.bot}/>
          </LinearGradient>
        </Defs>
        {isGold ? (
          <>
            <Rect x="4" y="56" width="122" height="24" rx="4" fill={`url(#cb-${type})`}/>
            <Polygon points="8,56 2,10 32,44"    fill={`url(#cv-${type})`}/>
            <Polygon points="32,56 34,26 58,56"  fill={colors.mid}/>
            <Polygon points="40,56 65,2 90,56"   fill={`url(#cv-${type})`}/>
            <Polygon points="72,56 96,26 98,56"  fill={colors.mid}/>
            <Polygon points="98,44 128,10 122,56" fill={`url(#cv-${type})`}/>
            <Circle cx="65" cy="6"  r="7"  fill={colors.gem} stroke={colors.mid} strokeWidth="2"/>
            <Circle cx="65" cy="6"  r="3.5" fill="#FFFFFF"/>
            <Circle cx="8"  cy="14" r="5"  fill={colors.mid} stroke={colors.band} strokeWidth="1.5"/>
            <Circle cx="122" cy="14" r="5" fill={colors.mid} stroke={colors.band} strokeWidth="1.5"/>
            <Ellipse cx="48" cy="61" rx="24" ry="3.5" fill="rgba(255,255,180,0.18)"/>
          </>
        ) : (
          <>
            <Rect x="4" y="48" width="102" height="20" rx="3" fill={`url(#cb-${type})`}/>
            <Polygon points="6,48 2,8 28,38"   fill={`url(#cv-${type})`}/>
            <Polygon points="28,48 30,22 52,48" fill={`url(#cv-${type})`}/>
            <Polygon points="34,48 55,2 76,48" fill={`url(#cv-${type})`}/>
            <Polygon points="58,48 80,22 82,48" fill={`url(#cv-${type})`}/>
            <Polygon points="82,38 108,8 104,48" fill={`url(#cv-${type})`}/>
            <Circle cx="55" cy="6"  r="5"  fill={colors.gem} stroke={colors.band} strokeWidth="1.5"/>
            <Circle cx="9"  cy="12" r="4"  fill={colors.gem} stroke={colors.band} strokeWidth="1.5"/>
            <Circle cx="101" cy="12" r="4" fill={colors.gem} stroke={colors.band} strokeWidth="1.5"/>
            <Ellipse cx="42" cy="52" rx="20" ry="3" fill="rgba(255,255,255,0.12)"/>
          </>
        )}
      </Svg>
    </View>
  );
}

function Pedestal({
  entry, rank, pedW, pedH, crownType, posColor, posSize, nameSize, scoreSize, withGlow,
}: {
  entry: PodiumEntry;
  rank: 1 | 2 | 3;
  pedW: number; pedH: number;
  crownType: 'gold' | 'silver' | 'bronze';
  posColor: string; posSize: number;
  nameSize: number; scoreSize: number;
  withGlow?: boolean;
}) {
  const crownSize = rank === 1 ? 62 : 52;
  const aboveH = crownSize + posSize + 20;

  return (
    <View style={{ width: pedW, alignItems: 'center' }}>
      {/* Posição + Coroa (acima do cilindro) */}
      <View style={{ height: aboveH, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
        <Text style={{
          fontFamily: FontFamily.numberBold,
          fontSize: posSize,
          color: posColor,
          lineHeight: posSize * 1.15,
          ...(rank === 1 ? {
            textShadowColor: 'rgba(255,200,0,0.9)',
            textShadowRadius: 20,
            textShadowOffset: { width: 0, height: 0 },
          } : {}),
        }}>
          {rank}º
        </Text>
        <Crown type={crownType} size={crownSize} />
      </View>

      {/* Cilindro */}
      <View style={{ width: pedW, height: pedH, borderRadius: 6, overflow: 'hidden' }}>
        {/* Corpo */}
        <ExpoLinearGradient
          colors={['#070605', '#131008', '#1e1b12', '#252118', '#1e1b12', '#131008', '#070605']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Borda dourada no topo */}
        <ExpoLinearGradient
          colors={['rgba(54,38,4,0)', '#906012', '#c89022', '#e8b820', '#c89022', '#906012', 'rgba(54,38,4,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5 }}
        />
        {/* Glow vertical para 1º */}
        {withGlow && (
          <ExpoLinearGradient
            colors={['rgba(255,200,40,0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Texto */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14, paddingHorizontal: 6, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FontFamily.titleBold,
              fontSize: nameSize,
              color: '#FFFFFF',
              letterSpacing: 1.5,
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,0.9)',
              textShadowRadius: 6,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {entry.name.toUpperCase()}
          </Text>
          <Text style={{
            fontFamily: FontFamily.numberBold,
            fontSize: scoreSize,
            color: rank === 1 ? C.gold : rank === 2 ? C.silver : C.bronze,
            letterSpacing: 1,
            ...(rank === 1 ? {
              textShadowColor: 'rgba(245,200,66,0.6)',
              textShadowRadius: 14,
              textShadowOffset: { width: 0, height: 0 },
            } : {}),
          }}>
            {entry.points.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PodiumHQ({ first, second, third }: PodiumHQProps) {
  const totalW = SW - 24;
  const ped1W  = Math.round(totalW * 0.35);
  const ped23W = Math.round(totalW * 0.295);
  const ped1H  = Math.round(totalW * 0.30);
  const ped2H  = Math.round(totalW * 0.245);
  const ped3H  = Math.round(totalW * 0.21);
  const maxAbove = 62 + 28 + 20; // crownSize + posSize + padding

  return (
    <View style={{ marginHorizontal: 12, marginBottom: 8, overflow: 'hidden', borderRadius: 12 }}>
      {/* Fundo */}
      <ExpoLinearGradient
        colors={['#060504', '#0a0806', '#060504']}
        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
      />
      {/* Glow central dourado */}
      <ExpoLinearGradient
        colors={['rgba(200,140,20,0.18)', 'rgba(100,60,0,0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: '15%', right: '15%', bottom: 0 }}
      />

      {/* Sparkles */}
      <Sparkle x={SW * 0.38} y={8}  delay={0}   size={6} />
      <Sparkle x={SW * 0.42} y={18} delay={300} size={4} />
      <Sparkle x={SW * 0.52} y={12} delay={600} size={5} />
      <Sparkle x={SW * 0.56} y={28} delay={900} size={3} />
      <Sparkle x={SW * 0.35} y={22} delay={450} size={4} />
      <Sparkle x={SW * 0.60} y={16} delay={750} size={5} />

      {/* Pedestais */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 16,
        paddingBottom: 0,
        minHeight: maxAbove + ped1H + 16,
      }}>
        <Pedestal
          entry={second} rank={2}
          pedW={ped23W}  pedH={ped2H}
          crownType="silver"
          posColor={C.silver} posSize={22}
          nameSize={13} scoreSize={18}
        />
        <Pedestal
          entry={first}  rank={1}
          pedW={ped1W}   pedH={ped1H}
          crownType="gold"
          posColor={C.gold}   posSize={28}
          nameSize={15} scoreSize={22}
          withGlow
        />
        <Pedestal
          entry={third}  rank={3}
          pedW={ped23W}  pedH={ped3H}
          crownType="bronze"
          posColor={C.bronze} posSize={22}
          nameSize={13} scoreSize={18}
        />
      </View>
    </View>
  );
}
