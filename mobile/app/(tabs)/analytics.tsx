import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES, SHADOWS, CATEGORY_ICONS } from '../../src/theme';

const { width: screenWidth } = Dimensions.get('window');



const chartConfig = {
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: COLORS.surface,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => COLORS.text,
  strokeWidth: 2,
};

import { Expense, AccountData } from '../../src/types';

export default function AnalyticsScreen() {
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
    let categoryTotals: { [key: string]: number } = {};
    let totalExpense = 0;

    let aggregatedBudgets: { [key: string]: number } = {};
    Object.entries(monthData.accounts).forEach(([acctId, acct]) => {
        const id = parseInt(acctId);
        if (state.activeAccountId !== 'all' && state.activeAccountId !== id) return;

        (acct as AccountData).expenses.forEach((exp: Expense) => {
            const cat = exp.category ? exp.category[0] : 'Other';
            const val = exp.amount || 0;
            categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
            totalExpense += val;
        });

        const budgets = (acct as AccountData).categoryBudgets || {};
        Object.keys(budgets).forEach(cat => {
            aggregatedBudgets[cat] = (aggregatedBudgets[cat] || 0) + budgets[cat];
        });
    });

    const allCategories = Array.from(new Set([...Object.keys(categoryTotals), ...Object.keys(aggregatedBudgets)]))
        .sort((a, b) => (categoryTotals[b] || 0) - (categoryTotals[a] || 0));

    const pieColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e'];
    const pieData = Object.keys(categoryTotals).map((cat, index) => {
        return {
            name: cat,
            population: categoryTotals[cat],
            color: pieColors[index % pieColors.length],
            legendFontColor: COLORS.textLight,
            legendFontSize: 12
        };
    }).sort((a,b) => b.population - a.population);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Analytics</Text>
                        <View style={styles.monthTag}>
                            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                            <Text style={styles.monthTagText}>{currentMonth}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.accountSelector}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SIZES.padding }}>
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

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Expense Breakdown</Text>
                    {totalExpense > 0 ? (
                        <View style={styles.chartContainer}>
                            <PieChart
                                data={pieData}
                                width={screenWidth - SIZES.padding * 2 - 32}
                                height={200}
                                chartConfig={chartConfig}
                                accessor={"population"}
                                backgroundColor={"transparent"}
                                paddingLeft={"0"}
                                center={[0, 0]}
                                absolute
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyChart}>
                            <Ionicons name="pie-chart-outline" size={48} color={COLORS.muted} />
                            <Text style={styles.emptyText}>No expenses logged this month</Text>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Budget Progress</Text>
                    {allCategories.length === 0 ? (
                        <Text style={styles.emptyText}>Start adding expenses to see progress</Text>
                    ) : (
                        allCategories.map((cat, index) => {
                            const spent = categoryTotals[cat] || 0;
                            const budget = aggregatedBudgets[cat] || 0;
                            const displayPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                            const actualPct = budget > 0 ? (spent / budget) * 100 : 0;
                            const iconName = CATEGORY_ICONS[cat] || 'apps-outline';
                            
                            let color = COLORS.success;
                            let bgColor = COLORS.successLight;
                            if (actualPct >= 75) { color = COLORS.warning; bgColor = COLORS.warningLight; }
                            if (actualPct > 100) { color = COLORS.danger; bgColor = COLORS.dangerLight; }

                            return (
                                <View key={cat} style={styles.budgetCard}>
                                    <View style={styles.budgetInfo}>
                                        <View style={[styles.catIconBox, { backgroundColor: COLORS.bg }]}>
                                            <Ionicons name={iconName as any} size={20} color={COLORS.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.budgetCardHeader}>
                                                <Text style={styles.catName}>{cat}</Text>
                                                <Text style={[styles.pctText, { color }]}>{actualPct.toFixed(0)}%</Text>
                                            </View>
                                            <View style={styles.progressBarWrapper}>
                                                <View style={styles.progressBarBg}>
                                                    <LinearGradient
                                                        colors={actualPct > 100 ? COLORS.gradientDanger : actualPct > 75 ? COLORS.gradientWarning : COLORS.gradientSuccess}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={[styles.progressBarFill, { width: `${displayPct}%` }]}
                                                    />
                                                </View>
                                            </View>
                                            <Text style={styles.budgetAmount}>
                                                {currencySymbol}{spent.toFixed(0)} spent {budget > 0 ? `of ${currencySymbol}${budget}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
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
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5,
    },
    monthTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 6,
        ...SHADOWS.small,
    },
    monthTagText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 4,
    },
    accountSelector: {
        marginVertical: 16,
    },
    accountBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: SIZES.radiusFull,
        backgroundColor: COLORS.surface,
        marginRight: 10,
        ...SHADOWS.small,
    },
    accountBadgeActive: {
        backgroundColor: COLORS.primary,
    },
    accountBadgeText: {
        fontSize: 13,
        color: COLORS.textLight,
        fontWeight: '600',
    },
    accountBadgeTextActive: {
        color: '#fff',
    },
    section: {
        marginHorizontal: SIZES.padding,
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusLarge,
        padding: 20,
        marginBottom: 20,
        ...SHADOWS.small,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 20,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyChart: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyText: {
        color: COLORS.muted,
        marginTop: 10,
        textAlign: 'center',
        fontSize: 14,
    },
    budgetCard: {
        marginBottom: 20,
    },
    budgetInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    catIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    budgetCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    catName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    pctText: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressBarWrapper: {
        marginBottom: 6,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: COLORS.bg,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    budgetAmount: {
        fontSize: 12,
        color: COLORS.textLight,
        fontWeight: '500',
    },
});
