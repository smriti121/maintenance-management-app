import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/maintenance';
import { showAlert } from '@/utils/alert';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);

  // Auto-redirect if already logged in with a valid session
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          const userRole = profile?.role || session.user.user_metadata?.role || 'user';

          if (userRole === 'maintenance_staff') {
            router.replace('/staff/dashboard');
            return;
          } else {
            router.replace('/user/dashboard');
            return;
          }
        }
      } catch (e) {
        console.log('Session check error:', e);
      } finally {
        setInitialChecking(false);
      }
    }

    checkExistingSession();
  }, []);

  function handleTabChange(toSignUp: boolean) {
    setIsSignUp(toSignUp);
    setEmail('');
    setPassword('');
    setFullName('');
  }

  async function handleSignIn() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showAlert('Missing Information', 'Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      await supabase.auth.signOut();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Login failed. Please check your email and password.');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const userRole = profile?.role || authData.user.user_metadata?.role || 'user';

      if (userRole !== role) {
        await supabase.auth.signOut();
        const actualRoleName = userRole === 'maintenance_staff' ? 'Maintenance Staff' : 'Resident';
        const selectedRoleName = role === 'maintenance_staff' ? 'Maintenance Staff' : 'Resident';

        showAlert(
          'Access Restriction 🔒',
          `Your account is registered as "${actualRoleName}". You cannot log in under the "${selectedRoleName}" option.\n\nPlease select the "${actualRoleName}" option and try again.`
        );
        return;
      }

      if (userRole === 'maintenance_staff') {
        router.replace('/staff/dashboard');
      } else {
        router.replace('/user/dashboard');
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      showAlert('Login Notice', err?.message || 'Could not authenticate user.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanName || !cleanEmail || !password) {
      showAlert('Missing Fields', 'Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      showAlert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await supabase.auth.signOut();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role,
          },
        },
      });

      if (authError) {
        const errLower = authError.message.toLowerCase();
        if (errLower.includes('already registered') || errLower.includes('user already exists')) {
          showAlert(
            'Account Already Exists ⚠️',
            `An account with email "${cleanEmail}" is already registered in the system.\n\nPlease switch to the "Sign In" tab to log in with your email and password.`
          );
          return;
        }

        if (errLower.includes('rate limit')) {
          throw new Error(
            'Supabase Email Rate Limit Exceeded: Multiple registration emails sent recently. Please wait a few minutes or sign in.'
          );
        }

        throw new Error(authError.message || 'Could not register account in Supabase.');
      }

      if (!authData.user) {
        throw new Error('Account registration failed.');
      }

      const userIdentities = authData.user.identities || [];
      if (userIdentities.length === 0) {
        showAlert(
          'Account Already Exists ⚠️',
          `An account with email "${cleanEmail}" is already registered in the system.\n\nPlease switch to the "Sign In" tab to log in with your email and password.`
        );
        return;
      }

      const newUserId = authData.user.id;

      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      const activeUserId = signInData?.user?.id || newUserId;

      const { error: profileError } = await supabase.from('profiles').insert({
        id: activeUserId,
        email: cleanEmail,
        full_name: cleanName,
        role,
      });

      if (profileError && profileError.code === '23505') {
        showAlert(
          'Account Already Exists ⚠️',
          `An account with email "${cleanEmail}" is already registered in the system.\n\nPlease switch to the "Sign In" tab to log in with your email and password.`
        );
        return;
      }

      showAlert(
        'Account Registered! 🎉',
        `Welcome ${cleanName}! Your ${role === 'maintenance_staff' ? 'Maintenance Staff' : 'Resident'} account has been created.`,
        () => {
          if (role === 'maintenance_staff') {
            router.replace('/staff/dashboard');
          } else {
            router.replace('/user/dashboard');
          }
        }
      );
    } catch (err: any) {
      showAlert('Registration Notice', err?.message || 'An error occurred during account registration.');
    } finally {
      setLoading(false);
    }
  }

  if (initialChecking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={ExecutiveTheme.colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Logo & Header — Luxury Gradient Emblem */}
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={28} color="#FFFFFF" />
          </View>

          <Text style={styles.appTitle}>FixFlow</Text>
          <Text style={styles.appSubtitle}>Smart Maintenance Management</Text>

          {/* Segmented Control Tab Switcher with Vector Icons */}
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentTab, !isSignUp && styles.activeSegmentTab]}
              onPress={() => handleTabChange(false)}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={!isSignUp ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
                style={styles.tabIcon}
              />
              <Text style={[styles.segmentText, !isSignUp && styles.activeSegmentText]}>
                Sign In
              </Text>
            </Pressable>

            <Pressable
              style={[styles.segmentTab, isSignUp && styles.activeSegmentTab]}
              onPress={() => handleTabChange(true)}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={isSignUp ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
                style={styles.tabIcon}
              />
              <Text style={[styles.segmentText, isSignUp && styles.activeSegmentText]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* Card Form */}
          <View style={styles.card}>
            {/* Role Picker */}
            <Text style={styles.sectionLabel}>
              {isSignUp ? 'SELECT ACCOUNT TYPE' : 'SIGN IN PORTAL'}
            </Text>

            <View style={styles.rolePicker}>
              {/* Resident Role Option */}
              <Pressable
                style={[
                  styles.roleCard,
                  role === 'user' && styles.roleCardActive,
                ]}
                onPress={() => setRole('user')}
              >
                <View style={[styles.roleIconCircle, role === 'user' && styles.roleIconCircleActive]}>
                  <Ionicons
                    name="home"
                    size={20}
                    color={role === 'user' ? '#FFFFFF' : ExecutiveTheme.colors.brandPrimary}
                  />
                </View>
                <Text style={[styles.roleTitle, role === 'user' && styles.roleTitleActive]}>
                  Resident
                </Text>
                <Text style={styles.roleSubtext}>
                  {isSignUp ? 'Report & Track' : 'Resident Portal'}
                </Text>
              </Pressable>

              {/* Maintenance Staff Option */}
              <Pressable
                style={[
                  styles.roleCard,
                  role === 'maintenance_staff' && styles.roleCardActive,
                ]}
                onPress={() => setRole('maintenance_staff')}
              >
                <View style={[styles.roleIconCircle, role === 'maintenance_staff' && styles.roleIconCircleActive]}>
                  <Ionicons
                    name="construct"
                    size={20}
                    color={role === 'maintenance_staff' ? '#FFFFFF' : ExecutiveTheme.colors.brandPrimary}
                  />
                </View>
                <Text style={[styles.roleTitle, role === 'maintenance_staff' && styles.roleTitleActive]}>
                  Technician
                </Text>
                <Text style={styles.roleSubtext}>
                  {isSignUp ? 'Receive & Resolve' : 'Staff Portal'}
                </Text>
              </Pressable>
            </View>

            {/* Inputs Group */}
            <View style={styles.inputGroup}>
              {isSignUp && (
                <>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alex Rivera"
                    placeholderTextColor={ExecutiveTheme.colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isSignUp
                    ? `Create ${role === 'maintenance_staff' ? 'Technician' : 'Resident'} Account`
                    : `Sign In as ${role === 'maintenance_staff' ? 'Technician' : 'Resident'}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logoCircle: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    ...ExecutiveTheme.shadows.card,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 20,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabIcon: {
    marginRight: 6,
  },
  activeSegmentTab: {
    backgroundColor: ExecutiveTheme.colors.surface,
    ...ExecutiveTheme.shadows.soft,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  activeSegmentText: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    ...ExecutiveTheme.shadows.card,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  rolePicker: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ExecutiveTheme.colors.border,
  },
  roleCardActive: {
    backgroundColor: ExecutiveTheme.colors.brandLightMuted,
    borderColor: ExecutiveTheme.colors.brandPrimary,
    ...ExecutiveTheme.shadows.soft,
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  roleIconCircleActive: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderColor: ExecutiveTheme.colors.brandPrimary,
  },
  roleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  roleTitleActive: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
  roleSubtext: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.4,
  },
  input: {
    height: 46,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  submitButton: {
    height: 48,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...ExecutiveTheme.shadows.soft,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    backgroundColor: '#A5B4FC',
  },
});
