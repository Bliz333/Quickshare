import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 24,
    width: '100%',
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
