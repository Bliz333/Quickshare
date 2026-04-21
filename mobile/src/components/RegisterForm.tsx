import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface RegisterFormProps {
  email: string;
  emailVerificationEnabled: boolean;
  error: string | null;
  loading: boolean;
  nickname: string;
  password: string;
  sendCodeLoading: boolean;
  username: string;
  verificationCode: string;
  onEmailChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSendCode: () => void;
  onSubmit: () => void;
  onUsernameChange: (value: string) => void;
  onVerificationCodeChange: (value: string) => void;
}

export function RegisterForm({
  email,
  emailVerificationEnabled,
  error,
  loading,
  nickname,
  password,
  sendCodeLoading,
  username,
  verificationCode,
  onEmailChange,
  onNicknameChange,
  onPasswordChange,
  onSendCode,
  onSubmit,
  onUsernameChange,
  onVerificationCodeChange,
}: RegisterFormProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Create account</Text>
      <Text style={styles.title}>Register for QuickShare</Text>
      <Text style={styles.description}>Use email verification when the current backend policy requires it.</Text>

      <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={onUsernameChange} placeholder="Username" placeholderTextColor="#94a3b8" style={styles.input} value={username} />
      <TextInput autoCapitalize="words" onChangeText={onNicknameChange} placeholder="Nickname" placeholderTextColor="#94a3b8" style={styles.input} value={nickname} />
      <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={onEmailChange} placeholder="Email" placeholderTextColor="#94a3b8" style={styles.input} value={email} />
      <TextInput onChangeText={onPasswordChange} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry style={styles.input} value={password} />

      {emailVerificationEnabled ? (
        <View style={styles.verificationRow}>
          <TextInput onChangeText={onVerificationCodeChange} placeholder="Verification code" placeholderTextColor="#94a3b8" style={[styles.input, styles.verificationInput]} value={verificationCode} />
          <Pressable onPress={onSendCode} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}>
            {sendCodeLoading ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Send code</Text>}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable onPress={onSubmit} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Register</Text>}
      </Pressable>
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
  verificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  verificationInput: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 108,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});
