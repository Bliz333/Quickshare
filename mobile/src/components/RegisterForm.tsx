import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Theme } from '../theme';

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
      <View style={styles.accentBar} />
      <View style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>Q</Text>
        </View>
      </View>
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
  verificationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.space5,
  },
  verificationInput: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  primaryButtonText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeLg,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusLg,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
    minWidth: 108,
    paddingHorizontal: Theme.space6,
  },
  secondaryButtonText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});
