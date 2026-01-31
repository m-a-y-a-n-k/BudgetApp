import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

    const handleExportPDF = async () => {
        try {
            const monthInfo = state?.months[currentMonth];
            if (!monthInfo) {
                Alert.alert("No Data", "There is no data for the current month.");
                return;
            }

            let globalTotalIncome = 0;
            let globalTotalExpense = 0;
            const categorySpentMap: { [key: string]: number } = {};
            const categoryBudgetMap: { [key: string]: number } = {};
            
            // Build Account Information & Transactions
            let accountsHtml = '';
            const accountSummaries: any[] = [];

            Object.keys(monthInfo.accounts).forEach(acctId => {
                const acctData = monthInfo.accounts[acctId];
                const account = state?.accounts.find(a => String(a.id) === acctId);
                const accountName = account?.name || 'Unknown';
                const accountType = account?.type || 'Other';
                
                const acctIncome = acctData.income || 0;
                let acctExpenses = 0;
                let acctRows = '';

                globalTotalIncome += acctIncome;

                // Track category budgets for this account
                if (acctData.categoryBudgets) {
                    Object.entries(acctData.categoryBudgets).forEach(([cat, budget]) => {
                        categoryBudgetMap[cat] = (categoryBudgetMap[cat] || 0) + (budget as number);
                    });
                }

                acctData.expenses.forEach(exp => {
                    acctExpenses += exp.amount;
                    globalTotalExpense += exp.amount;
                    
                    const cat = exp.category?.[0] || 'Uncategorized';
                    categorySpentMap[cat] = (categorySpentMap[cat] || 0) + exp.amount;

                    acctRows += `
                        <tr>
                            <td>${exp.date}</td>
                            <td>${exp.title}</td>
                            <td><span class="badge">${cat}</span></td>
                            <td class="text-right font-mono">${currencySymbol}${exp.amount.toFixed(2)}</td>
                        </tr>
                    `;
                });

                accountSummaries.push({
                    name: accountName,
                    type: accountType,
                    income: acctIncome,
                    expenses: acctExpenses,
                    balance: acctIncome - acctExpenses
                });

                accountsHtml += `
                    <div class="account-card">
                        <div class="account-card-header">
                            <div>
                                <div class="account-card-name">${accountName}</div>
                                <div class="account-card-type">${accountType}</div>
                            </div>
                            <div class="text-right">
                                <div class="account-card-balance">${currencySymbol}${(acctIncome - acctExpenses).toFixed(2)}</div>
                                <div class="account-card-label">Net Balance</div>
                            </div>
                        </div>
                        <div class="account-mini-stats">
                            <div class="mini-stat">
                                <span class="mini-stat-label">Income</span>
                                <span class="mini-stat-value text-success">${currencySymbol}${acctIncome.toFixed(2)}</span>
                            </div>
                            <div class="mini-stat">
                                <span class="mini-stat-label">Expenses</span>
                                <span class="mini-stat-value text-danger">${currencySymbol}${acctExpenses.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th width="15%">Date</th>
                                        <th width="45%">Description</th>
                                        <th width="20%">Category</th>
                                        <th width="20%" class="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${acctRows || '<tr><td colspan="4" class="text-center empty-state">No transactions recorded</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            });

            // Spending by Category Pie Chart Data
            const sortedCategories = Object.entries(categorySpentMap)
                .sort((a, b) => b[1] - a[1]);
            
            const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#475569'];
            
            let pieChartSvg = '';
            let legendHtml = '';
            
            if (globalTotalExpense > 0) {
                let cumulativePercent = 0;
                
                const getCoordinatesForPercent = (percent: number) => {
                    const x = Math.cos(2 * Math.PI * percent);
                    const y = Math.sin(2 * Math.PI * percent);
                    return [x, y];
                };

                pieChartSvg = `<svg viewBox="-1 -1 2 2" style="transform: rotate(-90deg); width: 200px; height: 200px;">`;
                
                sortedCategories.forEach(([cat, val], i) => {
                    const percent = val / globalTotalExpense;
                    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                    cumulativePercent += percent;
                    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                    const largeArcFlag = percent > 0.5 ? 1 : 0;
                    const pathData = [
                        `M ${startX} ${startY}`,
                        `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                        `L 0 0`,
                    ].join(' ');
                    
                    const color = chartColors[i % chartColors.length];
                    pieChartSvg += `<path d="${pathData}" fill="${color}"></path>`;
                    
                    legendHtml += `
                        <div class="legend-item">
                            <span class="legend-color" style="background: ${color}"></span>
                            <span class="legend-label">${cat}</span>
                            <span class="legend-value">${currencySymbol}${val.toFixed(2)} (${(percent * 100).toFixed(1)}%)</span>
                        </div>
                    `;
                });
                pieChartSvg += `</svg>`;
            }

            // Budget Analytics
            let budgetAnalyticsHtml = '';
            const allCategoriesAcrossAll = Array.from(new Set([...Object.keys(categorySpentMap), ...Object.keys(categoryBudgetMap)]));
            
            allCategoriesAcrossAll.sort().forEach(cat => {
                const spent = categorySpentMap[cat] || 0;
                const budget = categoryBudgetMap[cat] || 0;
                if (budget === 0 && spent === 0) return;
                
                const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : (spent > 0 ? 100 : 0);
                const color = pct > 95 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981';
                
                budgetAnalyticsHtml += `
                    <div class="budget-row">
                        <div class="budget-info">
                            <span class="budget-cat">${cat}</span>
                            <span class="budget-stat">${currencySymbol}${spent.toFixed(2)} <span class="of-txt">of</span> ${budget > 0 ? currencySymbol + budget.toFixed(2) : 'No Budget'}</span>
                        </div>
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${pct}%; background: ${color};"></div>
                        </div>
                    </div>
                `;
            });

            const globalBalance = globalTotalIncome - globalTotalExpense;
            const savingsRate = globalTotalIncome > 0 ? ((globalBalance / globalTotalIncome) * 100).toFixed(1) : '0';

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Financial Report - ${currentMonth}</title>
                    <style>
                        :root {
                            --primary: #6366f1;
                            --primary-light: #eef2ff;
                            --success: #10b981;
                            --danger: #ef4444;
                            --warning: #f59e0b;
                            --text-main: #1e293b;
                            --text-light: #64748b;
                            --bg-soft: #f8fafc;
                            --border: #e2e8f0;
                        }
                        
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                            padding: 40px; 
                            color: var(--text-main); 
                            background-color: #fff; 
                            line-height: 1.5;
                        }
                        
                        * { box-sizing: border-box; }

                        .header { 
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center; 
                            margin-bottom: 40px; 
                            padding-bottom: 20px;
                            border-bottom: 2px solid var(--primary);
                        }
                        
                        .brand { display: flex; align-items: center; gap: 12px; }
                        .logo-circle { width: 40px; height: 40px; background: var(--primary); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; }
                        .brand-name { font-size: 28px; font-weight: 800; color: var(--primary); letter-spacing: -0.5px; }
                        
                        .report-info { text-align: right; }
                        .report-month { font-size: 20px; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
                        .report-date { font-size: 13px; color: var(--text-light); }

                        .summary-grid { 
                            display: grid; 
                            grid-template-columns: repeat(4, 1fr); 
                            gap: 20px; 
                            margin-bottom: 40px; 
                        }
                        
                        .stat-card { 
                            background: var(--bg-soft); 
                            padding: 20px; 
                            border-radius: 16px; 
                            border: 1px solid var(--border);
                        }
                        
                        .stat-label { font-size: 11px; font-weight: 700; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
                        .stat-value { font-size: 22px; font-weight: 800; }
                        .text-success { color: var(--success); }
                        .text-danger { color: var(--danger); }
                        .text-primary { color: var(--primary); }

                        .section-header { 
                            font-size: 18px; 
                            font-weight: 800; 
                            margin: 40px 0 20px 0; 
                            padding-left: 12px;
                            border-left: 4px solid var(--primary);
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }

                        .analytics-grid {
                            display: grid;
                            grid-template-columns: 1fr 1.5fr;
                            gap: 40px;
                            background: var(--bg-soft);
                            padding: 30px;
                            border-radius: 20px;
                            margin-bottom: 40px;
                        }

                        .chart-container { display: flex; flex-direction: column; align-items: center; }
                        .legend { width: 100%; margin-top: 20px; }
                        .legend-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 12px; }
                        .legend-color { width: 12px; height: 12px; border-radius: 3px; margin-right: 8px; }
                        .legend-label { flex: 1; font-weight: 600; color: var(--text-main); }
                        .legend-value { color: var(--text-light); font-family: monospace; }

                        .budget-list { display: flex; flex-direction: column; gap: 15px; }
                        .budget-row { margin-bottom: 5px; }
                        .budget-info { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; }
                        .budget-cat { font-size: 14px; font-weight: 700; color: var(--text-main); }
                        .budget-stat { font-size: 12px; color: var(--text-light); }
                        .of-txt { opacity: 0.5; font-weight: normal; }
                        .progress-bg { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
                        .progress-fill { height: 100%; border-radius: 4px; }

                        .account-card { 
                            margin-bottom: 30px; 
                            border: 1px solid var(--border); 
                            border-radius: 16px; 
                            overflow: hidden; 
                            background: #fff;
                        }
                        
                        .account-card-header { 
                            background: var(--bg-soft); 
                            padding: 20px; 
                            display: flex; 
                            justify-content: space-between; 
                            align-items: center;
                            border-bottom: 1px solid var(--border);
                        }
                        
                        .account-card-name { font-size: 18px; font-weight: 800; color: var(--text-main); }
                        .account-card-type { font-size: 12px; color: var(--text-light); font-weight: 600; text-transform: uppercase; }
                        .account-card-balance { font-size: 20px; font-weight: 800; color: var(--primary); }
                        .account-card-label { font-size: 10px; color: var(--text-light); font-weight: 700; text-transform: uppercase; }

                        .account-mini-stats {
                            display: flex;
                            gap: 30px;
                            padding: 12px 20px;
                            border-bottom: 1px solid #f1f5f9;
                        }

                        .mini-stat { display: flex; flex-direction: column; }
                        .mini-stat-label { font-size: 10px; font-weight: 700; color: var(--text-light); text-transform: uppercase; }
                        .mini-stat-value { font-size: 14px; font-weight: 700; }

                        .table-container { padding: 0; }
                        table { width: 100%; border-collapse: collapse; }
                        th { text-align: left; padding: 12px 20px; font-size: 11px; font-weight: 700; color: var(--text-light); text-transform: uppercase; background: #fff; border-bottom: 1px solid var(--border); }
                        td { padding: 12px 20px; font-size: 13px; border-bottom: 1px solid #f1f5f9; color: var(--text-main); }
                        tr:last-child td { border-bottom: none; }
                        
                        .badge { 
                            padding: 2px 8px; 
                            background: var(--primary-light); 
                            color: var(--primary); 
                            border-radius: 4px; 
                            font-size: 11px; 
                            font-weight: 700; 
                        }
                        
                        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; }
                        .empty-state { padding: 30px; color: var(--text-light); font-style: italic; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }

                        .footer { 
                            margin-top: 60px; 
                            padding-top: 30px; 
                            border-top: 1px solid var(--border); 
                            text-align: center; 
                            font-size: 12px; 
                            color: var(--text-light); 
                        }

                        @media print {
                            body { padding: 0; }
                            .stat-card, .account-card, .analytics-grid { break-inside: avoid; }
                            @page { margin: 20mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="brand">
                            <div class="logo-circle">V</div>
                            <div class="brand-name">Vridhi</div>
                        </div>
                        <div class="report-info">
                            <div class="report-month">${currentMonth}</div>
                            <div class="report-date">Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                    </div>

                    <div class="summary-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Income</div>
                            <div class="stat-value text-success">${currencySymbol}${globalTotalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Total Spent</div>
                            <div class="stat-value text-danger">${currencySymbol}${globalTotalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Net Savings</div>
                            <div class="stat-value text-primary">${currencySymbol}${globalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Savings Rate</div>
                            <div class="stat-value">${savingsRate}%</div>
                        </div>
                    </div>

                    <div class="section-header">
                        <span>Analytics & Spending Breakdown</span>
                    </div>

                    <div class="analytics-grid">
                        <div class="chart-container">
                            ${pieChartSvg || '<div class="empty-state">No spending data</div>'}
                            <div class="legend">
                                ${legendHtml}
                            </div>
                        </div>
                        <div class="budget-list">
                            <div style="font-size: 12px; font-weight: 700; color: var(--text-light); text-transform: uppercase; margin-bottom: 10px;">Budget Performance</div>
                            ${budgetAnalyticsHtml || '<div class="empty-state">No budget goals set</div>'}
                        </div>
                    </div>

                    <div class="section-header">
                        <span>Account-Wise Breakdown</span>
                    </div>
                    
                    ${accountsHtml}

                    <div class="footer">
                        <strong>Vridhi Budget App</strong> — Secure & Private Personal Finance<br/>
                        This report was generated locally on your device. No financial data ever leaves your phone.<br/>
                        &copy; ${new Date().getFullYear()} Vridhi App.
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (e) {
            Alert.alert("Error", "Failed to generate dynamic PDF report");
            console.error(e);
        }
    };

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
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.headerTitle}>Analytics</Text>
                            <View style={styles.monthTag}>
                                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                                <Text style={styles.monthTagText}>{currentMonth}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF}>
                            <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.exportBtnText}>Export PDF</Text>
                        </TouchableOpacity>
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
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: COLORS.primaryLight,
    },
    exportBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
        marginLeft: 6,
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
