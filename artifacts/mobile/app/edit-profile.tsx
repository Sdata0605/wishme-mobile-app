import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseFetch, parseApiError } from '@/constants/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.LONG);
  } else {
    Alert.alert('', msg);
  }
}

function maskAadhaar(num: string): string {
  if (!num || num.length < 4) return num;
  return 'XXXX XXXX ' + num.slice(-4);
}

function maskPan(num: string): string {
  if (!num || num.length < 4) return num;
  return num.slice(0, 2) + 'XXX' + num.slice(5, 7) + 'XX' + num.slice(-1);
}

function maskAccountNumber(num: string): string {
  if (!num || num.length < 4) return num;
  return 'XXXX XXXX ' + num.slice(-4);
}

function computeCompletion(fields: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_ifsc?: string;
  bank_account_holder_name?: string;
  aadhaar_number?: string;
  pan_number?: string;
  aadhaar_verified?: boolean;
  pan_verified?: boolean;
}): number {
  const ten = [
    fields.first_name,
    fields.last_name,
    fields.phone,
    fields.address,
    fields.bank_account_number,
    fields.bank_name,
    fields.bank_ifsc,
    fields.bank_account_holder_name,
    fields.aadhaar_number,
    fields.pan_number,
  ];
  const filled = ten.filter((f) => f?.trim()).length;
  const base = Math.round((filled / 10) * 80) + 20;
  const bonus = (fields.aadhaar_verified ? 10 : 0) + (fields.pan_verified ? 10 : 0);
  return Math.min(base + bonus, 100);
}

interface ProfileRow {
  id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  avatar_url?: string;
  referral_code?: string;
  aadhaar_number?: string;
  pan_number?: string;
  aadhaar_verified?: boolean;
  pan_verified?: boolean;
  pan_document_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_account_holder_name?: string;
  profile_completion_percentage?: number;
}

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow>({});

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panDocUploading, setPanDocUploading] = useState(false);
  const [panDocUrl, setPanDocUrl] = useState<string | null>(null);

  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankEditing, setBankEditing] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [referralCopied, setReferralCopied] = useState(false);

  const sessionRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await supabaseFetch(`/rest/v1/profiles?user_id=eq.${user.id}&select=*`, {}, null);
      if (res.ok) {
        const rows = (await res.json()) as ProfileRow[];
        if (rows && rows.length > 0) {
          const p = rows[0];
          setProfile(p);
          setFirstName(p.first_name ?? user.firstName ?? '');
          setLastName(p.last_name ?? user.lastName ?? '');
          setPhone(p.phone ?? user.phone ?? '');
          setAddress(p.address ?? '');
          setAvatarUrl(p.avatar_url ?? null);
          setAadhaarNumber(p.aadhaar_number ?? '');
          setPanNumber(p.pan_number ?? '');
          setPanDocUrl(p.pan_document_url ?? null);
          setBankName(p.bank_name ?? '');
          setBankAccount(p.bank_account_number ?? '');
          setBankIfsc(p.bank_ifsc ?? '');
          setBankHolder(p.bank_account_holder_name ?? '');
        }
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
    const loadSession = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const raw = await AsyncStorage.getItem('@wishme/session');
        if (raw) {
          const s = JSON.parse(raw) as { access_token?: string };
          sessionRef.current = s.access_token ?? null;
        }
      } catch {}
    };
    loadSession();
  }, [fetchProfile]);

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access photos is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const fileSize = asset.fileSize ?? 0;
    if (fileSize > 5 * 1024 * 1024) {
      showToast('Image must be less than 5 MB.');
      return;
    }

    if (!user?.id || !sessionRef.current) {
      showToast('Session expired. Please log in again.');
      return;
    }

    setAvatarUploading(true);
    try {
      const uri = asset.uri;
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/profile_${Date.now()}.${ext}`;
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/profile-photos/${path}`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${sessionRef.current}`,
            'Content-Type': mimeType,
          },
          body: blob,
        },
      );

      if (!uploadRes.ok) {
        const msg = await parseApiError(uploadRes);
        showToast(`Upload failed: ${msg}`);
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/profile-photos/${path}`;
      setAvatarUrl(publicUrl);
      showToast('Avatar updated!');
    } catch (e) {
      showToast('Upload failed. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }, [user]);

  const handlePickPanDoc = useCallback(async () => {
    if (!user?.id || !sessionRef.current) {
      showToast('Session expired. Please log in again.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const ext = (asset.name ?? '').split('.').pop()?.toLowerCase() ?? 'pdf';
      const path = `${user.id}/pan_${Date.now()}.${ext}`;
      const mimeType = asset.mimeType ?? 'application/pdf';

      setPanDocUploading(true);

      const response = await fetch(uri);
      const blob = await response.blob();

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/verification-docs/${path}`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${sessionRef.current}`,
            'Content-Type': mimeType,
          },
          body: blob,
        },
      );

      if (!uploadRes.ok) {
        const msg = await parseApiError(uploadRes);
        showToast(`Upload failed: ${msg}`);
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/verification-docs/${path}`;
      setPanDocUrl(publicUrl);

      await supabaseFetch(
        `/rest/v1/profiles?user_id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ pan_document_url: publicUrl }),
        },
        sessionRef.current,
      );
      showToast('PAN document uploaded!');
    } catch {
      showToast('Upload failed. Please try again.');
    } finally {
      setPanDocUploading(false);
    }
  }, [user]);

  const handleCopyReferral = useCallback(async () => {
    const code = profile.referral_code ?? user?.referralCode ?? '';
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  }, [profile.referral_code, user?.referralCode]);

  const handleShareReferral = useCallback(async () => {
    const code = profile.referral_code ?? user?.referralCode ?? '';
    try {
      await Share.share({
        message: `Join WishMe with my referral code ${code} and get exclusive rewards! Download now.`,
      });
    } catch {}
  }, [profile.referral_code, user?.referralCode]);

  const handleSave = useCallback(async () => {
    if (!firstName.trim()) {
      showToast('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      showToast('Last name is required.');
      return;
    }
    if (phone.trim()) {
      const cleaned = phone.replace(/[\s\-]/g, '');
      if (!/^(\+91|91)?[6-9]\d{9}$/.test(cleaned)) {
        showToast('Enter a valid Indian mobile number.');
        return;
      }
    }

    if (!user?.id || !sessionRef.current) {
      showToast('Session expired. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      const pct = computeCompletion({
        first_name: firstName,
        last_name: lastName,
        phone,
        address,
        bank_account_number: bankAccount,
        bank_name: bankName,
        bank_ifsc: bankIfsc,
        bank_account_holder_name: bankHolder,
        aadhaar_number: aadhaarNumber,
        pan_number: panNumber,
        aadhaar_verified: profile.aadhaar_verified,
        pan_verified: profile.pan_verified,
      });

      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        avatar_url: avatarUrl,
        address: address.trim(),
        bank_account_number: bankAccount.trim(),
        bank_name: bankName.trim(),
        bank_ifsc: bankIfsc.trim(),
        bank_account_holder_name: bankHolder.trim(),
        aadhaar_number: aadhaarNumber.trim(),
        pan_number: panNumber.trim(),
        profile_completion_percentage: pct,
      };

      const res = await supabaseFetch(
        `/rest/v1/profiles?user_id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(payload),
        },
        sessionRef.current,
      );

      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(`Save failed: ${msg}`);
        return;
      }

      updateUser({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() });
      showToast('Profile saved!');
      router.back();
    } catch {
      showToast('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [firstName, lastName, phone, address, avatarUrl, bankAccount, bankName, bankIfsc, bankHolder, aadhaarNumber, panNumber, profile, user, updateUser]);

  const handleChangePassword = useCallback(async () => {
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }
    if (!sessionRef.current) {
      showToast('Session expired. Please log in again.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${sessionRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res);
        showToast(`Error: ${msg}`);
        return;
      }
      showToast('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
    } catch {
      showToast('Failed to update password. Please try again.');
    } finally {
      setPasswordSaving(false);
    }
  }, [newPassword, confirmPassword]);

  const initials = `${(firstName || user?.firstName || 'W')[0]}${(lastName || user?.lastName || 'M')[0]}`.toUpperCase();
  const referralCode = profile.referral_code ?? user?.referralCode ?? '';
  const completionPct = computeCompletion({
    first_name: firstName,
    last_name: lastName,
    phone,
    address,
    bank_account_number: bankAccount,
    bank_name: bankName,
    bank_ifsc: bankIfsc,
    bank_account_holder_name: bankHolder,
    aadhaar_number: aadhaarNumber,
    pan_number: panNumber,
    aadhaar_verified: profile.aadhaar_verified,
    pan_verified: profile.pan_verified,
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} disabled={avatarUploading}>
            <LinearGradient
              colors={['#FF6B33', '#B44CFF']}
              style={styles.avatarBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
            </LinearGradient>
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="camera" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.displayName, { color: colors.foreground }]}>
            {firstName || user?.firstName} {lastName || user?.lastName}
          </Text>
          <Text style={[styles.completionBadge, { color: colors.mutedForeground }]}>{completionPct}% Complete</Text>
        </View>

        {/* Completion Bar */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile Completion</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <LinearGradient
              colors={['#FF6B33', '#B44CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${completionPct}%` }]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>{completionPct}% of your profile is complete</Text>
        </View>

        {/* Identity Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Identity Details</Text>
          <LabelInput label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="First name" colors={colors} />
          <LabelInput label="Last Name *" value={lastName} onChangeText={setLastName} placeholder="Last name" colors={colors} />
          <View style={styles.readOnlyRow}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.readOnlyValue, { color: colors.foreground, backgroundColor: colors.muted }]}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <LabelInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            colors={colors}
          />
          <LabelInput label="Address" value={address} onChangeText={setAddress} placeholder="Your address" colors={colors} />
        </View>

        {/* Referral Hub */}
        {!!referralCode && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Referral Hub</Text>
            <View style={[styles.referralBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.referralCode, { color: colors.foreground }]}>{referralCode}</Text>
            </View>
            <View style={styles.referralBtns}>
              <TouchableOpacity
                style={[styles.referralBtn, { backgroundColor: colors.primary }]}
                onPress={handleCopyReferral}
              >
                <Icon name={referralCopied ? 'check' : 'copy'} size={15} color="#fff" />
                <Text style={styles.referralBtnText}>{referralCopied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.referralBtn, { backgroundColor: '#B44CFF' }]}
                onPress={handleShareReferral}
              >
                <Icon name="share-2" size={15} color="#fff" />
                <Text style={styles.referralBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Verification Status */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Verification Status</Text>

          {/* Aadhaar */}
          <View style={[styles.verifyRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyLabel, { color: colors.foreground }]}>Aadhaar</Text>
              {profile.aadhaar_number ? (
                <Text style={[styles.verifyMasked, { color: colors.mutedForeground }]}>{maskAadhaar(profile.aadhaar_number)}</Text>
              ) : (
                <Text style={[styles.verifyMasked, { color: colors.mutedForeground }]}>Not provided</Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: profile.aadhaar_verified ? '#22C55E20' : '#F59E0B20' }]}>
              <Text style={[styles.badgeText, { color: profile.aadhaar_verified ? '#22C55E' : '#F59E0B' }]}>
                {profile.aadhaar_verified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          {!profile.aadhaar_verified && (
            <LabelInput
              label="Aadhaar Number"
              value={aadhaarNumber}
              onChangeText={(t) => setAadhaarNumber(t.replace(/\D/g, '').slice(0, 12))}
              placeholder="12-digit Aadhaar number"
              keyboardType="numeric"
              colors={colors}
            />
          )}

          {/* PAN */}
          <View style={[styles.verifyRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.verifyLabel, { color: colors.foreground }]}>PAN</Text>
              {profile.pan_number ? (
                <Text style={[styles.verifyMasked, { color: colors.mutedForeground }]}>{maskPan(profile.pan_number)}</Text>
              ) : (
                <Text style={[styles.verifyMasked, { color: colors.mutedForeground }]}>Not provided</Text>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: profile.pan_verified ? '#22C55E20' : '#F59E0B20' }]}>
              <Text style={[styles.badgeText, { color: profile.pan_verified ? '#22C55E' : '#F59E0B' }]}>
                {profile.pan_verified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          {!profile.pan_verified && (
            <>
              <LabelInput
                label="PAN Number"
                value={panNumber}
                onChangeText={(t) => setPanNumber(t.toUpperCase().slice(0, 10))}
                placeholder="AAAAA9999A"
                autoCapitalize="characters"
                colors={colors}
              />
              <TouchableOpacity
                style={[styles.uploadDocBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={handlePickPanDoc}
                disabled={panDocUploading}
              >
                {panDocUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="upload" size={16} color={colors.primary} />
                )}
                <Text style={[styles.uploadDocText, { color: colors.primary }]}>
                  {panDocUrl ? 'PAN Document Uploaded ✓' : 'Upload PAN Document'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bank Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Bank Details</Text>
            <TouchableOpacity onPress={() => setBankEditing((v) => !v)}>
              <Text style={[styles.editBankText, { color: colors.primary }]}>{bankEditing ? 'Done' : 'Update'}</Text>
            </TouchableOpacity>
          </View>

          {!bankEditing ? (
            <View style={styles.bankDisplayGrid}>
              <BankRow label="Bank Name" value={bankName || '—'} colors={colors} />
              <BankRow label="Account Number" value={bankAccount ? maskAccountNumber(bankAccount) : '—'} colors={colors} />
              <BankRow label="IFSC Code" value={bankIfsc || '—'} colors={colors} />
              <BankRow label="Account Holder" value={bankHolder || '—'} colors={colors} />
            </View>
          ) : (
            <>
              <LabelInput label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" colors={colors} />
              <LabelInput label="Account Number" value={bankAccount} onChangeText={setBankAccount} placeholder="Account number" keyboardType="numeric" colors={colors} />
              <LabelInput label="IFSC Code" value={bankIfsc} onChangeText={(t) => setBankIfsc(t.toUpperCase())} placeholder="e.g. SBIN0001234" autoCapitalize="characters" colors={colors} />
              <LabelInput label="Account Holder Name" value={bankHolder} onChangeText={setBankHolder} placeholder="As per bank records" colors={colors} />
            </>
          )}
        </View>

        {/* Change Password */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.sectionTitleRow} onPress={() => setPasswordOpen((v) => !v)}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account Security</Text>
            <Icon name={passwordOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {passwordOpen && (
            <>
              <LabelInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 6 characters"
                secureTextEntry
                colors={colors}
              />
              <LabelInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                secureTextEntry
                colors={colors}
              />
              <TouchableOpacity
                style={[styles.updatePwBtn, { opacity: passwordSaving ? 0.7 : 1 }]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.updatePwGrad}>
                  {passwordSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.updatePwText}>Update Password</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtnGrad}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabelInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  colors: Record<string, string>;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'words'}
      />
    </View>
  );
}

function BankRow({ label, value, colors }: { label: string; value: string; colors: Record<string, string> }) {
  return (
    <View style={styles.bankRow}>
      <Text style={[styles.bankLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.bankValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatarBorder: { width: 100, height: 100, borderRadius: 50, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 94, height: 94, borderRadius: 47 },
  avatarInitials: { fontSize: 34, fontFamily: 'Inter_700Bold', color: '#FF6B33' },
  cameraOverlay: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  displayName: { fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 4 },
  completionBadge: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  readOnlyRow: { gap: 4 },
  readOnlyValue: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter_400Regular' },
  referralBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  referralCode: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  referralBtns: { flexDirection: 'row', gap: 12 },
  referralBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  referralBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  verifyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  verifyLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  verifyMasked: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  uploadDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  uploadDocText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bankDisplayGrid: { gap: 4 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  bankLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  bankValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  editBankText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  updatePwBtn: { marginTop: 4 },
  updatePwGrad: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  updatePwText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { marginTop: 4 },
  saveBtnGrad: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
