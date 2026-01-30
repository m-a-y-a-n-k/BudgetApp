import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useBudgetData } from '../src/hooks/useBudgetData';
import { COLORS, SIZES } from '../src/theme';
import { todayISO } from '../src/storage';

import { BudgetState, Expense } from '../src/types';

export default function ModalScreen() {
  const { state, actions } = useBudgetData();
  const params = useLocalSearchParams();
  
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [date, setDate] = useState(todayISO());
  const [targetAccountId, setTargetAccountId] = useState<number | null>(
      params.accountId ? parseInt(params.accountId as string) : null
  );

  if (!state) return null;

  const effectiveAcctId = targetAccountId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId as number);
  const targetAccount = state.accounts.find(a => a.id === effectiveAcctId);

  const handleSave = async () => {
      if (!title || !amount) {
          Alert.alert("Error", "Please enter title and amount");
          return;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
          Alert.alert("Error", "Please enter a valid amount");
          return;
      }

      await actions.addExpense({
          title, 
          amount: parsedAmount,
          date,
          category: [category]
      }, targetAccountId || undefined);

      router.dismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <TouchableOpacity onPress={() => router.dismiss()}>
              <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
         {/* Amount */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Amount</Text>
             <TextInput 
                style={[styles.input, styles.amountInput]}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
             />
         </View>

         {/* Title */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Description</Text>
             <TextInput 
                style={styles.input}
                placeholder="What is this for?"
                value={title}
                onChangeText={setTitle}
             />
         </View>
         
         {/* Date */}
         <View style={styles.formGroup}>
             <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
             <TextInput 
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
             />
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
