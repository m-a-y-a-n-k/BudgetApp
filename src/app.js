const STORAGE_KEY = "budgetapp:data:v1";
const CURRENT_VERSION = 2;
const ALL_ACCOUNTS = "all";

function formatMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

class AppStorage {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        version: CURRENT_VERSION,
        currentMonth: formatMonthKey(new Date()),
        activeAccountId: 1,
        accounts: [
          {
            id: 1,
            name: "Main",
            type: "Checking",
            archived: false,
            createdAt: Date.now(),
          },
        ],
        months: {},
      };
    }
    const parsed = safeParseJSON(raw);
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) {
      return {
        version: CURRENT_VERSION,
        currentMonth: formatMonthKey(new Date()),
        activeAccountId: 1,
        accounts: [
          {
            id: 1,
            name: "Main",
            type: "Checking",
            archived: false,
            createdAt: Date.now(),
          },
        ],
        months: {},
      };
    }

    if (parsed.version === 1) {
      return migrateV1ToV2(parsed);
    }

    // v2 normalize
    if (!parsed.months) parsed.months = {};
    if (!parsed.currentMonth) parsed.currentMonth = formatMonthKey(new Date());
    if (!Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
      parsed.accounts = [
        {
          id: 1,
          name: "Main",
          type: "Checking",
          archived: false,
          createdAt: Date.now(),
        },
      ];
    }
    if (parsed.activeAccountId !== ALL_ACCOUNTS && typeof parsed.activeAccountId !== "number") {
      parsed.activeAccountId = parsed.accounts[0].id;
    }
    parsed.version = CURRENT_VERSION;
    return parsed;
  }

  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

class UI {
  constructor() {
    this.storage = new AppStorage();
    this.state = this.storage.load();
    this.currentMonth = this.state.currentMonth;

    this.activeAccountId =
      typeof this.state.activeAccountId === "number" ? this.state.activeAccountId : 1;

    this.budgetFeedback = document.querySelector(".budget-feedback");
    this.expenseFeedback = document.querySelector(".expense-feedback");
    this.budgetForm = document.getElementById("budget-form");
    this.budgetInput = document.getElementById("budget-input");
    this.budgetAmount = document.getElementById("budget-amount");
    this.expenseAmount = document.getElementById("expense-amount");
    this.balance = document.getElementById("balance");
    this.balanceAmount = document.getElementById("balance-amount");
    this.savingsRateAmount = document.getElementById("savings-rate-amount");
    this.expenseForm = document.getElementById("expense-form");
    this.expenseInput = document.getElementById("expense-input");
    this.amountInput = document.getElementById("amount-input");
    this.categoryInput = document.getElementById("category-input");
    this.dateInput = document.getElementById("date-input");
    this.recurringInput = document.getElementById("recurring-input");
    this.expenseList = document.getElementById("expense-list");
    this.expenseEmptyState = document.getElementById("expense-empty");
    this.categoryTotalsEl = document.getElementById("category-totals");
    this.monthSelect = document.getElementById("month-select");
    this.accountSelect = document.getElementById("account-select");
    this.manageAccountsBtn = document.getElementById("manage-accounts");
    this.accountsPanel = document.getElementById("accounts-panel");
    this.closeAccountsBtn = document.getElementById("close-accounts");
    this.accountForm = document.getElementById("account-form");
    this.accountNameInput = document.getElementById("account-name-input");
    this.accountTypeInput = document.getElementById("account-type-input");
    this.accountsList = document.getElementById("accounts-list");
    this.searchInput = document.getElementById("search-input");
    this.filterCategory = document.getElementById("filter-category");
    this.sortBy = document.getElementById("sort-by");
    this.exportBtn = document.getElementById("export-json");
    this.resetMonthBtn = document.getElementById("reset-month");
    this.expenseAccountInput = document.getElementById("expense-account-input");

    this.itemList = [];
    this.itemID = 0;
    this.isEditing = false;
    this.editingId = null;
    this.expenseMode = document.getElementById("expense-mode");
    this.expenseCancelBtn = document.getElementById("expense-cancel");

    // defaults
    if (this.dateInput && !this.dateInput.value) this.dateInput.value = todayISO();
    if (this.monthSelect) this.monthSelect.value = this.currentMonth;
    this.ensureAccountBasics();
    this.rebuildAccountSelects();

    this.ensureMonthInitialized(this.currentMonth);
    this.hydrateFromState(this.currentMonth);
  }

  ensureAccountBasics() {
    if (!Array.isArray(this.state.accounts) || this.state.accounts.length === 0) {
      this.state.accounts = [
        { id: 1, name: "Main", type: "Checking", archived: false, createdAt: Date.now() },
      ];
    }
    const ids = new Set(this.state.accounts.map((a) => a.id));
    if (
      this.state.activeAccountId !== ALL_ACCOUNTS &&
      (!Number.isFinite(Number(this.state.activeAccountId)) ||
        !ids.has(Number(this.state.activeAccountId)))
    ) {
      this.activeAccountId = this.state.accounts[0].id;
      this.state.activeAccountId = this.activeAccountId;
      this.storage.save(this.state);
    }
  }

  rebuildAccountSelects() {
    this.rebuildAccountSelect();
    this.rebuildExpenseAccountSelect();
  }

  rebuildAccountSelect() {
    if (!this.accountSelect) return;
    const sel = this.accountSelect;
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = ALL_ACCOUNTS;
    optAll.textContent = "All accounts";
    sel.appendChild(optAll);

    for (const acct of this.state.accounts) {
      const opt = document.createElement("option");
      opt.value = String(acct.id);
      opt.textContent = acct.archived ? `${acct.name} (${acct.type}) — archived` : `${acct.name} (${acct.type})`;
      if (acct.archived) opt.disabled = false; // still selectable for viewing history
      sel.appendChild(opt);
    }

    const desired =
      this.state.activeAccountId === ALL_ACCOUNTS
        ? ALL_ACCOUNTS
        : String(this.state.activeAccountId ?? this.activeAccountId);
    sel.value = desired;
  }

  rebuildExpenseAccountSelect() {
    if (!this.expenseAccountInput) return;
    const sel = this.expenseAccountInput;
    sel.innerHTML = "";
    for (const acct of this.state.accounts) {
      const opt = document.createElement("option");
      opt.value = String(acct.id);
      opt.textContent = `${acct.name} (${acct.type})`;
      if (acct.archived) opt.disabled = true;
      sel.appendChild(opt);
    }
    const fallback = this.state.accounts.find((a) => !a.archived)?.id ?? this.state.accounts[0].id;
    sel.value = String(
      this.state.activeAccountId === ALL_ACCOUNTS ? fallback : this.state.activeAccountId
    );
  }

  getMonthData(monthKey) {
    return this.state.months[monthKey];
  }

  ensureMonthShapeV2(monthKey) {
    const m = this.state.months[monthKey];
    if (!m) return;
    if (!m.accounts) {
      // Shouldn't happen after migration, but keep resilient.
      const income = Number.parseFloat(m.income) || 0;
      const expenses = Array.isArray(m.expenses) ? m.expenses : [];
      this.state.months[monthKey] = {
        nextExpenseId:
          expenses.length > 0
            ? Math.max(...expenses.map((e) => (typeof e.id === "number" ? e.id : 0))) + 1
            : 0,
        accounts: {
          1: {
            income,
            expenses: expenses.map((e) => ({ ...e, accountId: 1 })),
          },
        },
      };
    }
  }

  ensureMonthInitialized(monthKey) {
    if (!this.state.months[monthKey]) {
      // If new month, carry recurring expenses from previous month (best-effort), per account
      const prevKey = this.findPreviousMonthKey(monthKey);
      const prev = prevKey ? this.state.months[prevKey] : null;
      if (prev) this.ensureMonthShapeV2(prevKey);

      let nextId = 0;
      if (prev?.accounts) {
        for (const acctId of Object.keys(prev.accounts)) {
          const ex = prev.accounts[acctId]?.expenses || [];
          for (const e of ex) nextId = Math.max(nextId, typeof e.id === "number" ? e.id + 1 : 0);
        }
      }

      const accounts = {};
      for (const acct of this.state.accounts) {
        const prevAcct = prev?.accounts?.[String(acct.id)];
        const carried = Array.isArray(prevAcct?.expenses)
          ? prevAcct.expenses
              .filter((e) => e.recurring)
              .map((e) => ({
                ...e,
                id: nextId++,
                accountId: acct.id,
                date: `${monthKey}-01`,
              }))
          : [];
        accounts[String(acct.id)] = { income: 0, expenses: carried };
      }

      this.state.months[monthKey] = { nextExpenseId: nextId, accounts };
    }
    // For existing months, ensure we have account buckets for any newly-added accounts.
    this.ensureMonthShapeV2(monthKey);
    const month = this.state.months[monthKey];
    month.accounts = month.accounts || {};
    for (const acct of this.state.accounts) {
      if (!month.accounts[String(acct.id)]) month.accounts[String(acct.id)] = { income: 0, expenses: [] };
    }
    this.state.currentMonth = monthKey;
    this.currentMonth = monthKey;
    this.storage.save(this.state);
  }

  findPreviousMonthKey(monthKey) {
    const [yStr, mStr] = monthKey.split("-");
    const y = Number.parseInt(yStr);
    const m = Number.parseInt(mStr);
    if (Number.isNaN(y) || Number.isNaN(m)) return null;
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() - 1);
    return formatMonthKey(d);
  }

  hydrateFromState(monthKey) {
    this.ensureMonthShapeV2(monthKey);
    const month = this.state.months[monthKey];
    const viewId =
      this.state.activeAccountId === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number(this.state.activeAccountId);

    const income = this.getIncomeForView(month, viewId);
    this.budgetAmount.textContent = income ? income.toFixed(2) : "0";

    this.itemID = typeof month?.nextExpenseId === "number" ? month.nextExpenseId : 0;

    this.refreshExpenseList();
    this.showBalance();
    this.renderCategoryTotals();
  }

  persistMonth() {
    this.storage.save(this.state);
  }

  getIncomeForView(month, viewId) {
    if (!month?.accounts) return 0;
    if (viewId === ALL_ACCOUNTS) {
      return Object.values(month.accounts).reduce(
        (acc, a) => acc + (Number.parseFloat(a?.income) || 0),
        0
      );
    }
    const a = month.accounts[String(viewId)];
    return Number.parseFloat(a?.income) || 0;
  }

  getExpensesForView(month, viewId) {
    if (!month?.accounts) return [];
    if (viewId === ALL_ACCOUNTS) {
      const out = [];
      for (const [acctId, data] of Object.entries(month.accounts)) {
        const acctNum = Number(acctId);
        const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
        for (const e of expenses) out.push({ ...e, accountId: e.accountId ?? acctNum });
      }
      return out;
    }
    const expenses = month.accounts[String(viewId)]?.expenses;
    return Array.isArray(expenses) ? expenses.map((e) => ({ ...e, accountId: e.accountId ?? viewId })) : [];
  }

  findExpenseById(id) {
    const month = this.state.months[this.currentMonth];
    if (!month?.accounts) return null;
    for (const [acctId, data] of Object.entries(month.accounts)) {
      const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
      const idx = expenses.findIndex((e) => e.id === id);
      if (idx !== -1) return { acctId: Number(acctId), idx, expense: expenses[idx] };
    }
    return null;
  }

  getAccountLabel(accountId) {
    const acct = this.state.accounts.find((a) => a.id === accountId);
    if (!acct) return `Account ${accountId}`;
    return acct.archived ? `${acct.name} (archived)` : acct.name;
  }

  // submit budget method
  submitBudgetForm() {
    const raw = this.budgetInput.value;
    const value = Number.parseFloat(raw);
    if (raw === "" || Number.isNaN(value) || value < 0) {
      this.showFeedback(
        this.budgetFeedback,
        "Value cannot be empty or negative"
      );
    } else {
      if (this.state.activeAccountId === ALL_ACCOUNTS) {
        this.showFeedback(this.budgetFeedback, "Select an account to set income.");
        return;
      }
      const acctId = Number(this.state.activeAccountId);
      const month = this.state.months[this.currentMonth];
      this.ensureMonthShapeV2(this.currentMonth);
      if (!month.accounts[String(acctId)]) month.accounts[String(acctId)] = { income: 0, expenses: [] };
      month.accounts[String(acctId)].income = value;
      this.budgetAmount.textContent = value.toFixed(2);
      this.budgetInput.value = "";
      this.showBalance();
      this.persistMonth();
    }
  }

  // show feedback
  showFeedback(element, message) {
    element.classList.add("showItem");
    element.textContent = message;
    setTimeout(() => element.classList.remove("showItem"), 2500);
  }

  // show balance
  showBalance() {
    const expense = this.totalExpense();
    const month = this.state.months[this.currentMonth];
    const viewId =
      this.state.activeAccountId === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number(this.state.activeAccountId);
    const income = this.getIncomeForView(month, viewId);
    const total = income - expense;
    this.balanceAmount.textContent = total;
    this.updateBalanceColor(total);
    this.showSavingsRate(income, expense);
  }

  // show savings rate
  showSavingsRate(income, expense) {
    if (!this.savingsRateAmount) return;
    if (!income || income <= 0) {
      this.savingsRateAmount.textContent = "—";
      return;
    }
    const rate = ((income - expense) / income) * 100;
    const clamped = Math.max(-999, Math.min(999, rate));
    this.savingsRateAmount.textContent = clamped.toFixed(1);
  }

  // update balance color
  updateBalanceColor(total) {
    this.balance.classList.remove("showGreen", "showBlack", "showRed");
    if (total < 0) {
      this.balance.classList.add("showRed");
    } else if (total === 0) {
      this.balance.classList.add("showBlack");
    } else {
      this.balance.classList.add("showGreen");
    }
  }

  // total expense
  totalExpense() {
    const month = this.state.months[this.currentMonth];
    const viewId =
      this.state.activeAccountId === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number(this.state.activeAccountId);
    const items = this.getExpensesForView(month, viewId);
    const total = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    this.expenseAmount.textContent = total.toFixed(2);
    this.updateEmptyState();
    return total;
  }

  updateEmptyState() {
    if (!this.expenseEmptyState) return;
    // Hide empty state only when there are visible rows (after filters/search)
    const visibleCount = this.getVisibleExpenses().length;
    this.expenseEmptyState.hidden = visibleCount > 0;
  }

  // submit expense form
  submitExpenseForm() {
    const expense = this.expenseInput.value;
    const rawAmount = this.amountInput.value;
    const amount = Number.parseFloat(rawAmount);
    const category = this.categoryInput?.value || "Other";
    const date = this.dateInput?.value || todayISO();
    const recurring = Boolean(this.recurringInput?.checked);
    const accountIdRaw = this.expenseAccountInput?.value;
    const accountId = Number.parseInt(accountIdRaw || "", 10);

    if (
      expense.trim() === "" ||
      rawAmount === "" ||
      Number.isNaN(amount) ||
      amount < 0 ||
      !date
    ) {
      this.showFeedback(
        this.expenseFeedback,
        "Values cannot be empty or negative"
      );
    } else {
      if (!Number.isFinite(accountId)) {
        this.showFeedback(this.expenseFeedback, "Select an account.");
        return;
      }
      this.ensureMonthShapeV2(this.currentMonth);
      const month = this.state.months[this.currentMonth];
      if (!month.accounts[String(accountId)]) month.accounts[String(accountId)] = { income: 0, expenses: [] };

      if (this.isEditing && this.editingId !== null) {
        const found = this.findExpenseById(this.editingId);
        if (found) {
          const { acctId: fromAcctId, idx } = found;
          const fromList = month.accounts[String(fromAcctId)]?.expenses || [];
          const updated = {
            ...fromList[idx],
            title: expense.trim(),
            amount,
            category,
            date,
            recurring,
            accountId,
          };
          if (fromAcctId === accountId) {
            fromList[idx] = updated;
          } else {
            fromList.splice(idx, 1);
            month.accounts[String(accountId)].expenses.push(updated);
          }
          this.refreshExpenseList();
          this.renderAccountsPanel();
        }
        this.exitEditMode();
      } else {
        const expns = {
          id: month.nextExpenseId++,
          title: expense.trim(),
          amount,
          category,
          date,
          recurring,
          accountId,
        };
        month.accounts[String(accountId)].expenses.push(expns);
        this.addExpense(expns);
        this.renderAccountsPanel();
      }
      this.showBalance();
      this.clearExpenseInputs();
      this.persistMonth();
      this.renderCategoryTotals();
    }
  }

  // clear expense inputs
  clearExpenseInputs() {
    this.expenseInput.value = "";
    this.amountInput.value = "";
    if (this.categoryInput) this.categoryInput.value = "Other";
    if (this.dateInput) this.dateInput.value = todayISO();
    if (this.recurringInput) this.recurringInput.checked = false;
    if (this.expenseAccountInput) {
      const fallback = this.state.accounts.find((a) => !a.archived)?.id ?? this.state.accounts[0].id;
      this.expenseAccountInput.value = String(
        this.state.activeAccountId === ALL_ACCOUNTS ? fallback : this.state.activeAccountId
      );
    }
  }

  enterEditMode(expense) {
    this.isEditing = true;
    this.editingId = expense.id;
    if (this.expenseMode) this.expenseMode.textContent = "Editing";
    if (this.expenseCancelBtn) this.expenseCancelBtn.hidden = false;
    const submitBtn = document.getElementById("expense-submit");
    if (submitBtn) submitBtn.textContent = "Save changes";
  }

  exitEditMode() {
    this.isEditing = false;
    this.editingId = null;
    if (this.expenseMode) this.expenseMode.textContent = "Adding";
    if (this.expenseCancelBtn) this.expenseCancelBtn.hidden = true;
    const submitBtn = document.getElementById("expense-submit");
    if (submitBtn) submitBtn.textContent = "Add expense";
  }

  refreshExpenseList() {
    // Keep the header row + empty state, remove rendered expenses
    const existing = this.expenseList.querySelectorAll(".expense");
    existing.forEach((node) => node.remove());
    this.getVisibleExpenses().forEach((item) => this.addExpense(item));
    this.updateEmptyState();
  }

  getVisibleExpenses() {
    const month = this.state.months[this.currentMonth];
    const viewId =
      this.state.activeAccountId === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number(this.state.activeAccountId);
    let items = this.getExpensesForView(month, viewId);

    const q = (this.searchInput?.value || "").trim().toLowerCase();
    if (q) {
      items = items.filter((e) => {
        const title = (e.title || "").toLowerCase();
        const category = (e.category || "").toLowerCase();
        const acct = this.getAccountLabel(e.accountId || 0).toLowerCase();
        return title.includes(q) || category.includes(q) || acct.includes(q);
      });
    }

    const cat = this.filterCategory?.value || "";
    if (cat) {
      items = items.filter((e) => (e.category || "Other") === cat);
    }

    const sort = this.sortBy?.value || "date_desc";
    const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
    const byAmount = (a, b) => (a.amount || 0) - (b.amount || 0);
    const byTitle = (a, b) => (a.title || "").localeCompare(b.title || "");

    if (sort === "date_asc") items.sort(byDate);
    else if (sort === "date_desc") items.sort((a, b) => byDate(b, a));
    else if (sort === "amount_asc") items.sort(byAmount);
    else if (sort === "amount_desc") items.sort((a, b) => byAmount(b, a));
    else if (sort === "title_asc") items.sort(byTitle);

    return items;
  }

  // add expense
  addExpense(expense) {
    const div = document.createElement("div");
    div.classList.add("expense");
    const expenseItem = document.createElement("div");
    expenseItem.className =
      "expense-item d-flex justify-content-between align-items-baseline";

    const titleElement = document.createElement("h6");
    titleElement.className = "expense-title mb-0 text-uppercase list-item";
    const meta = [];
    if (this.state.activeAccountId === ALL_ACCOUNTS && expense.accountId) {
      meta.push(this.getAccountLabel(expense.accountId));
    }
    if (expense.category) meta.push(expense.category);
    if (expense.date) meta.push(expense.date);
    if (expense.recurring) meta.push("recurring");
    const metaText = meta.length ? ` (${meta.join(" • ")})` : "";
    titleElement.textContent = `- ${expense.title}${metaText}`;

    const amountElement = document.createElement("h5");
    amountElement.className = "expense-amount mb-0 list-item";
    amountElement.textContent = expense.amount.toFixed(2);

    const iconsDiv = document.createElement("div");
    iconsDiv.className = "expense-icons list-item";

    const editLink = document.createElement("a");
    editLink.href = "#";
    editLink.className = "edit-icon mx-2";
    editLink.dataset.id = expense.id;
    editLink.setAttribute("role", "button");
    editLink.setAttribute("aria-label", `Edit ${expense.title}`);
    editLink.title = "Edit";
    editLink.innerHTML = '<i class="fas fa-edit"></i>';

    const deleteLink = document.createElement("a");
    deleteLink.href = "#";
    deleteLink.className = "delete-icon";
    deleteLink.dataset.id = expense.id;
    deleteLink.setAttribute("role", "button");
    deleteLink.setAttribute("aria-label", `Delete ${expense.title}`);
    deleteLink.title = "Delete";
    deleteLink.innerHTML = '<i class="fas fa-trash"></i>';

    iconsDiv.appendChild(editLink);
    iconsDiv.appendChild(deleteLink);

    expenseItem.appendChild(titleElement);
    expenseItem.appendChild(amountElement);
    expenseItem.appendChild(iconsDiv);

    div.appendChild(expenseItem);

    this.expenseList.appendChild(div);
    this.updateEmptyState();
  }

  // edit expense
  editExpense(element) {
    const id = parseInt(element.dataset.id);
    const found = this.findExpenseById(id);
    const expense = found?.expense;
    if (!expense) return;
    this.expenseInput.value = expense.title;
    this.amountInput.value = expense.amount;
    if (this.categoryInput) this.categoryInput.value = expense.category || "Other";
    if (this.dateInput) this.dateInput.value = expense.date || todayISO();
    if (this.recurringInput) this.recurringInput.checked = Boolean(expense.recurring);
    if (this.expenseAccountInput) {
      const acctId = expense.accountId ?? found?.acctId;
      if (acctId) this.expenseAccountInput.value = String(acctId);
    }
    this.enterEditMode(expense);
    this.expenseInput.focus();
  }

  // delete expense
  deleteExpense(element) {
    const id = parseInt(element.dataset.id);
    this.ensureMonthShapeV2(this.currentMonth);
    const month = this.state.months[this.currentMonth];
    const found = this.findExpenseById(id);
    if (!found) return;
    const list = month.accounts[String(found.acctId)]?.expenses || [];
    list.splice(found.idx, 1);
    this.removeExpenseElement(element);
    this.showBalance();
    this.persistMonth();
    this.renderCategoryTotals();
    this.renderAccountsPanel();
    if (this.isEditing && this.editingId === id) {
      this.exitEditMode();
      this.clearExpenseInputs();
    }
  }

  // remove expense element
  removeExpenseElement(element) {
    const parent = element.closest(".expense");
    if (parent) this.expenseList.removeChild(parent);
    this.updateEmptyState();
  }

  renderCategoryTotals() {
    if (!this.categoryTotalsEl) return;
    const totals = new Map();
    const month = this.state.months[this.currentMonth];
    const viewId =
      this.state.activeAccountId === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number(this.state.activeAccountId);
    for (const e of this.getExpensesForView(month, viewId)) {
      const cat = e.category || "Other";
      totals.set(cat, (totals.get(cat) || 0) + (e.amount || 0));
    }
    const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    this.categoryTotalsEl.innerHTML = "";
    if (rows.length === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.textContent = "No category totals yet.";
      this.categoryTotalsEl.appendChild(div);
      return;
    }
    for (const [cat, amt] of rows) {
      const row = document.createElement("div");
      row.className = "category-row d-flex justify-content-between";
      const left = document.createElement("div");
      left.textContent = cat;
      const right = document.createElement("div");
      right.textContent = `$ ${amt.toFixed(2)}`;
      row.appendChild(left);
      row.appendChild(right);
      this.categoryTotalsEl.appendChild(row);
    }
  }

  renderAccountsPanel() {
    if (!this.accountsList) return;
    const month = this.state.months[this.currentMonth];
    this.ensureMonthShapeV2(this.currentMonth);
    this.accountsList.innerHTML = "";

    for (const acct of this.state.accounts) {
      const data = month.accounts?.[String(acct.id)] || { income: 0, expenses: [] };
      const income = Number.parseFloat(data.income) || 0;
      const expense = (data.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);
      const bal = income - expense;

      const row = document.createElement("div");
      row.className = `account-row ${acct.archived ? "is-archived" : ""}`;
      row.dataset.accountId = String(acct.id);

      const top = document.createElement("div");
      top.className = "d-flex justify-content-between align-items-start";

      const left = document.createElement("div");
      const name = document.createElement("div");
      name.className = "account-row__name";
      name.textContent = acct.name;
      const meta = document.createElement("div");
      meta.className = "account-row__meta";
      meta.textContent = `${acct.type}${acct.archived ? " • archived" : ""} • This month: $ ${bal.toFixed(
        2
      )}`;
      left.appendChild(name);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "account-row__actions";
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "btn btn-light btn-sm";
      renameBtn.textContent = "Rename";
      renameBtn.dataset.action = "rename";

      const archiveBtn = document.createElement("button");
      archiveBtn.type = "button";
      archiveBtn.className = "btn btn-outline-secondary btn-sm";
      archiveBtn.textContent = acct.archived ? "Unarchive" : "Archive";
      archiveBtn.dataset.action = "archive";

      actions.appendChild(renameBtn);
      actions.appendChild(archiveBtn);

      top.appendChild(left);
      top.appendChild(actions);
      row.appendChild(top);

      this.accountsList.appendChild(row);
    }
  }
}

function migrateV1ToV2(v1) {
  const defaultAccount = {
    id: 1,
    name: "Main",
    type: "Checking",
    archived: false,
    createdAt: Date.now(),
  };
  const out = {
    version: CURRENT_VERSION,
    currentMonth: v1.currentMonth || formatMonthKey(new Date()),
    activeAccountId: 1,
    accounts: [defaultAccount],
    months: {},
  };
  const months = v1.months || {};
  for (const [monthKey, m] of Object.entries(months)) {
    const income = Number.parseFloat(m?.income) || 0;
    const expenses = Array.isArray(m?.expenses) ? m.expenses : [];
    const nextExpenseId =
      expenses.length > 0
        ? Math.max(...expenses.map((e) => (typeof e.id === "number" ? e.id : 0))) + 1
        : 0;
    out.months[monthKey] = {
      nextExpenseId,
      accounts: {
        1: {
          income,
          expenses: expenses.map((e) => ({ ...e, accountId: 1 })),
        },
      },
    };
  }
  return out;
}

// event listeners
function eventListeners() {
  const ui = new UI();

  document.getElementById("budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    ui.submitBudgetForm();
  });

  document.getElementById("expense-form").addEventListener("submit", (event) => {
    event.preventDefault();
    ui.submitExpenseForm();
  });

  const cancelBtn = document.getElementById("expense-cancel");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      ui.exitEditMode();
      ui.clearExpenseInputs();
    });
  }

  const monthSelect = document.getElementById("month-select");
  if (monthSelect) {
    monthSelect.addEventListener("change", () => {
      const month = monthSelect.value;
      if (!month) return;
      ui.exitEditMode();
      ui.clearExpenseInputs();
      ui.ensureMonthInitialized(month);
      ui.hydrateFromState(month);
      ui.renderAccountsPanel();
    });
  }

  const accountSelect = document.getElementById("account-select");
  if (accountSelect) {
    accountSelect.addEventListener("change", () => {
      const v = accountSelect.value;
      ui.exitEditMode();
      ui.clearExpenseInputs();
      ui.state.activeAccountId = v === ALL_ACCOUNTS ? ALL_ACCOUNTS : Number.parseInt(v, 10);
      ui.storage.save(ui.state);
      ui.rebuildExpenseAccountSelect();
      ui.hydrateFromState(ui.currentMonth);
    });
  }

  const manageBtn = document.getElementById("manage-accounts");
  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      if (!ui.accountsPanel) return;
      ui.accountsPanel.hidden = !ui.accountsPanel.hidden;
      if (!ui.accountsPanel.hidden) ui.renderAccountsPanel();
    });
  }

  const closeAccounts = document.getElementById("close-accounts");
  if (closeAccounts) {
    closeAccounts.addEventListener("click", () => {
      if (ui.accountsPanel) ui.accountsPanel.hidden = true;
    });
  }

  const accountForm = document.getElementById("account-form");
  if (accountForm) {
    accountForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = (ui.accountNameInput?.value || "").trim();
      const type = ui.accountTypeInput?.value || "Checking";
      if (!name) {
        ui.showFeedback(ui.expenseFeedback, "Account name cannot be empty.");
        return;
      }
      const nextId =
        ui.state.accounts.length > 0 ? Math.max(...ui.state.accounts.map((a) => a.id)) + 1 : 1;
      ui.state.accounts.push({ id: nextId, name, type, archived: false, createdAt: Date.now() });
      ui.accountNameInput.value = "";
      ui.storage.save(ui.state);
      ui.rebuildAccountSelects();
      ui.ensureMonthInitialized(ui.currentMonth);
      ui.renderAccountsPanel();
    });
  }

  const accountsList = document.getElementById("accounts-list");
  if (accountsList) {
    accountsList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const row = btn.closest(".account-row");
      const accountId = Number.parseInt(row?.dataset.accountId || "", 10);
      const acct = ui.state.accounts.find((a) => a.id === accountId);
      if (!acct) return;

      const action = btn.dataset.action;
      if (action === "rename") {
        const next = prompt("Rename account", acct.name);
        if (!next) return;
        acct.name = next.trim() || acct.name;
        ui.storage.save(ui.state);
        ui.rebuildAccountSelects();
        ui.renderAccountsPanel();
        ui.refreshExpenseList();
      } else if (action === "archive") {
        // Prevent archiving the last active (non-archived) account.
        if (!acct.archived) {
          const activeCount = ui.state.accounts.filter((a) => !a.archived).length;
          if (activeCount <= 1) {
            ui.showFeedback(ui.expenseFeedback, "You must keep at least one active account.");
            return;
          }
        }
        acct.archived = !acct.archived;
        // If we archived the currently selected account, fall back to "All accounts"
        if (acct.archived && String(ui.state.activeAccountId) === String(acct.id)) {
          ui.state.activeAccountId = ALL_ACCOUNTS;
        }
        ui.storage.save(ui.state);
        ui.rebuildAccountSelects();
        ui.rebuildExpenseAccountSelect();
        ui.renderAccountsPanel();
        ui.hydrateFromState(ui.currentMonth);
      }
    });
  }

  const exportBtn = document.getElementById("export-json");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const data = ui.storage.load();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `budgetapp-${ui.currentMonth}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  const resetMonthBtn = document.getElementById("reset-month");
  if (resetMonthBtn) {
    resetMonthBtn.addEventListener("click", () => {
      const ok = confirm(
        `Reset data for ${ui.currentMonth}? This cannot be undone.`
      );
      if (!ok) return;
      ui.ensureMonthShapeV2(ui.currentMonth);
      const month = ui.state.months[ui.currentMonth];
      month.nextExpenseId = 0;
      month.accounts = month.accounts || {};
      for (const acct of ui.state.accounts) {
        month.accounts[String(acct.id)] = { income: 0, expenses: [] };
      }
      ui.storage.save(ui.state);
      ui.hydrateFromState(ui.currentMonth);
      ui.showFeedback(ui.expenseFeedback, "Month reset.");
      ui.renderAccountsPanel();
    });
  }

  const rerender = () => {
    ui.refreshExpenseList();
    ui.renderCategoryTotals();
    ui.showBalance();
  };
  ui.searchInput?.addEventListener("input", rerender);
  ui.filterCategory?.addEventListener("change", rerender);
  ui.sortBy?.addEventListener("change", rerender);

  document.getElementById("expense-list").addEventListener("click", (event) => {
    const editEl = event.target.closest("a.edit-icon");
    const deleteEl = event.target.closest("a.delete-icon");
    if (editEl) {
      event.preventDefault();
      ui.editExpense(editEl);
      ui.showFeedback(ui.expenseFeedback, "Editing: update fields and save");
    } else if (deleteEl) {
      event.preventDefault();
      ui.deleteExpense(deleteEl);
    }
  });

  ui.updateEmptyState();
  ui.showBalance();
  ui.renderCategoryTotals();
  ui.renderAccountsPanel();
}

document.addEventListener("DOMContentLoaded", eventListeners);

