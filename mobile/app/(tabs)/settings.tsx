import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch } from 'react-native';
import { useAuth } from '@/src/hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES } from '../../src/theme';
import { Account, AccountData, Expense } from '../../src/types';
import * as XLSX from 'xlsx';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function SettingsScreen() {
    const { state, actions, currentMonth, currencySymbol } = useBudgetData();
    const { toggleBiometrics, useBiometrics } = useAuth();
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

    // Reload data when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            actions.loadData();
        }, [actions.loadData])
    );

    const effectiveIncomeAccountId = incomeAccountId || (state?.activeAccountId === 'all' ? state?.accounts[0]?.id : state?.activeAccountId as number);
    const effectiveCatAccountId = catAccountId || (state?.activeAccountId === 'all' ? state?.accounts[0]?.id : state?.activeAccountId as number);

    // Sync income input when account or state changes
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

    // Sync category budgets when account changes
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
    const monthData = state.months[currentMonth] || { accounts: {} };

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
        // Do not clear incomeInput, keep it reflecting current value
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

    const handleExportExcel = async () => {
        if (!state) return;

        try {
            const allExpensesList: any[] = [];
            
            // Flatten all expenses from all months and accounts
            Object.keys(state.months).forEach(monthKey => {
                const monthInfo = state.months[monthKey];
                Object.keys(monthInfo.accounts).forEach(acctId => {
                    const acctData = monthInfo.accounts[acctId];
                    const accountName = state.accounts.find(a => String(a.id) === acctId)?.name || 'Unknown';
                    
                    acctData.expenses.forEach(exp => {
                        allExpensesList.push({
                            'Date': exp.date,
                            'Account': accountName,
                            'Description': exp.title,
                            'Amount': exp.amount,
                            'Category': exp.category?.[0] || 'Uncategorized'
                        });
                    });
                });
            });

            if (allExpensesList.length === 0) {
                Alert.alert("No Data", "There are no expenses to export.");
                return;
            }

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(allExpensesList);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Expenses");

            // Generate base64
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            
            const file = new File(Paths.cache, 'budget_export.xlsx');
            file.write(wbout, {
                encoding: 'base64'
            });

            await Sharing.shareAsync(file.uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Export Budget Data',
                UTI: 'com.microsoft.excel.xlsx'
            });
        } catch (e) {
            console.error("Export failed", e);
            Alert.alert("Error", "Failed to export data");
        }
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
            <ScrollView>
                <Text style={styles.headerTitle}>Settings</Text>

                {/* Income */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Monthly Income</Text>
                    <Text style={styles.helperText}>Select account to set income for:</Text>
                    <View style={styles.accountSelector}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {state.accounts.filter(a => !a.archived).map(acct => {
                                const isSelected = effectiveIncomeAccountId === acct.id;
                                return (
                                    <TouchableOpacity 
                                        key={acct.id} 
                                        style={[styles.accountPill, isSelected && styles.accountPillActive]}
                                        onPress={() => setIncomeAccountId(acct.id)}
                                    >
                                        <Text style={[styles.accountPillText, isSelected && styles.accountPillTextActive]}>{acct.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.row}>
                        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8}}>
                            <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                            <TextInput 
                                style={[styles.input, {flex: 1}]}
                                placeholder="Enter Monthly Income"
                                keyboardType="decimal-pad"
                                value={incomeInput}
                                onChangeText={(text) => {
                                    // Real-time numeric validation (allow only numbers and one decimal point)
                                    const sanitized = text.replace(/[^0-9.]/g, '');
                                    if (sanitized.split('.').length > 2) return;
                                    setIncomeInput(sanitized);
                                }}
                            />
                        </View>
                        <TouchableOpacity style={styles.btnSmall} onPress={handleSetIncome}>
                            <Text style={styles.btnText}>Set</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Currency */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Currency</Text>
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

                {/* Accounts */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Manage Accounts</Text>
                    <View style={styles.formGroupVertical}>
                        <TextInput 
                            style={styles.inputFull}
                            placeholder="Account Name"
                            value={newAccountName}
                            onChangeText={setNewAccountName}
                        />
                        <View style={styles.row}>
                            <View style={{flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8}}>
                                <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                                <TextInput 
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="Initial Balance (Optional)"
                                    keyboardType="decimal-pad"
                                    value={initialBalance}
                                    onChangeText={(text) => {
                                        const sanitized = text.replace(/[^0-9.]/g, '');
                                        if (sanitized.split('.').length > 2) return;
                                        setInitialBalance(sanitized);
                                    }}
                                />
                            </View>
                            <TouchableOpacity style={styles.btnSmall} onPress={handleAddAccount}>
                                <Text style={styles.btnText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.pillsContainer}>
                        {accountTypes.map(type => (
                            <TouchableOpacity 
                                key={type}
                                style={[styles.pill, newAccountType === type && styles.pillActive]}
                                onPress={() => setNewAccountType(type)}
                            >
                                <Text style={[styles.pillText, newAccountType === type && styles.pillTextActive]}>{type}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.accountList}>
                        {state.accounts.map(acct => (
                            <View key={acct.id} style={styles.accountItem}>
                                <View style={{ flex: 1 }}>
                                    {renamingAccountId === acct.id ? (
                                        <View style={styles.renameContainer}>
                                            <TextInput 
                                                style={styles.renameInput}
                                                value={renamingName}
                                                onChangeText={setRenamingName}
                                                autoFocus
                                            />
                                            <View style={{flexDirection: 'row', gap: 10}}>
                                                <TouchableOpacity onPress={submitRename}>
                                                    <Text style={styles.saveRenameText}>Save</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => setRenamingAccountId(null)}>
                                                    <Text style={styles.cancelRenameText}>Cancel</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={styles.accountName}>{acct.name}</Text>
                                            <Text style={styles.accountMeta}>{acct.type}{acct.archived ? ' • Archived' : ''}</Text>
                                        </>
                                    )}
                                </View>
                                {renamingAccountId !== acct.id && (
                                    <View style={{flexDirection: 'row', gap: 12}}>
                                        <TouchableOpacity onPress={() => handleRenameAccount(acct.id, acct.name)}>
                                            <Text style={{color: COLORS.primary}}>Rename</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => actions.archiveAccount(acct.id, !acct.archived)}>
                                            <Text style={{color: acct.archived ? COLORS.success : COLORS.muted}}>
                                                {acct.archived ? 'Unarchive' : 'Archive'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Categories */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Manage Categories</Text>
                    
                    <Text style={styles.helperText}>Select account to manage categories for:</Text>
                    <View style={styles.accountSelector}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {state.accounts.filter(a => !a.archived).map(acct => {
                                const isSelected = effectiveCatAccountId === acct.id;
                                return (
                                    <TouchableOpacity 
                                        key={acct.id} 
                                        style={[styles.accountPill, isSelected && styles.accountPillActive]}
                                        onPress={() => {
                                            setCatAccountId(acct.id);
                                            actions.switchAccount(acct.id); // Sync globally for Analytics
                                        }}
                                    >
                                        <Text style={[styles.accountPillText, isSelected && styles.accountPillTextActive]}>{acct.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.row}>
                        <TextInput 
                            style={styles.input}
                            placeholder="New Category"
                            value={newCategory}
                            onChangeText={setNewCategory}
                        />
                        <TouchableOpacity style={styles.btnSmall} onPress={handleAddCategory}>
                            <Text style={styles.btnText}>Add</Text>
                        </TouchableOpacity>
                     </View>
                      <View style={styles.catList}>
                        {selectedAccount?.categories.map(c => {
                             const val = localBudgets[c] || '';
                            return (
                                <View key={c} style={styles.catItem}>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.catItemText}>{c}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                        <Text style={{color: COLORS.text, fontSize: 12}}>{currencySymbol}</Text>
                                        <TextInput 
                                            style={styles.budgetInput}
                                            placeholder="0.00"
                                            keyboardType="decimal-pad"
                                            value={val}
                                            onChangeText={(text) => {
                                                const sanitized = text.replace(/[^0-9.]/g, '');
                                                if (sanitized.split('.').length > 2) return;
                                                setLocalBudgets(prev => ({ ...prev, [c]: sanitized }));
                                                setBudgetsModified(true);
                                            }}
                                            returnKeyType="done"
                                        />
                                        <TouchableOpacity onPress={() => {
                                            if (selectedAccount) {
                                                Alert.alert("Delete Category", `Remove ${c}?`, [
                                                    { text: "Cancel" },
                                                    { text: "Delete", style: 'destructive', onPress: () => actions.deleteCategory(c, selectedAccount.id) }
                                                ]);
                                            }
                                        }}>
                                            <Text style={{color: COLORS.danger}}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                      </View>

                      {budgetsModified && (
                          <TouchableOpacity 
                              style={[styles.actionBtn, { marginTop: 20 }]} 
                              onPress={handleSaveBudgets}
                          >
                              <Text style={styles.actionBtnText}>Save Budget Goals</Text>
                          </TouchableOpacity>
                      )}
                </View>

                {/* Data Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Management</Text>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleExportExcel}>
                        <Text style={styles.actionBtnText}>Export to Excel (.xlsx)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleResetMonth}>
                        <Text style={[styles.actionBtnText, styles.dangerBtnText]}>Reset Current Month</Text>
                    </TouchableOpacity>
                </View>

                {/* Security */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    <View style={styles.securityRow}>
                        <View>
                            <Text style={styles.securityLabel}>Use Biometrics</Text>
                            <Text style={styles.securityDesc}>Prompt for FaceID/Fingerprint on app start</Text>
                        </View>
                        <Switch 
                            value={useBiometrics}
                            onValueChange={(val) => { toggleBiometrics(val); }}
                            trackColor={{ false: COLORS.muted, true: COLORS.primaryLight }}
                            thumbColor={useBiometrics ? COLORS.primary : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        padding: SIZES.padding,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 20,
    },
    section: {
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radius,
        padding: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    helperText: {
        fontSize: 13,
        color: COLORS.muted,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.bg,
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
    },
    btnSmall: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnText: {
        color: '#fff',
        fontWeight: '600',
    },
    pillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pill: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: COLORS.bg,
    },
    pillActive: {
        backgroundColor: COLORS.primary,
    },
    pillText: {
        color: COLORS.text,
    },
    pillTextActive: {
        color: '#fff',
    },
    catList: {
        marginTop: 8,
    },
    catItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bg,
    },
    catItemText: {
        fontSize: 16,
        color: COLORS.text,
    },
    accountSelector: {
        marginBottom: 15,
        marginTop: 5,
    },
    accountPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: COLORS.bg,
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.bg,
    },
    accountPillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    accountPillText: {
        fontSize: 12,
        color: COLORS.text,
    },
    accountPillTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    renameContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    renameInput: {
        backgroundColor: COLORS.bg,
        padding: 5,
        borderRadius: 4,
        fontSize: 14,
        marginBottom: 5,
        color: COLORS.text,
    },
    saveRenameText: {
        color: COLORS.success,
        fontSize: 12,
        fontWeight: 'bold',
    },
    cancelRenameText: {
        color: COLORS.muted,
        fontSize: 12,
    },
    budgetInput: {
        backgroundColor: COLORS.bg,
        padding: 8,
        borderRadius: 6,
        fontSize: 14,
        width: 80,
    },
    accountList: {
        marginTop: 12,
    },
    accountItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bg,
    },
    accountName: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text,
    },
    accountMeta: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 2,
    },
    actionBtn: {
        backgroundColor: COLORS.primary,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    dangerBtn: {
        backgroundColor: COLORS.danger,
    },
    dangerBtnText: {
        color: '#fff',
    },
    securityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bg,
    },
    securityLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text,
    },
    securityDesc: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 2,
    },
    userSection: {
        marginTop: 16,
        padding: 12,
        backgroundColor: COLORS.bg,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    formGroupVertical: {
        flexDirection: 'column',
        gap: 10,
        marginBottom: 10,
    },
    inputFull: {
        backgroundColor: COLORS.bg,
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
        color: COLORS.text,
    },
    currencyPrefix: {
        fontSize: 16,
        color: COLORS.text,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userEmail: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '600',
    },
    userName: {
        fontSize: 12,
        color: COLORS.muted,
    },
    signOutBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    signOutText: {
        color: COLORS.danger,
        fontWeight: 'bold',
    }
});
