import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch, Dimensions, Modal, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES, SHADOWS } from '../../src/theme';
import { Account, AccountData, Expense } from '../../src/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
    const { state, actions, currentMonth, currencySymbol } = useBudgetData();
    const { setUnlocked } = useAuth();
    const router = useRouter(); // Use useRouter from expo-router
    const [newCategory, setNewCategory] = useState('');
    const [incomeInput, setIncomeInput] = useState('');
    const [lastSyncAcctId, setLastSyncAcctId] = useState<number | null>(null);
    const [newAccountName, setNewAccountName] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [newAccountType, setNewAccountType] = useState('Checking');
    const [incomeAccountId, setIncomeAccountId] = useState<number | null>(null);
    const [renamingAccountId, setRenamingAccountId] = useState<number | null>(null);
    const [renamingName, setRenamingName] = useState('');
    const [catAccountId, setCatAccountId] = useState<number | null>(null);
    const [localBudgets, setLocalBudgets] = useState<{[key: string]: string}>({});
    const [budgetsModified, setBudgetsModified] = useState(false);
    const [tipAmount, setTipAmount] = useState(50);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    // Slider Logic
    const sliderWidth = width - 80;
    const minTip = 50;
    const maxTip = 1000;
    const pan = useRef(new Animated.Value((tipAmount - minTip) / (maxTip - minTip) * sliderWidth)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (e, gestureState) => {
                let newValue = gestureState.moveX - 60; // Offset for padding
                if (newValue < 0) newValue = 0;
                if (newValue > sliderWidth) newValue = sliderWidth;
                pan.setValue(newValue);
                const calculatedTip = Math.round((newValue / sliderWidth) * (maxTip - minTip) + minTip);
                setTipAmount(calculatedTip);
            },
            onPanResponderRelease: () => {}
        })
    ).current;

    useFocusEffect(
        React.useCallback(() => {
            actions.loadData();
        }, [actions.loadData])
    );

    const effectiveIncomeAccountId = incomeAccountId || (state?.activeAccountId === 'all' ? state?.accounts[0]?.id : state?.activeAccountId as number);
    const effectiveCatAccountId = catAccountId || (state?.activeAccountId === 'all' ? state?.accounts[0]?.id : state?.activeAccountId as number);

    React.useEffect(() => {
        if (!state) return;
        if (effectiveIncomeAccountId !== lastSyncAcctId) {
            const acct = state.months[currentMonth]?.accounts[String(effectiveIncomeAccountId)];
            if (acct) {
                setIncomeInput(acct.income > 0 ? String(acct.income) : '');
                setLastSyncAcctId(effectiveIncomeAccountId);
            }
        }
    }, [state, currentMonth, effectiveIncomeAccountId, lastSyncAcctId]);

    React.useEffect(() => {
        if (!state || budgetsModified) return;
        const acctId = effectiveCatAccountId;
        const acctBudgets = state.months[currentMonth]?.accounts[String(acctId)]?.categoryBudgets || {};
        const budgets: {[key: string]: string} = {};
        state.accounts.find(a => a.id === acctId)?.categories.forEach(cat => {
            const val = acctBudgets[cat];
            budgets[cat] = (val !== undefined && val !== null) ? String(val) : '';
        });
        setLocalBudgets(budgets);
        setBudgetsModified(false);
    }, [state, currentMonth, effectiveCatAccountId, budgetsModified]);

    if (!state) return null;

    const currencies = ["USD", "EUR", "GBP", "JPY", "INR", "CAD", "AUD"];
    const accountTypes = ["Checking", "Savings", "Credit Card", "Cash"];

    const selectedAccount = state.accounts.find(a => a.id === effectiveCatAccountId);

    const handleAddCategory = () => {
        if (!newCategory.trim()) {
            Alert.alert("Error", "Please enter a category name");
            return;
        }
        if(selectedAccount) {
            actions.addCategory(newCategory.trim(), selectedAccount.id);
            setNewCategory('');
        }
    };

    const handleSetIncome = () => {
        if (!incomeInput) {
            Alert.alert("Error", "Please enter income amount");
            return;
        }
        const amount = parseFloat(incomeInput);
        if (isNaN(amount) || amount < 0) {
            Alert.alert("Error", "Please enter a valid positive income amount");
            return;
        }
        const targetAcctId = incomeAccountId || (state.activeAccountId === 'all' || !state.activeAccountId 
            ? (state.accounts.find(a => !a.archived) || state.accounts[0])?.id 
            : state.activeAccountId as number);
        
        actions.setIncome(amount, targetAcctId);
        Alert.alert("Success", "Income updated");
    };

    const handleAddAccount = () => {
        if(!newAccountName.trim()) {
            Alert.alert("Error", "Please enter an account name");
            return;
        }
        const balance = initialBalance ? parseFloat(initialBalance) : 0;
        if (isNaN(balance)) {
             Alert.alert("Error", "Please enter a valid initial balance");
             return;
        }
        actions.addAccount(newAccountName.trim(), newAccountType, balance);
        setNewAccountName('');
        setInitialBalance('');
        Alert.alert("Success", "Account added");
    };

    const handleRenameAccount = (id: number, currentName: string) => {
        setRenamingAccountId(id);
        setRenamingName(currentName);
    };

    const submitRename = () => {
        if (renamingAccountId !== null) {
            if (!renamingName.trim()) {
                Alert.alert("Error", "Account name cannot be empty");
                return;
            }
            actions.renameAccount(renamingAccountId, renamingName.trim());
            setRenamingAccountId(null);
            setRenamingName('');
        }
    };

    const handleSaveBudgets = async () => {
        if (!selectedAccount) return;
        const finalBudgets: { [category: string]: number } = {};
        let hasError = false;

        Object.entries(localBudgets).forEach(([cat, val]) => {
            const amount = val.trim() === '' ? 0 : parseFloat(val);
            if (isNaN(amount) || amount < 0) {
                hasError = true;
            } else {
                finalBudgets[cat] = amount;
            }
        });

        if (hasError) {
            Alert.alert("Error", "Please enter valid budget amounts");
            return;
        }

        await actions.setCategoryBudgets(finalBudgets, selectedAccount.id);
        setBudgetsModified(false);
        Alert.alert("Success", "Budget goals saved");
    };



    const handleTip = async () => {
        setIsProcessingPayment(true);
        // Simulate Payment Processing
        setTimeout(() => {
            setIsProcessingPayment(false);
            setPaymentSuccess(true);
            setTimeout(() => {
                setPaymentSuccess(false);
                Alert.alert(
                    "Success! ❤️",
                    `Your generous tip of ${currencySymbol}${tipAmount} has been processed. Thank you for supporting Vridhi!`,
                    [{ text: "You're welcome!", onPress: () => {} }]
                );
            }, 1500);
        }, 3000);
    };

    const handleResetMonth = () => {
        Alert.alert(
            "Reset Month",
            `This will delete all income and expenses for ${currentMonth}. Are you sure?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Reset", 
                    style: "destructive",
                    onPress: () => {
                        actions.resetMonth();
                        Alert.alert("Success", "Month data reset");
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                    
                    <TouchableOpacity 
                        onPress={() => router.push('/profile')}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={COLORS.gradientSecondary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.userCard}
                        >
                            <View style={styles.userIconBg}>
                                <Ionicons name="person" size={24} color="#fff" />
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userEmail}>{state?.userProfile?.name || 'Local User'}</Text>
                                <Text style={styles.userName}>{state?.userProfile ? 'Account Settings' : 'Tap to Setup Profile'}</Text>
                            </View>
                            <TouchableOpacity style={styles.signOutBtn} onPress={() => setUnlocked(false)}>
                                <Ionicons name="lock-closed-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Section: Monthly Income */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="wallet-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>Income Settings</Text>
                    </View>
                    <Text style={styles.helperText}>Select account to update monthly income:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountSelector}>
                        {state.accounts.filter(a => !a.archived).map(acct => (
                            <TouchableOpacity 
                                key={acct.id} 
                                style={[styles.accountPill, effectiveIncomeAccountId === acct.id && styles.accountPillActive]}
                                onPress={() => setIncomeAccountId(acct.id)}
                            >
                                <Text style={[styles.accountPillText, effectiveIncomeAccountId === acct.id && styles.accountPillTextActive]}>{acct.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={styles.inputGroup}>
                        <View style={styles.inputWithIcon}>
                            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                            <TextInput 
                                style={styles.input}
                                placeholder="0.00"
                                keyboardType="decimal-pad"
                                value={incomeInput}
                                onChangeText={setIncomeInput}
                            />
                        </View>
                        <TouchableOpacity style={styles.btnSmall} onPress={handleSetIncome}>
                            <Text style={styles.btnText}>Update</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Section: Currency */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="cash-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>Preferences</Text>
                    </View>
                    <Text style={styles.helperText}>Base Currency</Text>
                    <View style={styles.pillsContainer}>
                        {currencies.map(c => (
                            <TouchableOpacity 
                                key={c}
                                style={[styles.pill, state?.currency === c && styles.pillActive]}
                                onPress={() => actions.setCurrency(c)}
                            >
                                <Text style={[styles.pillText, state?.currency === c && styles.pillTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Section: Accounts */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>Accounts</Text>
                    </View>
                    <View style={styles.addAccountBox}>
                        <TextInput 
                            style={styles.inputFull}
                            placeholder="Account Name (e.g. HDFC, Cash)"
                            value={newAccountName}
                            onChangeText={setNewAccountName}
                        />
                        <View style={styles.pillsContainerSmall}>
                            {accountTypes.map(type => (
                                <TouchableOpacity 
                                    key={type}
                                    style={[styles.miniPill, newAccountType === type && styles.miniPillActive]}
                                    onPress={() => setNewAccountType(type)}
                                >
                                    <Text style={[styles.miniPillText, newAccountType === type && styles.miniPillTextActive]}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.btnFull} onPress={handleAddAccount}>
                            <Text style={styles.btnText}>+ Add New Account</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.accountList}>
                        {state.accounts.map(acct => (
                            <View key={acct.id} style={styles.accountItem}>
                                <View style={styles.accountIconBg}>
                                    <Ionicons name={acct.type === 'Credit Card' ? 'card' : 'business'} size={18} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    {renamingAccountId === acct.id ? (
                                        <View style={styles.renameGroup}>
                                            <TextInput 
                                                style={styles.renameInput}
                                                value={renamingName}
                                                onChangeText={setRenamingName}
                                                autoFocus
                                            />
                                            <TouchableOpacity onPress={submitRename}>
                                                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={styles.accountName}>{acct.name}</Text>
                                            <Text style={styles.accountMeta}>{acct.type}{acct.archived ? ' • Archived' : ''}</Text>
                                        </>
                                    )}
                                </View>
                                <View style={styles.actionRow}>
                                    <TouchableOpacity onPress={() => handleRenameAccount(acct.id, acct.name)} style={styles.iconAction}>
                                        <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => actions.archiveAccount(acct.id, !acct.archived)} style={styles.iconAction}>
                                        <Ionicons name={acct.archived ? "refresh-outline" : "archive-outline"} size={18} color={acct.archived ? COLORS.success : COLORS.muted} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Section: Categories */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="apps-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>Categories & Budgets</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountSelector}>
                        {state.accounts.filter(a => !a.archived).map(acct => (
                            <TouchableOpacity 
                                key={acct.id} 
                                style={[styles.accountPill, effectiveCatAccountId === acct.id && styles.accountPillActive]}
                                onPress={() => setCatAccountId(acct.id)}
                            >
                                <Text style={[styles.accountPillText, effectiveCatAccountId === acct.id && styles.accountPillTextActive]}>{acct.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={styles.inputGroup}>
                        <TextInput 
                            style={[styles.input, { flex: 1 }]}
                            placeholder="New category name"
                            value={newCategory}
                            onChangeText={setNewCategory}
                        />
                        <TouchableOpacity style={styles.btnSmall} onPress={handleAddCategory}>
                            <Text style={styles.btnText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.catSummary}>
                        <Text style={styles.catSummaryText}>{selectedAccount?.categories.length || 0} Categories Defined</Text>
                    </View>
                    <View style={styles.catGrid}>
                        {selectedAccount?.categories.map(c => (
                            <View key={c} style={styles.catRow}>
                                <Text style={styles.catRowText}>{c}</Text>
                                <View style={styles.budgetEditRow}>
                                    <Text style={styles.miniCurrency}>{currencySymbol}</Text>
                                    <TextInput 
                                        style={styles.budgetInputSmall}
                                        placeholder="0"
                                        keyboardType="decimal-pad"
                                        value={localBudgets[c] || ''}
                                        onChangeText={(text) => {
                                            setLocalBudgets(prev => ({ ...prev, [c]: text.replace(/[^0-9.]/g, '') }));
                                            setBudgetsModified(true);
                                        }}
                                    />
                                    <TouchableOpacity onPress={() => actions.deleteCategory(c, selectedAccount.id)} style={styles.catDeleteBtn}>
                                        <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                    {budgetsModified && (
                        <TouchableOpacity style={styles.saveBudgetBtn} onPress={handleSaveBudgets}>
                            <LinearGradient colors={COLORS.gradientSuccess} style={styles.gradientBtn}>
                                <Text style={styles.btnText}>Save Budget Goals</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Section: Data */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="cloud-download-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
                        <Text style={styles.sectionTitle}>Data Management</Text>
                    </View>
                    <TouchableOpacity style={[styles.dataActionBtn, { backgroundColor: COLORS.danger, marginTop: 10 }]} onPress={handleResetMonth}>
                        <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.dataActionText}>Reset Current Month</Text>
                    </TouchableOpacity>
                </View>

                {/* Section: Tip Jar */}
                <View style={[styles.section, styles.tipJarSection]}>
                    <LinearGradient
                        colors={['#4f46e5', '#818cf8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.tipJarGradient}
                    >
                        <View style={styles.tipJarHeader}>
                            <Ionicons name="heart" size={24} color="#fff" />
                            <Text style={styles.tipJarTitle}>Support Vridhi</Text>
                        </View>
                        <Text style={styles.tipJarDesc}>Move the slider to choose your tip amount. Your support helps us keep the app free!</Text>
                        
                        <View style={styles.tipAmountContainer}>
                            <Text style={styles.tipAmountLabel}>Amount</Text>
                            <Text style={styles.tipAmountValue}>{currencySymbol}{tipAmount}</Text>
                        </View>

                        <View style={styles.sliderContainer}>
                            <View style={styles.sliderTrack} />
                            <Animated.View 
                                style={[styles.sliderTrackActive, { width: pan }]} 
                            />
                            <Animated.View 
                                {...panResponder.panHandlers}
                                style={[styles.sliderThumb, { transform: [{ translateX: pan }] }]} 
                            />
                        </View>
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabelText}>{currencySymbol}50</Text>
                            <Text style={styles.sliderLabelText}>{currencySymbol}1000</Text>
                        </View>

                        <TouchableOpacity 
                            style={styles.payBtn}
                            onPress={handleTip}
                            disabled={isProcessingPayment}
                        >
                            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.payBtnText}>Complete Secure Payment</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                {/* Simulated Payment Modal */}
                <Modal visible={isProcessingPayment || paymentSuccess} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.paymentModal}>
                            {paymentSuccess ? (
                                <View style={styles.successContainer}>
                                    <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
                                    <Text style={styles.successTitle}>Payment Successful!</Text>
                                    <Text style={styles.successSub}>Thank you for your support</Text>
                                </View>
                            ) : (
                                <View style={styles.processingContainer}>
                                    <ActivityIndicator size="large" color={COLORS.primary} />
                                    <Text style={styles.processingTitle}>Processing Payment...</Text>
                                    <Text style={styles.processingSub}>Securing your transaction</Text>
                                    <View style={styles.stripeInfo}>
                                        <Ionicons name="lock-closed" size={14} color={COLORS.muted} />
                                        <Text style={styles.stripeText}>Simulated Secure Checkout</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        paddingHorizontal: SIZES.padding,
        paddingTop: 10,
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5,
        marginBottom: 20,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: SIZES.radiusLarge,
        ...SHADOWS.medium,
    },
    userIconBg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    userInfo: {
        flex: 1,
    },
    userEmail: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    userName: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '500',
    },
    signOutBtn: {
        padding: 10,
    },
    section: {
        backgroundColor: COLORS.surface,
        marginHorizontal: SIZES.padding,
        borderRadius: SIZES.radiusLarge,
        padding: 20,
        marginBottom: 20,
        ...SHADOWS.small,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionIcon: {
        marginRight: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    helperText: {
        fontSize: 13,
        color: COLORS.textLight,
        marginBottom: 10,
    },
    accountSelector: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    accountPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: SIZES.radiusFull,
        backgroundColor: COLORS.bg,
        marginRight: 10,
    },
    accountPillActive: {
        backgroundColor: COLORS.primary,
    },
    accountPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textLight,
    },
    accountPillTextActive: {
        color: '#fff',
    },
    inputGroup: {
        flexDirection: 'row',
        gap: 10,
    },
    inputWithIcon: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    currencyPrefix: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: COLORS.text,
    },
    btnSmall: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        ...SHADOWS.small,
    },
    btnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    pillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: COLORS.bg,
    },
    pillActive: {
        backgroundColor: COLORS.primary,
    },
    pillText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '600',
    },
    pillTextActive: {
        color: '#fff',
    },
    separator: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 16,
    },
    securityRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    settingDesc: {
        fontSize: 12,
        color: COLORS.muted,
    },
    addAccountBox: {
        gap: 12,
        marginBottom: 20,
    },
    inputFull: {
        backgroundColor: COLORS.bg,
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: COLORS.text,
    },
    pillsContainerSmall: {
        flexDirection: 'row',
        gap: 8,
    },
    miniPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: COLORS.bg,
    },
    miniPillActive: {
        backgroundColor: COLORS.primaryLight,
    },
    miniPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textLight,
    },
    miniPillTextActive: {
        color: COLORS.primary,
    },
    btnFull: {
        backgroundColor: COLORS.primary,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        ...SHADOWS.small,
    },
    accountList: {
        gap: 10,
    },
    accountItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: COLORS.bg,
        borderRadius: 14,
    },
    accountIconBg: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    accountName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    accountMeta: {
        fontSize: 11,
        color: COLORS.textLight,
    },
    renameGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    renameInput: {
        flex: 1,
        backgroundColor: COLORS.surface,
        padding: 6,
        borderRadius: 8,
        color: COLORS.text,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    iconAction: {
        padding: 6,
    },
    catSummary: {
        marginVertical: 12,
    },
    catSummaryText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
        textTransform: 'uppercase',
    },
    catGrid: {
        gap: 10,
    },
    catRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: COLORS.bg,
        borderRadius: 12,
    },
    catRowText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    budgetEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    miniCurrency: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textLight,
    },
    budgetInputSmall: {
        width: 60,
        padding: 4,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'right',
    },
    catDeleteBtn: {
        marginLeft: 4,
    },
    saveBudgetBtn: {
        marginTop: 20,
        borderRadius: 12,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    gradientBtn: {
        padding: 14,
        alignItems: 'center',
    },
    dataActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 14,
        marginBottom: 12,
        ...SHADOWS.small,
    },
    dataActionText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    tipJarSection: {
        padding: 0,
        overflow: 'hidden',
        borderWidth: 0,
    },
    tipJarGradient: {
        padding: 20,
    },
    tipJarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    tipJarTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
    tipJarDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 20,
        lineHeight: 18,
    },
    tipAmountContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    tipAmountLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
    },
    tipAmountValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '800',
    },
    sliderContainer: {
        height: 30,
        justifyContent: 'center',
        marginBottom: 10,
    },
    sliderTrack: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
    },
    sliderTrackActive: {
        height: 6,
        backgroundColor: '#fff',
        borderRadius: 3,
        position: 'absolute',
    },
    sliderThumb: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        position: 'absolute',
        left: -12,
        ...SHADOWS.medium,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    sliderLabelText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '700',
    },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 12,
        ...SHADOWS.small,
    },
    payBtnText: {
        color: COLORS.primary,
        fontWeight: '800',
        fontSize: 15,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    paymentModal: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        ...SHADOWS.large,
    },
    processingContainer: {
        alignItems: 'center',
    },
    processingTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.text,
        marginTop: 20,
        marginBottom: 8,
    },
    processingSub: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: 24,
    },
    stripeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.bg,
        borderRadius: 8,
    },
    stripeText: {
        fontSize: 12,
        color: COLORS.muted,
        fontWeight: '600',
    },
    successContainer: {
        alignItems: 'center',
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.success,
        marginTop: 20,
        marginBottom: 4,
    },
    successSub: {
        fontSize: 15,
        color: COLORS.textLight,
    },
});
