import React, { useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES, SHADOWS, CATEGORY_ICONS } from '../../src/theme';
import { formatMonthKey } from '../../src/storage';
import { BudgetState, Expense, AccountData } from '../../src/types';

const { width } = Dimensions.get('window');



export default function DashboardScreen() {
  const { state, loading, currentMonth, currencySymbol, actions } = useBudgetData();

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

  let totalIncome = 0;
  let totalExpense = 0;
  let allExpenses: (Expense & { accountId?: number })[] = [];

  Object.entries(monthData.accounts).forEach(([acctId, acct]) => {
    const id = parseInt(acctId);
    if (state.activeAccountId !== 'all' && state.activeAccountId !== id) return;

    totalIncome += ((acct as AccountData).income || 0);
    (acct as AccountData).expenses.forEach((exp: Expense) => {
      const val = (exp.amount || 0);
      totalExpense += val;
      allExpenses.push({ ...exp, accountId: id });
    });
  });

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0';

  const navigateMonth = (direction: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + direction);
    const newMonth = formatMonthKey(date);
    actions.changeMonth(newMonth);
  };

  const handleDeleteExpense = (expense: Expense & { accountId?: number }) => {
    const accountId = expense.accountId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId);
    actions.deleteExpense(expense.id, accountId);
  };

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

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.greetingText}>
            {state?.userProfile?.name ? `Hello, ${state.userProfile.name.split(' ')[0]}!` : 'Guest,'}
          </Text>
          <View style={styles.brandTitle}>
            <Image source={require(`../../assets/images/vridhi_icon.png`)} style={styles.brandIcon} />
            <Text style={styles.brandTitleText}> Welcome to Vridhi</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => router.push('/profile')}
        >
          <LinearGradient
            colors={COLORS.gradientPrimary}
            style={styles.profileGradient}
          >
            <Ionicons name="person" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.monthNavRow}>
        <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.monthNavIcon}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.monthDisplay}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.muted} style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{currentMonth}</Text>
        </View>
        <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.monthNavIcon}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.accountSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
          <TouchableOpacity
            style={[styles.accountBadge, state.activeAccountId === 'all' && styles.accountBadgeActive]}
            onPress={() => actions.switchAccount('all')}
          >
            <Text style={[styles.accountBadgeText, state.activeAccountId === 'all' && styles.accountBadgeTextActive]}>All Accounts</Text>
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

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={COLORS.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mainCard, SHADOWS.large]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>TOTAL BALANCE</Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>{savingsRate}% saved</Text>
          </View>
        </View>
        <Text style={styles.cardValue}>{currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="arrow-up-circle" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.footerText}>Income: {currencySymbol}{totalIncome.toFixed(0)}</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="arrow-down-circle" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.footerText}>Spent: {currencySymbol}{totalExpense.toFixed(0)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.miniCardsRow}>
        <View style={[styles.miniCard, { backgroundColor: COLORS.successLight }]}>
          <View style={[styles.miniIconBg, { backgroundColor: COLORS.success }]}>
            <Ionicons name="trending-up" size={16} color="#fff" />
          </View>
          <Text style={styles.miniLabel}>Income</Text>
          <Text style={[styles.miniValue, { color: COLORS.success }]}>+{currencySymbol}{totalIncome.toFixed(0)}</Text>
        </View>
        <View style={[styles.miniCard, { backgroundColor: COLORS.dangerLight }]}>
          <View style={[styles.miniIconBg, { backgroundColor: COLORS.danger }]}>
            <Ionicons name="trending-down" size={16} color="#fff" />
          </View>
          <Text style={styles.miniLabel}>Expenses</Text>
          <Text style={[styles.miniValue, { color: COLORS.danger }]}>-{currencySymbol}{totalExpense.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );

  const renderExpense = (item: Expense & { accountId?: number }, index: number) => {
    const category = item.category?.[0] || 'Other';
    const iconName = CATEGORY_ICONS[category] || 'help-circle';

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.expenseItem}
        onPress={() => handleEditExpense(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.catIconBg, { backgroundColor: COLORS.bg }]}>
          <Ionicons name={iconName as any} size={22} color={COLORS.primary} />
        </View>
        <View style={styles.expInfo}>
          <Text style={styles.expTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.expCat}>{category} • {item.date || 'No date'}</Text>
        </View>
        <View style={styles.expRight}>
          <Text style={styles.expAmount}>-{currencySymbol}{item.amount.toFixed(2)}</Text>
          <TouchableOpacity
            onPress={() => handleDeleteExpense(item)}
            style={styles.deleteAction}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {renderHeader()}
        {renderSummaryCards()}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {allExpenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.muted} />
            <Text style={styles.emptyText}>No recent transactions found</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {[...allExpenses].reverse().map((item, index) => renderExpense(item, index))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/modal')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={COLORS.gradientPrimary}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: 10,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  brandTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitleText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  profileGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: SIZES.radiusMedium,
    ...SHADOWS.small,
    marginBottom: 16,
  },
  monthNavIcon: {
    padding: 4,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  accountSelector: {
    flexDirection: 'row',
  },
  accountBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surface,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    ...SHADOWS.small,
  },
  accountBadgeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  accountBadgeText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  accountBadgeTextActive: {
    color: '#fff',
  },
  summaryContainer: {
    paddingHorizontal: SIZES.padding,
    marginBottom: 24,
  },
  mainCard: {
    padding: 24,
    borderRadius: SIZES.radiusLarge,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  savingsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  miniCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniCard: {
    width: (width - SIZES.padding * 2 - 12) / 2,
    padding: 16,
    borderRadius: SIZES.radiusMedium,
    ...SHADOWS.small,
  },
  miniIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  miniLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: SIZES.padding,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: SIZES.radiusMedium,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  catIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  expInfo: {
    flex: 1,
  },
  expTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  expCat: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  expRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  deleteAction: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    ...SHADOWS.colored(COLORS.primary),
  },
  fabGradient: {
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
});
