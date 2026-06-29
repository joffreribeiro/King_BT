import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Logger } from '@/services/Logger';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  label?: string; // nome do componente para logging
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    Logger.error(
      `ErrorBoundary [${this.props.label ?? 'unknown'}] capturou erro`,
      error,
      { componentStack: errorInfo.componentStack }
    );
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }
      return <DefaultFallback error={this.state.error} retry={this.retry} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>⚠️</Text>
      <Text style={s.title}>Algo deu errado</Text>
      <Text style={s.message}>
        {error.message || 'Um erro inesperado ocorreu.'}
      </Text>
      {__DEV__ && (
        <ScrollView style={s.stackWrap}>
          <Text style={s.stack}>{error.stack}</Text>
        </ScrollView>
      )}
      <TouchableOpacity style={s.button} onPress={retry} activeOpacity={0.8}>
        <Text style={s.buttonText}>Tentar novamente</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  icon:    { fontSize: 48 },
  title:   { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  message: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 22 },
  stackWrap: { maxHeight: 120, width: '100%', backgroundColor: Colors.surf, borderRadius: Radius.sm, padding: Spacing.sm },
  stack:   { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  button:  { backgroundColor: Colors.gold, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.md },
  buttonText: { fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.bg },
});
