import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { BASE_URL } from '../utils/api';

interface Props {
  children: React.ReactNode;
}

type CheckState = 'loading' | 'ok' | 'missing' | 'unreachable';

async function probeBackend(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`${baseUrl}/api/ready`, { signal: controller.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function NativeBackendGuard({ children }: Props) {
  const [state, setState] = useState<CheckState>('loading');

  const runCheck = async () => {
    setState('loading');

    if (!BASE_URL) {
      setState('missing');
      return;
    }

    const reachable = await probeBackend(BASE_URL);
    setState(reachable ? 'ok' : 'unreachable');
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      runCheck();
    }
  }, []);

  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  if (state === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7dd3fc" />
        <Text style={styles.loadingText}>Connecting to server…</Text>
        {!!BASE_URL && (
          <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
            {BASE_URL}
          </Text>
        )}
      </View>
    );
  }

  if (state === 'missing') {
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

  if (state === 'unreachable') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Cannot Reach Server</Text>
        <Text style={styles.body}>
          The app could not connect to its backend. Check that the server is
          running and your device has internet access.
        </Text>
        <Text style={styles.urlText} numberOfLines={2} ellipsizeMode="middle">
          {BASE_URL}
        </Text>
        <Pressable style={styles.retryButton} onPress={runCheck}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
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
  loadingText: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 20,
    marginBottom: 8,
  },
  urlText: {
    color: '#555',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textAlign: 'center',
    maxWidth: '100%',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#7dd3fc',
    fontSize: 15,
    fontWeight: '600',
  },
});
