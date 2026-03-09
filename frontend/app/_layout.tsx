import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ProjectProvider } from '../src/context/ProjectContext';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' },
            animation: 'fade',
          }}
        />
        <Analytics />
      </ProjectProvider>
    </AuthProvider>
  );
}
