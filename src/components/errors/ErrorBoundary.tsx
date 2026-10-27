import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { recordCrash } from '../../services/crash/crashLog';
import { typography } from '../../theme/typography';
import { t } from '../../i18n';

type Props = {
  children: React.ReactNode;
  /** Where the boundary sits (screen name), stored with the crash entry. */
  scope?: string;
};

type State = { error: Error | null };

/**
 * Catches render errors so one broken screen shows a recoverable message instead of
 * taking the whole app down. Uses fixed colors: the theme itself might be what broke.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    recordCrash(error, {
      kind: 'render',
      fatal: false,
      scope: this.props.scope,
      componentStack: info.componentStack ?? undefined,
    });
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    const copy = t().crash;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        {__DEV__ ? <Text style={styles.detail}>{`${error.name}: ${error.message}`}</Text> : null}
        <Pressable accessibilityRole="button" onPress={this.retry} style={styles.button}>
          <Text style={styles.buttonLabel}>{copy.retry}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDE3E5', justifyContent: 'center', padding: 24, gap: 16 },
  title: {
    color: '#111316',
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'right',
  },
  body: {
    color: '#454B53',
    fontSize: 15,
    lineHeight: 26,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'right',
  },
  detail: { color: '#5F656D', fontSize: 12, textAlign: 'left' },
  button: {
    backgroundColor: '#111316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonLabel: { color: '#fff', fontSize: 16, fontFamily: typography.fontFamily.semibold },
});

/**
 * Navigator `screenLayout`: one boundary per screen, so a crash in one screen leaves the
 * rest of the app usable. Defined once at module level so React keeps the same type.
 */
export function screenErrorLayout({
  children,
  route,
}: {
  children: React.ReactNode;
  route: { name: string };
}) {
  return <ErrorBoundary scope={route.name}>{children}</ErrorBoundary>;
}
