import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
      // 1. Purge previous session
      await supabase.auth.signOut();

      // 2. Supabase Auth Sign In
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Login failed. Please check your email and password.');
      }

      // 3. Fetch Registered Role from `profiles` table
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const registeredRole: UserRole =
        profile?.role || authData.user.user_metadata?.role || 'user';

      // 4. Strict RBAC Enforcement
      if (registeredRole !== role) {
        await supabase.auth.signOut();

        const actualRoleName = registeredRole === 'maintenance_staff' ? 'Maintenance Staff' : 'Resident / User';
        const selectedRoleName = role === 'maintenance_staff' ? 'Maintenance Staff' : 'Resident / User';

        showAlert(
          'Access Denied (RBAC) 🚫',
          `Your account is registered as "${actualRoleName}". You cannot log in under the "${selectedRoleName}" option.\n\nPlease select the "${actualRoleName}" option and try again.`
        );
        return;
      }

      // 5. Ensure profile exists
      if (!profile) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email: cleanEmail,
          full_name: authData.user.user_metadata?.full_name || 'User',
          role: registeredRole,
        });
      }

      // 6. Route to role-verified dashboard
      if (registeredRole === 'maintenance_staff') {
        router.replace('/staff/dashboard');
      } else {
        router.replace('/user/dashboard');
      }
    } catch (err: any) {
      showAlert('Login Failed', err?.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password || !cleanName) {
      showAlert('Missing Information', 'Please fill in your name, email, and password.');
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
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* iOS Logo & Header */}
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🛠️</Text>
          </View>

          <Text style={styles.appTitle}>FixFlow</Text>
          <Text style={styles.appSubtitle}>Smart Maintenance Management</Text>

          {/* iOS Segmented Control Tab Switcher */}
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentTab, !isSignUp && styles.activeSegmentTab]}
              onPress={() => handleTabChange(false)}
            >
              <Text style={[styles.segmentText, !isSignUp && styles.activeSegmentText]}>
                Sign In
              </Text>
            </Pressable>

            <Pressable
              style={[styles.segmentTab, isSignUp && styles.activeSegmentTab]}
              onPress={() => handleTabChange(true)}
            >
              <Text style={[styles.segmentText, isSignUp && styles.activeSegmentText]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {/* iOS Inset Card Form */}
          <View style={styles.card}>
            {/* Role Picker */}
            <Text style={styles.sectionLabel}>
              {isSignUp ? 'SELECT ACCOUNT TYPE' : 'LOGGING IN AS'}
            </Text>
            
            <View style={styles.rolePicker}>
              <Pressable
                style={[
                  styles.roleCard,
                  role === 'user' && styles.roleCardActive,
                ]}
                onPress={() => setRole('user')}
              >
                <View style={[styles.roleIconCircle, role === 'user' && styles.roleIconCircleActive]}>
                  <Text style={styles.roleIcon}>👤</Text>
                </View>
                <Text style={[styles.roleTitle, role === 'user' && styles.roleTitleActive]}>
                  Resident
                </Text>
                <Text style={styles.roleSubtext}>
                  {isSignUp ? 'Report & Track' : 'Resident Portal'}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.roleCard,
                  role === 'maintenance_staff' && styles.roleCardActive,
                ]}
                onPress={() => setRole('maintenance_staff')}
              >
                <View style={[styles.roleIconCircle, role === 'maintenance_staff' && styles.roleIconCircleActive]}>
                  <Text style={styles.roleIcon}>🔧</Text>
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
                    placeholderTextColor="#8E8E93"
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
                placeholderTextColor="#8E8E93"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#8E8E93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* iOS System Blue Button */}
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
    backgroundColor: '#F2F2F7',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    maxWidth: 460,
    alignSelf: 'center',
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logoIcon: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 20,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeSegmentTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeSegmentText: {
    color: '#000000',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  rolePicker: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  roleCard: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleCardActive: {
    backgroundColor: '#EBF4FF',
    borderColor: '#007AFF',
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleIconCircleActive: {
    backgroundColor: '#007AFF',
  },
  roleIcon: {
    fontSize: 18,
  },
  roleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  roleTitleActive: {
    color: '#007AFF',
  },
  roleSubtext: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  input: {
    height: 48,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  submitButton: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#A2CAFC',
  },
});
