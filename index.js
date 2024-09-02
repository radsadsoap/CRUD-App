var express = require("express");
var app = express();
const PORT = 8080;

let bodyParser = require("body-parser");
let expressSession = require("express-session");

let db = require("./db/database");
const { ObjectId } = require("mongodb");

app.use(
    expressSession({
        secret: "monog@#123",
        resave: true,
        saveUninitialized: true,
    })
);
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    let msg = "";
    if (req.session.msg != undefined && req.session.msg != "") {
        msg = req.session.msg;
    }
    res.redirect("/login");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/loginSubmit", async (req, res) => {
    const users = db.collection("users");

    const existingUser = await users.findOne({ email: req.body.email });
    if (existingUser) {
        if (existingUser.password === req.body.password) {
            req.session.msg = "Logged in successfully";
            req.session.user = {
                name: existingUser.username,
                email: existingUser.email,
            };
            res.redirect("/dashboard");
        } else {
            req.session.msg = "Login failed";
            res.redirect("/login");
        }
    } else {
        const result = await users.insertOne({
            username: req.body.name,
            email: req.body.email,
            password: req.body.password,
        });

        if (result.acknowledged === true) {
            req.session.msg = "Logged in successfully";
            req.session.user = {
                name: req.body.name,
                email: req.body.email,
            };
            res.redirect("/dashboard");
        } else {
            req.session.msg = "Login failed";
            res.redirect("/");
        }
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }
        res.redirect("/");
    });
});

app.get("/dashboard", (req, res) => {
    if (req.session.user) {
        res.render("dashboard", { user: req.session.user });
    } else {
        res.redirect("/login");
    }
});

app.get("/loan", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    try {
        const loans = db.collection("loans");
        const loanList = await loans
            .find({ userEmail: req.session.user.email })
            .toArray();
        res.render("loan", { user: req.session.user, loans: loanList });
    } catch (err) {
        console.error("Error fetching loans:", err);
        req.session.msg = "An error occurred while fetching loans";
        res.render("loan", { user: req.session.user, loans: [] });
    }
});

app.get("/addloan", (req, res) => {
    if (req.session.user) {
        res.render("addloan", { user: req.session.user });
    } else {
        res.redirect("/login");
    }
});

app.post("/addloanSubmit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const loans = db.collection("loans");

    const loan_id = Date.now().toString();

    const interestRates = {
        Personal: 10,
        Home: 7,
        Gold: 8,
        Vehicle: 9,
    };
    const interestRate = interestRates[req.body.loanType] || 10;

    const amount = parseFloat(req.body.amount);
    const months = parseInt(req.body.months);

    const totalInterest = (amount * interestRate * (months / 12)) / 100;

    const r = interestRate / (12 * 100);
    const emi =
        (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    const totalAmount = emi * months;

    const newLoan = {
        userEmail: req.session.user.email,
        loan_id: loan_id,
        loanType: req.body.loanType,
        amount: amount,
        name: req.body.name,
        interestRate: interestRate,
        months: months,
        lender_id: req.body.lender_id,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
    };

    try {
        const result = await loans.insertOne(newLoan);
        if (result.acknowledged) {
            req.session.msg = "Loan added successfully";
            res.redirect("/loan");
        } else {
            req.session.msg = "Failed to add loan";
            res.redirect("/addloan");
        }
    } catch (error) {
        console.error("Error adding loan:", error);
        req.session.msg = "An error occurred while adding the loan";
        res.redirect("/addloan");
    }
});

app.get("/emi", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    try {
        const loans = db.collection("loans");
        const emiCollection = db.collection("emi");

        const loanList = await loans
            .find({ userEmail: req.session.user.email })
            .toArray();

        for (const loan of loanList) {
            const { loan_id, name, amount, interestRate, months } = loan;

            const r = interestRate / (12 * 100);
            const emi =
                (amount * r * Math.pow(1 + r, months)) /
                (Math.pow(1 + r, months) - 1);

            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + 1);

            const emiDoc = {
                loan_id,
                name,
                interestRate,
                dueDate,
                status: "Pending",
                remainingBalance: parseFloat((emi * months).toFixed(2)),
                penalty: 0,
                payment_date: null,
                emi_amount: parseFloat(emi.toFixed(2)),
                userEmail: req.session.user.email,
            };

            await emiCollection.updateOne(
                { loan_id, userEmail: req.session.user.email },
                { $set: emiDoc },
                { upsert: true }
            );
        }
        const emiList = await emiCollection
            .find({ userEmail: req.session.user.email })
            .toArray();

        res.render("emi", { user: req.session.user, emiList });
    } catch (error) {
        console.error("Error processing EMI:", error);
        req.session.msg = "An error occurred while processing EMI";
        res.render("emi", { user: req.session.user, emiList: [] });
    }
});

app.get("/expenses", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    try {
        const expensesCollection = db.collection("expenses");
        const expensesList = await expensesCollection
            .find({ user_id: req.session.user.email })
            .toArray();

        const formattedExpenses = expensesList.map((expense) => ({
            ...expense,
            dateOfPurchase:
                expense.dateOfPurchase instanceof Date
                    ? expense.dateOfPurchase
                    : new Date(expense.dateOfPurchase),
        }));

        res.render("expenses", {
            user: req.session.user,
            expenses: formattedExpenses,
            msg: req.session.msg,
        });
        req.session.msg = "";
    } catch (error) {
        console.error("Error fetching expenses:", error);
        req.session.msg = "An error occurred while fetching expenses";
        res.render("expenses", {
            user: req.session.user,
            expenses: [],
            msg: req.session.msg,
        });
    }
});

app.get("/addExpenses", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    res.render("addExpenses", { user: req.session.user });
});

app.post("/addexpensesSubmit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const expenses = db.collection("expenses");

    try {
        const result = await expenses.insertOne({
            user_id: req.session.user.email, // Add this line to store the user_id
            name: req.body.name,
            category: req.body.categoryType,
            amount: parseFloat(req.body.amount),
            dateOfPurchase: new Date(req.body.dop),
            description: req.body.description,
        });

        if (result.acknowledged) {
            req.session.msg = "Expense added successfully";
            res.redirect("/expenses");
        } else {
            req.session.msg = "Failed to add expense";
            res.redirect("/addExpenses");
        }
    } catch (error) {
        console.error("Error adding expense:", error);
        req.session.msg = "An error occurred while adding the expense";
        res.redirect("/addExpenses");
    }
});

app.get("/editExpenses", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const expenseId = req.query.id;
    const expenses = db.collection("expenses");

    try {
        const expense = await expenses.findOne({
            _id: new ObjectId(expenseId),
            user_id: req.session.user.email,
        });

        if (expense) {
            res.render("editExpenses", {
                user: req.session.user,
                expense: expense,
            });
        } else {
            req.session.msg = "Expense not found";
            res.redirect("/expenses");
        }
    } catch (error) {
        console.error("Error fetching expense for edit:", error);
        req.session.msg = "An error occurred while fetching the expense";
        res.redirect("/expenses");
    }
});

app.get("/deleteExpenses", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const expenseId = req.query.id;
    const expenses = db.collection("expenses");

    try {
        const result = await expenses.deleteOne({
            _id: new ObjectId(expenseId),
            user_id: req.session.user.email,
        });

        if (result.deletedCount === 1) {
            req.session.msg = "Expense deleted successfully";
        } else {
            req.session.msg = "Failed to delete expense";
        }
    } catch (error) {
        console.error("Error deleting expense:", error);
        req.session.msg = "An error occurred while deleting the expense";
    }

    res.redirect("/expenses");
});

app.post("/editExpensesSubmit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const expenses = db.collection("expenses");

    try {
        const dateOfPurchase = new Date(req.body.dop);

        if (isNaN(dateOfPurchase.getTime())) {
            req.session.msg = "Invalid date format";
            return res.redirect("/editExpenses?id=" + req.body.expenseId);
        }

        const result = await expenses.updateOne(
            {
                _id: new ObjectId(req.body.expenseId),
                user_id: req.session.user.email,
            },
            {
                $set: {
                    name: req.body.name,
                    category: req.body.categoryType,
                    amount: parseFloat(req.body.amount),
                    dateOfPurchase: dateOfPurchase, // Store as Date object
                    description: req.body.description,
                },
            }
        );

        if (result.modifiedCount === 1) {
            req.session.msg = "Expense updated successfully";
        } else {
            req.session.msg = "Failed to update expense";
        }
    } catch (error) {
        console.error("Error updating expense:", error);
        req.session.msg = "An error occurred while updating the expense";
    }

    res.redirect("/expenses");
});

app.listen(PORT, () => {
    console.log(`CRUD Server running at http://localhost:${PORT}`);
});
