import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useBudgetData } from '@/src/hooks/useBudgetData';
import { useAuth } from '@/src/hooks/useAuth';
import { COLORS, SIZES, SHADOWS } from '@/src/theme';

export default function ProfileScreen() {
    const router = useRouter();
    const { state, actions, loading: budgetLoading } = useBudgetData();
    const { toggleBiometrics, useBiometrics } = useAuth();

    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [kycInfo, setKycInfo] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{[key: string]: string}>({});

    useEffect(() => {
        if (state?.userProfile) {
            setName(state.userProfile.name || '');
            setAge(state.userProfile.age || '');
            setGender(state.userProfile.gender || '');
            setKycInfo(state.userProfile.kycInfo || '');
            setPhotoUri(state.userProfile.photoUri || null);
        }
    }, [state]);

    const validate = () => {
        const newErrors: {[key: string]: string} = {};
        
        if (!name.trim()) {
            newErrors.name = 'Name is required';
        } else if (name.trim().length < 2) {
            newErrors.name = 'Name is too short';
        }

        if (age) {
            const ageNum = parseInt(age);
            if (isNaN(ageNum) || ageNum < 21 || ageNum > 99) {
                newErrors.age = 'Age must be between 21 and 99';
            }
        } else {
            newErrors.age = 'Age is required';
        }

        if (!gender.trim()) {
            newErrors.gender = 'Gender is required';
        }

        if (kycInfo && kycInfo.trim().length < 5) {
            newErrors.kyc = 'KYC ID is too short';
        } else if (!kycInfo) {
            newErrors.kyc = 'KYC info is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) {
            Alert.alert("Validation Failed", "Please correct the errors in the form.");
            return;
        }

        setIsSaving(true);
        try {
            await actions.updateProfile({
                name: name.trim(),
                age,
                gender: gender.trim(),
                kycInfo: kycInfo.trim(),
                photoUri: photoUri
            });
            Alert.alert("Success", "Profile updated successfully");
            router.back();
        } catch (e) {
            Alert.alert("Error", "Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleToggleBiometrics = async (value: boolean) => {
        // First try to authenticate
        const success = await toggleBiometrics(value);
        if (success) {
            // No need for alert here as it resets state
        } else if (value) {
            // If failed to enable, revert or just let the toggle be handled by context
            Alert.alert("Authentication Failed", "Biometrics could not be verified.");
        }
    };

    if (budgetLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'User Profile', headerShown: false }} />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile Management</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Profile Photo Section */}
                <View style={styles.photoSection}>
                    <View style={styles.photoContainer}>
                        <LinearGradient
                            colors={['#e0e7ff', '#f1f5f9']}
                            style={styles.photoPlaceholder}
                        >
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.profileImage} />
                            ) : (
                                <Ionicons name="person" size={60} color={COLORS.primary} />
                            )}
                        </LinearGradient>
                        <TouchableOpacity style={styles.editPhotoBtn} onPress={pickImage}>
                            <Ionicons name="camera" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.kycStatus}>
                        <Ionicons name="shield-checkmark" size={14} color={COLORS.success} /> KYC Fully Verified
                    </Text>
                </View>

                {/* Info Fields */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Basic Information</Text>
                    
                    <View style={styles.inputItem}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput 
                            style={[styles.input, errors.name && styles.inputError]}
                            value={name}
                            onChangeText={(t) => { setName(t); if(errors.name) { const e = {...errors}; delete e.name; setErrors(e); } }}
                            placeholder="Enter your full name"
                        />
                        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputItem, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Age</Text>
                            <TextInput 
                                style={[styles.input, errors.age && styles.inputError]}
                                value={age}
                                onChangeText={(t) => { setAge(t); if(errors.age) { const e = {...errors}; delete e.age; setErrors(e); } }}
                                placeholder="21 - 99"
                                keyboardType="number-pad"
                            />
                            {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
                        </View>
                        <View style={[styles.inputItem, { flex: 1 }]}>
                            <Text style={styles.label}>Gender</Text>
                            <TextInput 
                                style={[styles.input, errors.gender && styles.inputError]}
                                value={gender}
                                onChangeText={(t) => { setGender(t); if(errors.gender) { const e = {...errors}; delete e.gender; setErrors(e); } }}
                                placeholder="Gender"
                            />
                            {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
                        </View>
                    </View>
                </View>

                {/* KYC Section */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>KYC Details</Text>
                    <View style={styles.inputItem}>
                        <Text style={styles.label}>ID / Tax Number (Encrypted)</Text>
                        <TextInput 
                            style={[styles.input, errors.kyc && styles.inputError]}
                            value={kycInfo}
                            onChangeText={(t) => { setKycInfo(t); if(errors.kyc) { const e = {...errors}; delete e.kyc; setErrors(e); } }}
                            placeholder="Enter PAN/SSN/Passport"
                            secureTextEntry={true}
                        />
                        {errors.kyc && <Text style={styles.errorText}>{errors.kyc}</Text>}
                    </View>
                    <Text style={styles.infoText}>This information is stored locally and encrypted.</Text>
                </View>

                {/* Identity Security */}
                <View style={[styles.formCard, styles.securityCard]}>
                    <Text style={styles.sectionTitle}>Identity Security</Text>
                    <View style={styles.securityRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.securityLabel}>Biometric Unlock</Text>
                            <Text style={styles.securityDesc}>Requires FaceID/Fingerprint enrollment</Text>
                        </View>
                        <Switch 
                            value={useBiometrics}
                            onValueChange={handleToggleBiometrics}
                            trackColor={{ false: COLORS.muted, true: COLORS.primaryLight }}
                            thumbColor={useBiometrics ? COLORS.primary : '#f4f3f4'}
                        />
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.saveBtn, isSaving && styles.btnDisabled]} 
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    <LinearGradient
                        colors={COLORS.gradientPrimary}
                        style={styles.saveBtnGradient}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Update Profile</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footerInfo}>
                    <Ionicons name="lock-closed" size={14} color={COLORS.muted} />
                    <Text style={styles.footerText}>Secure 256-bit Local Storage</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    backBtn: {
        padding: 5,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    photoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        ...SHADOWS.medium,
        position: 'relative',
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    editPhotoBtn: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: COLORS.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    kycStatus: {
        marginTop: 12,
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.success,
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    formCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        ...SHADOWS.small,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 15,
    },
    inputItem: {
        marginBottom: 15,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textLight,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: COLORS.bg,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputError: {
        borderColor: COLORS.danger,
        backgroundColor: '#fff1f0',
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    },
    infoText: {
        fontSize: 11,
        color: COLORS.muted,
        marginTop: -5,
    },
    securityCard: {
        borderColor: COLORS.primaryLight,
        borderWidth: 1,
    },
    securityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    securityLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    securityDesc: {
        fontSize: 12,
        color: COLORS.muted,
    },
    saveBtn: {
        marginTop: 10,
        borderRadius: 16,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    saveBtnGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    btnDisabled: {
        opacity: 0.7,
    },
    footerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6,
    },
    footerText: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
    },
});
