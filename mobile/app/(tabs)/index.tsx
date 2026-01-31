import React, { useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES } from '../../src/theme';
import { formatMonthKey } from '../../src/storage';

import { BudgetState, Expense, AccountData } from '../../src/types';

export default function DashboardScreen() {
  const { state, loading, currentMonth, currencySymbol, actions } = useBudgetData();

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      actions.loadData();
    }, [actions.loadData])
  );

  if (loading || !state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const monthData = state.months[currentMonth] || { accounts: {} };
  
  // Calculate totals
  let totalIncome = 0;
  let totalExpense = 0;
  let allExpenses: (Expense & { accountId?: number })[] = [];
  let categoryTotals: { [key: string]: number } = {}; // Initialize categoryTotals

  Object.entries(monthData.accounts).forEach(([acctId, acct]) => {
    const id = parseInt(acctId);
    if (state.activeAccountId !== 'all' && state.activeAccountId !== id) return;
    
    totalIncome += ((acct as AccountData).income || 0);
    (acct as AccountData).expenses.forEach((exp: Expense) => {
      const val = (exp.amount || 0);
      totalExpense += val;
      allExpenses.push({ ...exp, accountId: id });

      // Aggregate data for category totals
      const cat = exp.category ? exp.category[0] : 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
    });
  });

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0';

  // Month navigation
  const navigateMonth = (direction: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + direction);
    const newMonth = formatMonthKey(date);
    actions.changeMonth(newMonth);
  };

  // Handle delete expense
  const handleDeleteExpense = (expense: Expense & { accountId?: number }) => {
    const accountId = expense.accountId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId);
    actions.deleteExpense(expense.id, accountId);
  };

  // Handle edit expense
  const handleEditExpense = (expense: Expense & { accountId?: number }) => {
    const accountId = expense.accountId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId);
    router.push({
      pathname: '/modal',
      params: { 
        editMode: 'true',
        expenseId: expense.id,
        accountId: accountId
      }
    });
  };

  // Render Header
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.welcomeText}>Vridhi</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{currentMonth}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.accountSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.accountBadge, state.activeAccountId === 'all' && styles.accountBadgeActive]}
            onPress={() => actions.switchAccount('all')}
          >
            <Text style={[styles.accountBadgeText, state.activeAccountId === 'all' && styles.accountBadgeTextActive]}>All</Text>
          </TouchableOpacity>
          {state.accounts.filter(a => !a.archived).map(acct => (
            <TouchableOpacity 
              key={acct.id}
              style={[styles.accountBadge, state.activeAccountId === acct.id && styles.accountBadgeActive]}
              onPress={() => actions.switchAccount(acct.id)}
            >
              <Text style={[styles.accountBadgeText, state.activeAccountId === acct.id && styles.accountBadgeTextActive]}>{acct.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  // Render Cards
  const renderCards = () => (
    <View style={styles.cardContainer}>
      <View style={[styles.card, { backgroundColor: COLORS.primary }]}>
        <Text style={styles.cardLabel}>Balance</Text>
        <Text style={styles.cardValue}>{currencySymbol}{balance.toFixed(2)}</Text>
        <Text style={styles.cardSubtext}>Savings Rate: {savingsRate}%</Text>
      </View>
      <View style={styles.row}>
         <View style={[styles.card, styles.halfCard, { backgroundColor: COLORS.success }]}>
            <Text style={styles.cardLabel}>Income</Text>
            <Text style={styles.cardValue}>{currencySymbol}{totalIncome.toFixed(2)}</Text>
         </View>
         <View style={[styles.card, styles.halfCard, { backgroundColor: COLORS.danger }]}>
            <Text style={styles.cardLabel}>Expenses</Text>
            <Text style={styles.cardValue}>{currencySymbol}{totalExpense.toFixed(2)}</Text>
         </View>
      </View>
    </View>
  );

  // Render Expense Item
  const renderExpense = (item: Expense & { accountId?: number }, index: number) => (
    <TouchableOpacity 
      key={index}
      style={styles.expenseItem}
      onPress={() => handleEditExpense(item)}
      onLongPress={() => handleEditExpense(item)}
      delayLongPress={500}
    >
      <View style={styles.catBadge}>
        <Text style={styles.catText}>{(item.category?.[0] || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.expTitle}>{item.title}</Text>
        <Text style={styles.expCat}>{item.category?.[0] || 'Uncategorized'}</Text>
        <Text style={styles.expDate}>{item.date || 'No date'}</Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expAmount}>- {currencySymbol}{item.amount.toFixed(2)}</Text>
        <TouchableOpacity 
          onPress={() => handleDeleteExpense(item)}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteText}>×</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {renderHeader()}
        {renderCards()}
        
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {allExpenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses yet.</Text>
        ) : (
            allExpenses.reverse().map((item, index) => renderExpense(item, index))
        )}
      </ScrollView>
      
      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/modal')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: SIZES.padding,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  monthBtn: {
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  monthBtnText: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 16,
    color: COLORS.muted,
  },
  cardContainer: {
    marginBottom: 24,
  },
  card: {
    padding: 20,
    borderRadius: SIZES.radius,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCard: {
    width: '48%',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  cardValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  catBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  expTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  expCat: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 1,
  },
  expDate: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: -2,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    marginTop: -4
  },
  accountSelector: {
    marginTop: 12,
    flexDirection: 'row',
  },
  accountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accountBadgeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  accountBadgeText: {
    fontSize: 12,
    color: COLORS.text,
  },
  accountBadgeTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
