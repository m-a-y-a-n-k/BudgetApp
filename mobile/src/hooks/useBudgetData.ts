import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppStorage, formatMonthKey, DEFAULT_CATEGORIES } from '../storage';
import { BudgetState, Expense, UseBudgetDataReturn, AccountData, MonthData } from '../types';

export function useBudgetData(): UseBudgetDataReturn {
  const [state, setState] = useState<BudgetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(formatMonthKey(new Date()));

  // Reload data
  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await AppStorage.load();
    setState(data);
    setCurrentMonth(data.currentMonth || formatMonthKey(new Date()));
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save helper
  const saveState = useCallback(async (newState: BudgetState) => {
    setState(newState);
    await AppStorage.save(newState);
  }, []);

  // Helper to initialize a month with data from nearest previous month
  const getInitializedMonth = useCallback((state: BudgetState, targetMonth: string): MonthData => {
    const existingMonth = state.months[targetMonth];
    if (existingMonth) return existingMonth;

    // Find the latest month that is chronologically before targetMonth
    const monthKeys = Object.keys(state.months).sort();
    const prevMonthKey = monthKeys.filter(k => k < targetMonth).reverse()[0];
    
    // Fallback to currentMonth if it's before targetMonth, otherwise use defaults
    const sourceMonthKey = prevMonthKey || (state.currentMonth < targetMonth ? state.currentMonth : null);
    const sourceData = sourceMonthKey ? state.months[sourceMonthKey] : null;

    const newMonth: MonthData = {
        nextExpenseId: 1,
        accounts: {}
    };

    state.accounts.forEach(acct => {
        const id = String(acct.id);
        const prevData = sourceData?.accounts[id];
        newMonth.accounts[id] = {
            income: prevData?.income || 0,
            expenses: [],
            categoryBudgets: prevData?.categoryBudgets ? { ...prevData.categoryBudgets } : {}
        };
    });

    return newMonth;
  }, []);

  // Actions
  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'value'>, acctId?: number) => {
    if (!state) return;
    
    const monthKey = currentMonth;
    const newState = { ...state };
    
    if (!newState.months[monthKey]) {
      newState.months[monthKey] = getInitializedMonth(newState, monthKey);
    }

    const monthData = { 
        ...newState.months[monthKey],
        accounts: { ...newState.months[monthKey].accounts }
    };
    
    let targetAcctId = acctId;
    if (!targetAcctId) {
        targetAcctId = newState.activeAccountId === 'all' ? newState.accounts[0].id : newState.activeAccountId as number;
    }
    
    const acctData = monthData.accounts[String(targetAcctId)] 
        ? { ...monthData.accounts[String(targetAcctId)], expenses: [...monthData.accounts[String(targetAcctId)].expenses] }
        : { income: 0, expenses: [], categoryBudgets: {} };

    const newExp: Expense = {
      ...expense,
      id: monthData.nextExpenseId++,
      value: expense.amount,
      amount: expense.amount
    };

    acctData.expenses.push(newExp);
    monthData.accounts[String(targetAcctId)] = acctData;
    newState.months = { ...newState.months, [monthKey]: monthData };
    
    await saveState(newState);
  }, [state, currentMonth, saveState, getInitializedMonth]);

  const deleteExpense = useCallback(async (id: number, acctId: number) => {
       if (!state) return;
       const newState = { ...state };
       const monthKey = currentMonth;
       const monthData = newState.months[monthKey];
       if (!monthData || !monthData.accounts[String(acctId)]) return;
       
       const newMonthData = {
           ...monthData,
           accounts: {
               ...monthData.accounts,
               [String(acctId)]: {
                   ...monthData.accounts[String(acctId)],
                   expenses: monthData.accounts[String(acctId)].expenses.filter(e => e.id !== id)
               }
           }
       };

       newState.months = { ...newState.months, [monthKey]: newMonthData };
       await saveState(newState);
  }, [state, currentMonth, saveState]);

  const setCurrency = useCallback(async (currency: string) => {
      if (!state) return;
      const newState = { ...state, currency };
      await saveState(newState);
  }, [state, saveState]);
  
  const setIncome = useCallback(async (amount: number, acctId?: number) => {
      if (!state) return;
      const newState = { ...state };
      const monthKey = currentMonth;
      
      let targetAcctId = acctId;
      if (!targetAcctId) {
          targetAcctId = (newState.activeAccountId === 'all' || !newState.activeAccountId) 
            ? (newState.accounts.find(a => !a.archived)?.id || newState.accounts[0].id) 
            : newState.activeAccountId as number;
      }
      const acctIdStr = String(targetAcctId);

      // Ensure target month exists
      if (!newState.months[monthKey]) {
          newState.months[monthKey] = getInitializedMonth(newState, monthKey);
      }

      // Propagate income change to target month and ALL Chronologically Future Months
      const futureMonthKeys = Object.keys(newState.months).filter(k => k >= monthKey);
      
      const updatedMonths = { ...newState.months };
      futureMonthKeys.forEach(mk => {
          const mData = { ...updatedMonths[mk] };
          const accs = { ...mData.accounts };
          accs[acctIdStr] = {
              ...(accs[acctIdStr] || { income: 0, expenses: [], categoryBudgets: {} }),
              income: amount
          };
          mData.accounts = accs;
          updatedMonths[mk] = mData;
      });

      newState.months = updatedMonths;
      await saveState(newState);
  }, [state, currentMonth, saveState, getInitializedMonth]);

  const addCategory = useCallback(async (name: string, acctId?: number) => {
      if (!state) return;
      const targetId = acctId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId as number);
      
      const newState = { 
          ...state,
          accounts: state.accounts.map(acct => {
              if (acct.id === targetId && !acct.categories.includes(name)) {
                  return { ...acct, categories: [...acct.categories, name] };
              }
              return acct;
          })
      };
      
      if (newState.accounts !== state.accounts) {
          await saveState(newState);
      }
  }, [state, saveState]);
  
  const deleteCategory = useCallback(async (name: string, acctId?: number) => {
       if (!state) return;
       const targetId = acctId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId as number);
       
       const newState = { 
           ...state,
           accounts: state.accounts.map(acct => {
               if (acct.id === targetId) {
                   return { ...acct, categories: acct.categories.filter(c => c !== name) };
               }
               return acct;
           })
       };
       await saveState(newState);
  }, [state, saveState]);
  
  const setCategoryBudget = useCallback(async (category: string, amount: number, acctId?: number) => {
       if (!state) return;
       const targetId = acctId || (state.activeAccountId === 'all' ? state.accounts[0].id : state.activeAccountId as number);
       const monthKey = currentMonth;
       const acctIdStr = String(targetId);
       
       const newState = { ...state };
       if (!newState.months[monthKey]) {
           newState.months[monthKey] = getInitializedMonth(newState, monthKey);
       }
       
       // Propagate budget change to target month and ALL Chronologically Future Months
       const futureMonthKeys = Object.keys(newState.months).filter(k => k >= monthKey);
       const updatedMonths = { ...newState.months };

       futureMonthKeys.forEach(mk => {
            const mData = { ...updatedMonths[mk] };
            const accs = { ...mData.accounts };
            const acctData = accs[acctIdStr] 
                ? { ...accs[acctIdStr], categoryBudgets: { ...accs[acctIdStr].categoryBudgets } }
                : { income: 0, expenses: [], categoryBudgets: {} };
            
            if (!isNaN(amount) && amount > 0) {
                acctData.categoryBudgets[category] = amount;
            } else {
                delete acctData.categoryBudgets[category];
            }
            
            accs[acctIdStr] = acctData;
            mData.accounts = accs;
            updatedMonths[mk] = mData;
       });

       newState.months = updatedMonths;
       await saveState(newState);
  }, [state, currentMonth, saveState, getInitializedMonth]);

  const editExpense = useCallback(async (id: number, acctId: number, updatedExpense: Partial<Expense>) => {
      if (!state) return;
      const monthKey = currentMonth;
      const monthData = state.months[monthKey];
      if (!monthData || !monthData.accounts[String(acctId)]) return;
      
      const newState = { ...state };
      const newMonthData = {
          ...monthData,
          accounts: { ...monthData.accounts }
      };
      
      const acctData = {
          ...newMonthData.accounts[String(acctId)],
          expenses: [...newMonthData.accounts[String(acctId)].expenses]
      };
      
      const expenseIndex = acctData.expenses.findIndex(e => e.id === id);
      if (expenseIndex !== -1) {
          acctData.expenses[expenseIndex] = {
              ...acctData.expenses[expenseIndex],
              ...updatedExpense,
              amount: updatedExpense.amount !== undefined ? updatedExpense.amount : acctData.expenses[expenseIndex].amount
          };
          newMonthData.accounts[String(acctId)] = acctData;
          newState.months = { ...newState.months, [monthKey]: newMonthData };
          await saveState(newState);
      }
  }, [state, currentMonth, saveState]);

  const addAccount = useCallback(async (name: string, type: string) => {
      if (!state) return;
      const newId = Math.max(...state.accounts.map(a => a.id), 0) + 1;
      const newAccount = {
          id: newId,
          name,
          type,
          archived: false,
          createdAt: Date.now(),
          categories: [...DEFAULT_CATEGORIES]
      };
      
      const newState = { 
          ...state, 
          accounts: [...state.accounts, newAccount],
          months: { ...state.months }
      };
      
      Object.keys(newState.months).forEach(monthKey => {
          newState.months[monthKey] = {
              ...newState.months[monthKey],
              accounts: {
                  ...newState.months[monthKey].accounts,
                  [String(newId)]: { income: 0, expenses: [], categoryBudgets: {} }
              }
          };
      });
      
      await saveState(newState);
  }, [state, saveState]);

  const renameAccount = useCallback(async (id: number, newName: string) => {
      if (!state) return;
      const newState = { 
          ...state,
          accounts: state.accounts.map(acct => acct.id === id ? { ...acct, name: newName } : acct)
      };
      await saveState(newState);
  }, [state, saveState]);

  const archiveAccount = useCallback(async (id: number, archived: boolean) => {
      if (!state) return;
      const newState = { 
          ...state,
          accounts: state.accounts.map(acct => acct.id === id ? { ...acct, archived } : acct)
      };
      await saveState(newState);
  }, [state, saveState]);

  const changeMonth = useCallback(async (monthKey: string) => {
      if (!state) return;
      const newState = { ...state, currentMonth: monthKey };
      
      if (!newState.months[monthKey]) {
          newState.months[monthKey] = getInitializedMonth(newState, monthKey);
      }
      
      await saveState(newState);
      setCurrentMonth(monthKey);
  }, [state, saveState, getInitializedMonth]);

  const switchAccount = useCallback(async (acctId: number | 'all') => {
      if (!state) return;
      const newState = { ...state, activeAccountId: acctId };
      await saveState(newState);
  }, [state, saveState]);

  const exportData = useCallback(async () => {
      if (!state) return null;
      return JSON.stringify(state, null, 2);
  }, [state]);

  const resetMonth = useCallback(async () => {
      if (!state) return;
      const newState = { ...state };
      const monthKey = currentMonth;
      const monthData = newState.months[monthKey];
      if (monthData) {
          const newAccounts: { [acctId: string]: AccountData } = {};
          Object.keys(monthData.accounts).forEach(acctId => {
              newAccounts[acctId] = { income: 0, expenses: [], categoryBudgets: {} };
          });
          newState.months = {
              ...newState.months,
              [monthKey]: {
                  ...monthData,
                  nextExpenseId: 1,
                  accounts: newAccounts
              }
          };
          await saveState(newState);
      }
  }, [state, currentMonth, saveState]);

  const actions = useMemo(() => ({
      addExpense,
      editExpense,
      deleteExpense,
      setCurrency,
      setIncome,
      addCategory,
      deleteCategory,
      setCategoryBudget,
      addAccount,
      renameAccount,
      archiveAccount,
      changeMonth,
      switchAccount,
      exportData,
      resetMonth,
      loadData,
      setCurrentMonth
  }), [
      addExpense,
      editExpense,
      deleteExpense,
      setCurrency,
      setIncome,
      addCategory,
      deleteCategory,
      setCategoryBudget,
      addAccount,
      renameAccount,
      archiveAccount,
      changeMonth,
      switchAccount,
      exportData,
      resetMonth,
      loadData
  ]);

  return {
    state,
    loading,
    currentMonth,
    actions
  };
}
