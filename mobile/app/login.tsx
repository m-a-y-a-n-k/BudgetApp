import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/hooks/useAuth';
import { COLORS, SIZES, SHADOWS } from '@/src/theme';

export default function LoginScreen() {
  const { authenticateBiometrics, useBiometrics, isUnlocked, loading, setUnlocked } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (isUnlocked) {
        router.replace('/(tabs)');
      } else if (useBiometrics) {
        handleBiometricAuth();
      } else {
          // If biometrics is off, we just auto-unlock (local app, no remote auth)
          setUnlocked(true);
      }
      setIsReady(true);
    }
  }, [loading, isUnlocked, useBiometrics]);

  const handleBiometricAuth = async () => {
    const result = await authenticateBiometrics();
    if (result.success) {
      router.replace('/(tabs)');
    }
  };

  if (loading || !isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.background}
      />
      
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.title}>Vridhi</Text>
          <Text style={styles.subtitle}>Grow Your Wealth</Text>
        </View>

        <View style={styles.buttonContainer}>
          {useBiometrics ? (
            <TouchableOpacity 
              style={[styles.unlockButton, SHADOWS.medium]} 
              onPress={handleBiometricAuth}
            >
              <Text style={styles.unlockButtonText}>Unlock App</Text>
            </TouchableOpacity>
          ) : (
             <TouchableOpacity 
              style={[styles.unlockButton, SHADOWS.medium]} 
              onPress={() => setUnlocked(true)}
            >
              <Text style={styles.unlockButtonText}>Enter App</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.footerText}>
            Your data is stored locally on your device.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    padding: SIZES.padding * 2,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 40,
    alignItems: 'center',
  },
  unlockButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: SIZES.radius,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unlockButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 24,
    textAlign: 'center',
  },
});
