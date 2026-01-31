import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useBudgetData } from '../src/hooks/useBudgetData';
import { COLORS, SIZES } from '../src/theme';
import { todayISO } from '../src/storage';

import { BudgetState, Expense } from '../src/types';

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
        
        // Find expense in the current month across target account
        const monthKey = state.currentMonth; // Use state's current month
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
      <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
          <TouchableOpacity onPress={() => router.dismiss()}>
              <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
         {/* Amount */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Amount</Text>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                 <Text style={[styles.currencyPrefix, errors.amount && {color: COLORS.danger}]}>{currencySymbol}</Text>
                 <TextInput 
                    style={[styles.input, styles.amountInput, {flex: 1}, errors.amount && styles.inputError]}
                    placeholder="0.00"
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

         {/* Title */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Description</Text>
             <TextInput 
                style={[styles.input, errors.title && styles.inputError]}
                placeholder="What is this for?"
                value={title}
                onChangeText={(text) => {
                    setTitle(text);
                    if (errors.title) setErrors({...errors, title: undefined});
                }}
             />
             {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
         </View>
         
         {/* Date */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
             <TextInput 
                style={[styles.input, errors.date && styles.inputError]}
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={(text) => {
                    setDate(text);
                    if (errors.date) setErrors({...errors, date: undefined});
                }}
             />
             {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
         </View>

         {/* Categories */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Category</Text>
             <View style={styles.catsContainer}>
                 {targetAccount?.categories.map(c => (
                     <TouchableOpacity 
                        key={c} 
                        style={[styles.catChip, category === c && styles.catChipActive]}
                        onPress={() => setCategory(c)}
                     >
                         <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
                     </TouchableOpacity>
                 ))}
             </View>
          </View>

           {/* Account Selector */}
           <View style={styles.formGroup}>
               <Text style={styles.label}>Account</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                   <View style={{ flexDirection: 'row', gap: 8 }}>
                       {state.accounts.filter(a => !a.archived).map(acct => {
                           const isSelected = targetAccountId === acct.id || 
                               (!targetAccountId && (state.activeAccountId === acct.id || (state.activeAccountId === 'all' && state.accounts[0].id === acct.id)));
                           
                           return (
                               <TouchableOpacity 
                                   key={acct.id} 
                                   style={[styles.accountPill, isSelected && styles.accountPillActive]}
                                   onPress={() => setTargetAccountId(acct.id)}
                               >
                                   <Text style={[styles.accountPillText, isSelected && styles.accountPillTextActive]}>{acct.name}</Text>
                               </TouchableOpacity>
                           );
                       })}
                   </View>
               </ScrollView>
           </View>

        </ScrollView>

      <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Expense</Text>
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
      padding: SIZES.padding,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
  },
  closeText: {
      fontSize: 16,
      color: COLORS.primary,
  },
  form: {
      padding: SIZES.padding,
  },
  formGroup: {
      marginBottom: 20,
  },
  label: {
      fontSize: 14,
      color: COLORS.muted,
      marginBottom: 8,
  },
  input: {
      backgroundColor: COLORS.surface,
      padding: 16,
      borderRadius: SIZES.radius,
       fontSize: 16,
       color: COLORS.text,
       borderWidth: 1,
       borderColor: 'transparent',
   },
   inputError: {
       borderColor: COLORS.danger,
   },
    currencyPrefix: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginRight: 8,
    },
    errorText: {
       color: COLORS.danger,
       fontSize: 12,
       marginTop: 4,
       marginLeft: 4,
   },
   amountInput: {
      fontSize: 24,
      fontWeight: 'bold',
  },
  catsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
  },
  catChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
  },
  catChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
  },
  catText: {
      color: COLORS.text,
  },
  catTextActive: {
      color: '#fff',
  },
  footer: {
      padding: SIZES.padding,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
  },
  saveBtn: {
      backgroundColor: COLORS.primary,
      padding: 16,
      borderRadius: SIZES.radius,
      alignItems: 'center',
  },
  saveBtnText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
  },
  accountPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
  },
  accountPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
  },
  accountPillText: {
      fontSize: 14,
      color: COLORS.text,
  },
  accountPillTextActive: {
      color: '#fff',
      fontWeight: '600',
  }
});
