import React, { createContext, useContext, useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const AUTH_CONFIG_KEY = '@budget_app_auth_config';

interface AuthContextType {
  useBiometrics: boolean;
  isUnlocked: boolean;
  loading: boolean;
  authenticateBiometrics: () => Promise<{ success: boolean; error: string | null }>;
  toggleBiometrics: (value: boolean) => Promise<boolean>;
  setUnlocked: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUseBiometrics(parsed.useBiometrics);
        // Initially unlocked only if biometrics are NOT required
        setIsUnlocked(!parsed.useBiometrics);
      } else {
          // Default: no biometrics, app is unlocked
          setIsUnlocked(true);
      }
    } catch (e) {
      console.error('Failed to load auth config', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (biometricsValue: boolean) => {
    try {
      setUseBiometrics(biometricsValue);
      await AsyncStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify({
        useBiometrics: biometricsValue,
      }));
    } catch (e) {
      console.error('Failed to save auth config', e);
    }
  };

  const authenticateBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        Alert.alert('Not Supported', 'Your device does not support biometric authentication.');
        return { success: false, error: 'Hardware not available' };
      }

      if (!isEnrolled) {
          // On many devices, calling authenticateAsync will still show the system prompt 
          // and allow the user to use their device passcode even if face/finger is not enrolled.
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vridhi',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setIsUnlocked(true);
      } else if (result.error && result.error !== 'user_cancel' && result.error !== 'app_cancel' && result.error !== 'user_fallback') {
          Alert.alert('Authentication Failed', `Error: ${result.error}. please ensure biometrics are set up in your device settings.`);
      }

      return { success: result.success, error: result.success ? null : (result.error || 'Authentication failed') };
    } catch (e) {
      console.error('Biometric error:', e);
      Alert.alert('Error', 'An unexpected error occurred during authentication.');
      return { success: false, error: 'An error occurred' };
    }
  };

  const toggleBiometrics = async (value: boolean) => {
    if (value) {
      const result = await authenticateBiometrics();
      if (result.success) {
        await saveConfig(true);
        return true;
      }
      return false;
    } else {
      await saveConfig(false);
      return true;
    }
  };

  return (
    <AuthContext.Provider value={{
      useBiometrics,
      isUnlocked,
      loading,
      authenticateBiometrics,
      toggleBiometrics,
      setUnlocked: setIsUnlocked,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
