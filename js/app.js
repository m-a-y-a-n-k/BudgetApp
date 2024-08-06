class UI {
  constructor() {
    this.budgetFeedback = document.querySelector(".budget-feedback");
    this.expenseFeedback = document.querySelector(".expense-feedback");
    this.budgetForm = document.getElementById("budget-form");
    this.budgetInput = document.getElementById("budget-input");
    this.budgetAmount = document.getElementById("budget-amount");
    this.expenseAmount = document.getElementById("expense-amount");
    this.balance = document.getElementById("balance");
    this.balanceAmount = document.getElementById("balance-amount");
    this.expenseForm = document.getElementById("expense-form");
    this.expenseInput = document.getElementById("expense-input");
    this.amountInput = document.getElementById("amount-input");
    this.expenseList = document.getElementById("expense-list");
    this.itemList = [];
    this.itemID = 0;
  }

  // submit budget method
  submitBudgetForm() {
    const value = this.budgetInput.value;
    if (value === "" || value < 0) {
      this.showFeedback(
        this.budgetFeedback,
        "Value cannot be empty or negative"
      );
    } else {
      this.budgetAmount.textContent = value;
      this.budgetInput.value = "";
      this.showBalance();
    }
  }

  // show feedback
  showFeedback(element, message) {
    element.classList.add("showItem");
    element.innerHTML = `<p>${message}</p>`;
    setTimeout(() => element.classList.remove("showItem"), 2500);
  }

  // show balance
  showBalance() {
    const expense = this.totalExpense();
    const total = parseInt(this.budgetAmount.textContent) - expense;
    this.balanceAmount.textContent = total;
    this.updateBalanceColor(total);
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
    this.expenseAmount.textContent = total;
    return total;
  }

  // submit expense form
  submitExpenseForm() {
    const expense = this.expenseInput.value;
    const amount = this.amountInput.value;

    if (expense === "" || amount === "" || amount < 0) {
      this.showFeedback(
        this.expenseFeedback,
        "Values cannot be empty or negative"
      );
    } else {
      const expns = {
        id: this.itemID++,
        title: expense,
        amount: parseInt(amount),
      };
      this.itemList.push(expns);
      this.addExpense(expns);
      this.showBalance();
      this.clearExpenseInputs();
    }
  }

  // clear expense inputs
  clearExpenseInputs() {
    this.expenseInput.value = "";
    this.amountInput.value = "";
  }

  // add expense
  addExpense(expense) {
    const div = document.createElement("div");
    div.classList.add("expense");
    div.innerHTML = `
      <div class="expense-item d-flex justify-content-between align-items-baseline">
        <h6 class="expense-title mb-0 text-uppercase list-item">- ${expense.title}</h6>
        <h5 class="expense-amount mb-0 list-item">${expense.amount}</h5>
        <div class="expense-icons list-item">
          <a href="#" class="edit-icon mx-2" data-id="${expense.id}">
            <i class="fas fa-edit"></i>
          </a>
          <a href="#" class="delete-icon" data-id="${expense.id}">
            <i class="fas fa-trash"></i>
          </a>
        </div>
      </div>`;
    this.expenseList.appendChild(div);
  }

  // edit expense
  editExpense(element) {
    const id = parseInt(element.dataset.id);
    const expense = this.itemList.find((item) => item.id === id);
    this.removeExpenseElement(element);
    this.itemList = this.itemList.filter((item) => item.id !== id);
    this.showBalance();
    this.expenseInput.value = expense.title;
    this.amountInput.value = expense.amount;
  }

  // delete expense
  deleteExpense(element) {
    this.editExpense(element);
    this.clearExpenseInputs();
  }

  // remove expense element
  removeExpenseElement(element) {
    const parent = element.closest(".expense");
    this.expenseList.removeChild(parent);
  }
}

// event listeners
function eventListeners() {
  const ui = new UI();

  document.getElementById("budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    ui.submitBudgetForm();
  });

  document
    .getElementById("expense-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      ui.submitExpenseForm();
    });

  document.getElementById("expense-list").addEventListener("click", (event) => {
    if (event.target.parentElement.classList.contains("edit-icon")) {
      ui.editExpense(event.target.parentElement);
      ui.showFeedback(ui.expenseFeedback, "Edit your expense here");
    } else if (event.target.parentElement.classList.contains("delete-icon")) {
      ui.deleteExpense(event.target.parentElement);
    }
  });
}

document.addEventListener("DOMContentLoaded", eventListeners);
