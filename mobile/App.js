import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function App() {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system');
  const theme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const isDark = theme === 'dark';
  const colors = useMemo(() => (
    isDark
      ? { bg: '#050505', card: '#111111', text: '#f5f5f5', muted: '#a3a3a3', inverse: '#050505' }
      : { bg: '#f4f4f4', card: '#ffffff', text: '#111111', muted: '#5a5a5a', inverse: '#ffffff' }
  ), [isDark]);

  const cycleTheme = () => {
    setPreference((current) => {
      if (current === 'system') return 'light';
      if (current === 'light') return 'dark';
      return 'system';
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: isDark ? '#2a2a2a' : '#e2e2e2' }]}>
        <Text style={[styles.kicker, { color: colors.muted }]}>NOTALLOWEDROOM</Text>
        <Text style={[styles.title, { color: colors.text }]}>NAR</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>
          Black-and-white rooms for chat and calls. Theme follows your system unless you override it.
        </Text>
        <Pressable
          onPress={cycleTheme}
          style={[styles.button, { backgroundColor: colors.text }]}
          accessibilityRole="button"
          accessibilityLabel={`Theme is ${preference}. Switch theme.`}
        >
          <Text style={[styles.buttonLabel, { color: colors.inverse }]}>
            {preference === 'system' ? 'System theme' : preference === 'dark' ? 'Dark mode' : 'Light mode'}
          </Text>
        </Pressable>
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    gap: 10,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
