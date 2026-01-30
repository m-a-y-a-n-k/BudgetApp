import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useFocusEffect } from 'expo-router';
import { useBudgetData } from '../../src/hooks/useBudgetData';
import { COLORS, SIZES } from '../../src/theme';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: COLORS.surface,
  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
  strokeWidth: 2, // optional, default 3
  barPercentage: 0.5,
  useShadowColorFromDataset: false, // optional
  labelColor: (opacity = 1) => COLORS.text,
};

import { BudgetState, Expense, AccountData } from '../../src/types';

export default function AnalyticsScreen() {
    const { state, loading, currentMonth, actions } = useBudgetData();

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
    let categoryTotals: { [key: string]: number } = {};
    let totalExpense = 0;

    // Aggregate categories and budgets
    let aggregatedBudgets: { [key: string]: number } = {};
    Object.entries(monthData.accounts).forEach(([acctId, acct]) => {
        const id = parseInt(acctId);
        if (state.activeAccountId !== 'all' && state.activeAccountId !== id) return;

        // Total Expenses
        (acct as AccountData).expenses.forEach((exp: Expense) => {
            const cat = exp.category ? exp.category[0] : 'Other';
            const val = exp.amount || 0;
            categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
            totalExpense += val;
        });

        // Aggregated Budgets
        const budgets = (acct as AccountData).categoryBudgets || {};
        Object.keys(budgets).forEach(cat => {
            aggregatedBudgets[cat] = (aggregatedBudgets[cat] || 0) + budgets[cat];
        });
    });

    // Prepare Pie Chart Data
    const pieData = Object.keys(categoryTotals).map((cat, index) => {
        // Generate random color if not enough predefined
        const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#e879f9']; 
        return {
            name: cat,
            population: categoryTotals[cat],
            color: colors[index % colors.length],
            legendFontColor: COLORS.text,
            legendFontSize: 12
        };
    }).sort((a,b) => b.population - a.population);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                <Text style={styles.headerTitle}>Analytics</Text>
                <Text style={styles.subHeader}>{currentMonth}</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Spending by Category</Text>
                    {totalExpense > 0 ? (
                         <PieChart
                            data={pieData}
                            width={screenWidth - SIZES.padding * 2}
                            height={220}
                            chartConfig={chartConfig}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                            absolute
                        />
                    ) : (
                        <Text style={styles.emptyText}>No data to display</Text>
                    )}
                </View>

                {/* Budget Progress */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Budget Goals</Text>
                    {Object.keys(categoryTotals).length === 0 ? (
                        <Text style={styles.emptyText}>No spending yet</Text>
                    ) : (
                        Object.keys({ ...categoryTotals, ...aggregatedBudgets }).map(cat => {
                            const spent = categoryTotals[cat] || 0;
                            const budget = aggregatedBudgets[cat] || 0;
                            if (spent === 0 && budget === 0) return null;
                            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                            let color = COLORS.success;
                            if (pct > 75) color = '#f59e0b';
                            if (pct >= 100) color = COLORS.danger;

                            return (
                                <View key={cat} style={styles.budgetRow}>
                                    <View style={styles.budgetHeader}>
                                        <Text style={styles.budgetCat}>{cat}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={[styles.budgetVal, { fontWeight: 'bold', color: color, marginRight: 8 }]}>
                                                {budget > 0 ? `${((spent / budget) * 100).toFixed(0)}%` : '0%'}
                                            </Text>
                                            <Text style={styles.budgetVal}>
                                                ${spent.toFixed(0)} {budget > 0 ? `/ $${budget}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    {budget > 0 && (
                                        <View style={styles.progressBarBg}>
                                            <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>

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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    subHeader: {
        fontSize: 16,
        color: COLORS.muted,
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
        alignSelf: 'flex-start'
    },
    emptyText: {
        color: COLORS.muted,
        padding: 20,
        textAlign: 'center',
        width: '100%'
    },
    budgetRow: {
        marginBottom: 12,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    budgetCat: {
        fontWeight: '500',
        color: COLORS.text,
    },
    budgetVal: {
        color: COLORS.muted,
        fontSize: 12,
    },
    progressBarBg: {
        height: 10,
        backgroundColor: COLORS.bg,
        borderRadius: 5,
        overflow: 'hidden',
        marginTop: 4,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    }
});
