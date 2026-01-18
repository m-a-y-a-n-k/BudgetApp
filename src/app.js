const STORAGE_KEY = "budgetapp:data:v1";

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
      return { version: 1, currentMonth: formatMonthKey(new Date()), months: {} };
    }
    const parsed = safeParseJSON(raw);
    if (!parsed || parsed.version !== 1) {
      return { version: 1, currentMonth: formatMonthKey(new Date()), months: {} };
    }
    if (!parsed.months) parsed.months = {};
    if (!parsed.currentMonth) parsed.currentMonth = formatMonthKey(new Date());
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
    this.searchInput = document.getElementById("search-input");
    this.filterCategory = document.getElementById("filter-category");
    this.sortBy = document.getElementById("sort-by");
    this.exportBtn = document.getElementById("export-json");
    this.resetMonthBtn = document.getElementById("reset-month");

    this.itemList = [];
    this.itemID = 0;
    this.isEditing = false;
    this.editingId = null;
    this.expenseMode = document.getElementById("expense-mode");
    this.expenseCancelBtn = document.getElementById("expense-cancel");

    // defaults
    if (this.dateInput && !this.dateInput.value) this.dateInput.value = todayISO();
    if (this.monthSelect) this.monthSelect.value = this.currentMonth;

    this.ensureMonthInitialized(this.currentMonth);
    this.hydrateFromState(this.currentMonth);
  }

  ensureMonthInitialized(monthKey) {
    if (!this.state.months[monthKey]) {
      // If new month, carry recurring expenses from previous month (best-effort)
      const prevKey = this.findPreviousMonthKey(monthKey);
      const prev = prevKey ? this.state.months[prevKey] : null;
      const carried = prev?.expenses
        ? prev.expenses
            .filter((e) => e.recurring)
            .map((e) => ({
              ...e,
              id: null, // re-assigned
              date: `${monthKey}-01`,
            }))
        : [];

      // assign new ids
      let nextId = 0;
      if (prev?.expenses?.length) {
        nextId =
          Math.max(...prev.expenses.map((e) => (typeof e.id === "number" ? e.id : 0))) +
          1;
      }
      const expenses = carried.map((e) => ({ ...e, id: nextId++ }));
      this.state.months[monthKey] = { income: 0, expenses };
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
    const month = this.state.months[monthKey];
    const income = Number.parseFloat(month?.income) || 0;
    this.budgetAmount.textContent = income ? income.toFixed(2) : "0";

    this.itemList = Array.isArray(month?.expenses) ? month.expenses : [];
    this.itemID =
      this.itemList.length > 0
        ? Math.max(...this.itemList.map((e) => (typeof e.id === "number" ? e.id : 0))) + 1
        : 0;

    this.refreshExpenseList();
    this.showBalance();
    this.renderCategoryTotals();
  }

  persistMonth() {
    const month = this.state.months[this.currentMonth];
    month.income = Number.parseFloat(this.budgetAmount.textContent) || 0;
    month.expenses = this.itemList;
    this.storage.save(this.state);
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
    const income = Number.parseFloat(this.budgetAmount.textContent) || 0;
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
    const total = this.itemList.reduce((acc, curr) => acc + curr.amount, 0);
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
      if (this.isEditing && this.editingId !== null) {
        const existing = this.itemList.find((item) => item.id === this.editingId);
        if (existing) {
          existing.title = expense.trim();
          existing.amount = amount;
          existing.category = category;
          existing.date = date;
          existing.recurring = recurring;
          this.refreshExpenseList();
        }
        this.exitEditMode();
      } else {
        const expns = {
          id: this.itemID++,
          title: expense.trim(),
          amount,
          category,
          date,
          recurring,
        };
        this.itemList.push(expns);
        this.addExpense(expns);
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
    let items = [...this.itemList];

    const q = (this.searchInput?.value || "").trim().toLowerCase();
    if (q) {
      items = items.filter((e) => {
        const title = (e.title || "").toLowerCase();
        const category = (e.category || "").toLowerCase();
        return title.includes(q) || category.includes(q);
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
    const expense = this.itemList.find((item) => item.id === id);
    if (!expense) return;
    this.expenseInput.value = expense.title;
    this.amountInput.value = expense.amount;
    if (this.categoryInput) this.categoryInput.value = expense.category || "Other";
    if (this.dateInput) this.dateInput.value = expense.date || todayISO();
    if (this.recurringInput) this.recurringInput.checked = Boolean(expense.recurring);
    this.enterEditMode(expense);
    this.expenseInput.focus();
  }

  // delete expense
  deleteExpense(element) {
    const id = parseInt(element.dataset.id);
    this.itemList = this.itemList.filter((item) => item.id !== id);
    this.removeExpenseElement(element);
    this.showBalance();
    this.persistMonth();
    this.renderCategoryTotals();
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
    for (const e of this.itemList) {
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
      ui.state.months[ui.currentMonth] = { income: 0, expenses: [] };
      ui.storage.save(ui.state);
      ui.hydrateFromState(ui.currentMonth);
      ui.showFeedback(ui.expenseFeedback, "Month reset.");
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
}

document.addEventListener("DOMContentLoaded", eventListeners);

