import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/utils/theme';
import { AuthProvider } from '../src/context/AuthContext';
import { ProjectProvider } from '../src/context/ProjectContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProjectProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bgStart },
              animation: 'fade',
            }}
          />
          <Analytics />
        </ProjectProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
