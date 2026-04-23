import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Theme } from '../theme';

interface LoginFormProps {
  loading: boolean;
  googleEnabled: boolean;
  error: string | null;
  googleLoading: boolean;
  password: string;
  username: string;
  onGoogleSubmit: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onUsernameChange: (value: string) => void;
}

export function LoginForm({
  loading,
  googleEnabled,
  error,
  googleLoading,
  password,
  username,
  onGoogleSubmit,
  onPasswordChange,
  onSubmit,
  onUsernameChange,
}: LoginFormProps) {
  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>Q</Text>
        </View>
      </View>
      <Text style={styles.eyebrow}>QuickShare Mobile</Text>
      <Text style={styles.title}>Sign in to your account</Text>
      <Text style={styles.description}>
        Sign in to access your files, share links, pickup flows, and account details from the mobile app.
      </Text>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        onChangeText={onUsernameChange}
        placeholder="Username"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={username}
      />
      <TextInput
        editable={!loading}
        onChangeText={onPasswordChange}
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={onSubmit}
        style={({ pressed }) => [styles.button, pressed && !loading ? styles.buttonPressed : null, loading ? styles.buttonDisabled : null]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>

      {googleEnabled ? (
        <Pressable
          disabled={googleLoading}
          onPress={onGoogleSubmit}
          style={({ pressed }) => [styles.googleButton, pressed && !googleLoading ? styles.buttonPressed : null, googleLoading ? styles.buttonDisabled : null]}
        >
          {googleLoading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.surface,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radius3xl,
    borderWidth: 1,
    gap: Theme.space6,
    overflow: 'hidden',
    padding: Theme.space12,
    width: '100%',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: Theme.space12,
    right: Theme.space12,
    height: 3,
    backgroundColor: Theme.primary,
    borderBottomLeftRadius: Theme.radiusFull,
    borderBottomRightRadius: Theme.radiusFull,
  },
  brandRow: {
    alignItems: 'center',
    marginTop: Theme.space2,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.radiusXl,
    backgroundColor: Theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeXl,
    fontWeight: '800',
  },
  eyebrow: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeSm,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  title: {
    color: Theme.text,
    fontSize: Theme.fontSize2xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
    lineHeight: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Theme.surfaceSunken,
    borderColor: Theme.borderInput,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    minHeight: Theme.touchMin,
    paddingHorizontal: Theme.space7,
    paddingVertical: Theme.space6,
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeLg,
    fontWeight: '700',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: Theme.surfaceTint,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  googleButtonText: {
    color: Theme.text,
    fontSize: Theme.fontSizeLg,
    fontWeight: '700',
  },
});
