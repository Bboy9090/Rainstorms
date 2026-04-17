import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { BASE_URL } from '../utils/api';

interface Props {
  children: React.ReactNode;
}

export function NativeBackendGuard({ children }: Props) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  if (!BASE_URL) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Backend Not Configured</Text>
        <Text style={styles.body}>
          This build is missing a backend URL. Set{' '}
          <Text style={styles.code}>EXPO_PUBLIC_BACKEND_URL</Text> to your
          deployed server address and rebuild the app.
        </Text>
        <Text style={styles.hint}>
          Example:{'\n'}
          EXPO_PUBLIC_BACKEND_URL=https://your-api.example.com
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  code: {
    color: '#7dd3fc',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  hint: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
});
