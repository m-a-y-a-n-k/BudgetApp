import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBudgetData } from '../src/hooks/useBudgetData';
import { COLORS, SIZES, SHADOWS, CATEGORY_ICONS } from '../src/theme';
import { todayISO } from '../src/storage';

const { width } = Dimensions.get('window');

export default function ModalScreen() {
  const { state, currencySymbol, actions } = useBudgetData();
  const params = useLocalSearchParams();
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [date, setDate] = useState(todayISO());
  const [targetAccountId, setTargetAccountId] = useState<number | null>(
      params.accountId ? parseInt(params.accountId as string) : null
  );

  const [errors, setErrors] = useState<{title?: string, amount?: string, date?: string}>({});
  const isEditing = params.editMode === 'true';

  useEffect(() => {
    if (isEditing && params.expenseId && params.accountId && state) {
        const acctId = String(params.accountId);
        const expId = parseInt(params.expenseId as string);
        const monthKey = state.currentMonth;
        const monthData = state.months[monthKey];
        if (monthData && monthData.accounts[acctId]) {
            const exp = monthData.accounts[acctId].expenses.find(e => e.id === expId);
            if (exp) {
                setTitle(exp.title);
                setAmount(String(exp.amount));
                setCategory(exp.category?.[0] || 'Groceries');
                setDate(exp.date);
            }
        }
    }
  }, [isEditing, params.expenseId, params.accountId, state]);

  if (!state) return null;

  const effectiveAcctId = targetAccountId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId as number);
  const targetAccount = state.accounts.find(a => a.id === effectiveAcctId);

  const validate = () => {
    const newErrors: {title?: string, amount?: string, date?: string} = {};
    if (!title.trim()) newErrors.title = 'Description is required';
    if (!amount) {
        newErrors.amount = 'Amount is required';
    } else {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            newErrors.amount = 'Enter a valid positive amount';
        }
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        newErrors.date = 'Use YYYY-MM-DD format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
      if (!validate()) return;
      const parsedAmount = parseFloat(amount);
      const expenseData = {
          title: title.trim(), 
          amount: parsedAmount,
          date,
          category: [category]
      };

      if (isEditing && params.expenseId && params.accountId) {
          await actions.editExpense(
              parseInt(params.expenseId as string), 
              parseInt(params.accountId as string), 
              expenseData
          );
          Alert.alert("Success", "Expense updated");
      } else {
          await actions.addExpense(expenseData, targetAccountId || undefined);
          Alert.alert("Success", "Expense added");
      }
      router.dismiss();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
          <TouchableOpacity onPress={() => router.dismiss()} style={styles.backBtn}>
              <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Transaction' : 'New Transaction'}</Text>
          <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
         
         {/* Amount Section */}
         <View style={styles.amountContainer}>
             <Text style={styles.label}>Enter Amount</Text>
             <View style={styles.amountRow}>
                 <Text style={[styles.currencySymbol, !!errors.amount && { color: COLORS.danger }]}>{currencySymbol}</Text>
                 <TextInput 
                    style={[styles.amountInput, !!errors.amount && styles.inputError]}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={(text) => {
                      const sanitized = text.replace(/[^0-9.]/g, '');
                      if (sanitized.split('.').length > 2) return;
                      setAmount(sanitized);
                      if (errors.amount) setErrors({...errors, amount: undefined});
                    }}
                    autoFocus
                 />
             </View>
             {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
         </View>

         {/* Form Fields */}
         <View style={styles.section}>
             {/* Description */}
             <View style={styles.fieldGroup}>
                 <Text style={styles.fieldLabel}>What's it for?</Text>
                 <View style={styles.inputWrapper}>
                     <Ionicons name="create-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                     <TextInput 
                        style={[styles.input, !!errors.title && styles.inputError]}
                        placeholder="e.g. Starbucks, Rent, Amazon"
                        placeholderTextColor={COLORS.muted}
                        value={title}
                        onChangeText={(text) => {
                            setTitle(text);
                            if (errors.title) setErrors({...errors, title: undefined});
                        }}
                     />
                 </View>
                 {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
             </View>
             
             {/* Date */}
             <View style={styles.fieldGroup}>
                 <Text style={styles.fieldLabel}>Transaction Date</Text>
                 <View style={styles.inputWrapper}>
                     <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                     <TextInput 
                        style={[styles.input, !!errors.date && styles.inputError]}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={COLORS.muted}
                        value={date}
                        onChangeText={(text) => {
                            setDate(text);
                            if (errors.date) setErrors({...errors, date: undefined});
                        }}
                     />
                 </View>
                 {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
             </View>
         </View>

         {/* Account Selector */}
         <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>Select Account</Text>
         </View>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSection}>
            {state.accounts.filter(a => !a.archived).map(acct => {
                const isSelected = targetAccountId === acct.id || 
                    (!targetAccountId && (state.activeAccountId === acct.id || (state.activeAccountId === 'all' && state.accounts[0].id === acct.id)));
                
                return (
                    <TouchableOpacity 
                        key={acct.id} 
                        style={[styles.accountCard, isSelected && styles.accountCardActive]}
                        onPress={() => setTargetAccountId(acct.id)}
                    >
                        <Ionicons 
                            name={acct.type === 'Credit Card' ? 'card' : 'business'} 
                            size={20} 
                            color={isSelected ? '#fff' : COLORS.primary} 
                        />
                        <Text style={[styles.accountName, isSelected && styles.accountNameActive]}>{acct.name}</Text>
                        <Text style={[styles.accountType, isSelected && styles.accountTypeActive]}>{acct.type}</Text>
                    </TouchableOpacity>
                );
            })}
         </ScrollView>

         {/* Category Selection */}
         <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>Category</Text>
             <Text style={styles.sectionSubtitle}>{targetAccount?.categories.length} available</Text>
         </View>
         <View style={styles.catGrid}>
             {targetAccount?.categories.map(c => {
                 const isSel = category === c;
                 const iconName = CATEGORY_ICONS[c] || 'options';
                 return (
                     <TouchableOpacity 
                        key={c} 
                        style={[styles.catItem, isSel && styles.catItemActive]}
                        onPress={() => setCategory(c)}
                     >
                         <View style={[styles.catIconBg, isSel && styles.catIconBgActive]}>
                             <Ionicons name={iconName as any} size={22} color={isSel ? '#fff' : COLORS.primary} />
                         </View>
                         <Text style={[styles.catLabel, isSel && styles.catLabelActive]} numberOfLines={1}>{c}</Text>
                     </TouchableOpacity>
                 );
             })}
         </View>

        </ScrollView>

      {/* Footer / Action */}
      <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={handleSave}
            activeOpacity={0.8}
          >
              <LinearGradient
                colors={COLORS.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                  <Text style={styles.saveBtnText}>{isEditing ? 'Update Transaction' : 'Save Transaction'}</Text>
              </LinearGradient>
          </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SIZES.padding,
      paddingVertical: 15,
      backgroundColor: COLORS.surface,
  },
  backBtn: {
      padding: 5,
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.text,
  },
  form: {
      paddingBottom: 40,
  },
  amountContainer: {
      backgroundColor: COLORS.surface,
      paddingVertical: 30,
      paddingHorizontal: SIZES.padding,
      alignItems: 'center',
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      ...SHADOWS.small,
  },
  label: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
  },
  amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
  },
  currencySymbol: {
      fontSize: 36,
      fontWeight: '300',
      color: COLORS.text,
      marginRight: 8,
  },
  amountInput: {
      fontSize: 48,
      fontWeight: '800',
      color: COLORS.text,
      minWidth: 150,
      textAlign: 'center',
  },
  inputError: {
      color: COLORS.danger,
  },
  errorText: {
      color: COLORS.danger,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
  },
  section: {
      padding: SIZES.padding,
      gap: 20,
  },
  fieldGroup: {
      gap: 8,
  },
  fieldLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.text,
      marginLeft: 4,
  },
  inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      borderRadius: SIZES.radiusMedium,
      paddingHorizontal: 15,
      ...SHADOWS.small,
  },
  inputIcon: {
      marginRight: 10,
  },
  input: {
      flex: 1,
      paddingVertical: 15,
      fontSize: 16,
      color: COLORS.text,
      fontWeight: '500',
  },
  sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: SIZES.padding,
      marginTop: 20,
      marginBottom: 12,
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: COLORS.text,
  },
  sectionSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.muted,
  },
  scrollSection: {
      paddingLeft: SIZES.padding,
      marginBottom: 10,
  },
  accountCard: {
      backgroundColor: COLORS.surface,
      padding: 15,
      borderRadius: SIZES.radiusMedium,
      marginRight: 12,
      width: 130,
      ...SHADOWS.small,
  },
  accountCardActive: {
      backgroundColor: COLORS.primary,
  },
  accountName: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.text,
      marginTop: 10,
  },
  accountNameActive: {
      color: '#fff',
  },
  accountType: {
      fontSize: 11,
      color: COLORS.textLight,
      marginTop: 2,
  },
  accountTypeActive: {
      color: 'rgba(255,255,255,0.8)',
  },
  catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: SIZES.padding,
      gap: 12,
  },
  catItem: {
      width: (width - (SIZES.padding * 2) - 24) / 3, // 3 columns
      backgroundColor: COLORS.surface,
      padding: 12,
      borderRadius: SIZES.radiusMedium,
      alignItems: 'center',
      ...SHADOWS.small,
  },
  catItemActive: {
      backgroundColor: COLORS.primaryLight,
  },
  catIconBg: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
  },
  catIconBgActive: {
      backgroundColor: COLORS.primary,
  },
  catLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textLight,
  },
  catLabelActive: {
      color: COLORS.primary,
  },
  footer: {
      padding: SIZES.padding,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
  },
  saveBtn: {
      borderRadius: SIZES.radiusLarge,
      overflow: 'hidden',
      ...SHADOWS.medium,
  },
  saveGradient: {
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
  },
  saveBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
  },
});
