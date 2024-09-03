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
    res.render("dashboard");
});

app.get("/user", async (req, res) => {
    try {
        const users = await db.collection("users").find().toArray();
        res.render("user", { users, msg: req.query.msg });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching users");
    }
});

app.get("/addUser", (req, res) => {
    res.render("addUser");
});

app.post("/addUserSubmit", async (req, res) => {
    const { username, email, password } = req.body;
    try {
        await db.collection("users").insertOne({
            username,
            email,
            password, // Note: In a real application, you should hash the password
            createdAt: new Date(),
        });
        res.redirect("/user?msg=User added successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding user");
    }
});

app.get("/editUser", async (req, res) => {
    const userId = req.query.id;
    try {
        const user = await db
            .collection("users")
            .findOne({ _id: new ObjectId(userId) });
        res.render("editUser", { editUser: user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching user");
    }
});

app.post("/editUserSubmit", async (req, res) => {
    const { userId, username, email, newPassword } = req.body;
    try {
        const updateData = { username, email };
        if (newPassword) {
            updateData.password = newPassword; // Note: In a real application, you should hash the password
        }
        await db
            .collection("users")
            .updateOne({ _id: new ObjectId(userId) }, { $set: updateData });
        res.redirect("/user?msg=User updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating user");
    }
});

app.get("/deleteUser", async (req, res) => {
    const userId = req.query.id;
    try {
        await db.collection("users").deleteOne({ _id: new ObjectId(userId) });
        res.redirect("/user?msg=User deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting user");
    }
});

app.get("/loan", async (req, res) => {
    try {
        const loans = await db.collection("loans").find().toArray();
        res.render("loan", { loans, msg: req.query.msg });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching loans");
    }
});

app.get("/addLoan", (req, res) => {
    res.render("addLoan");
});

app.post("/addLoanSubmit", async (req, res) => {
    const { name, loanType, amount, months, lender_id } = req.body;
    try {
        const loanId = new ObjectId();
        const interestRate = getInterestRate(loanType);
        const totalAmount = calculateTotalAmount(amount, interestRate, months);

        await db.collection("loans").insertOne({
            _id: loanId,
            loan_id: Date.now().toString(),
            name,
            loanType,
            amount: parseFloat(amount),
            interestRate,
            months: parseInt(months),
            totalAmount,
            lender_id,
        });
        res.redirect("/loan?msg=Loan added successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding loan");
    }
});

app.get("/editLoan", async (req, res) => {
    const loanId = req.query.id;
    try {
        const loan = await db
            .collection("loans")
            .findOne({ _id: new ObjectId(loanId) });
        res.render("editLoan", { editLoan: loan });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching loan");
    }
});

app.post("/editLoanSubmit", async (req, res) => {
    const { loanId, name, loanType, amount, months, lender_id } = req.body;
    try {
        const interestRate = getInterestRate(loanType);
        const totalAmount = calculateTotalAmount(amount, interestRate, months);

        await db.collection("loans").updateOne(
            { _id: new ObjectId(loanId) },
            {
                $set: {
                    name,
                    loanType,
                    amount: parseFloat(amount),
                    interestRate,
                    months: parseInt(months),
                    totalAmount,
                    lender_id,
                },
            }
        );
        res.redirect("/loan?msg=Loan updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating loan");
    }
});

app.get("/deleteLoan", async (req, res) => {
    const loanId = req.query.id;
    try {
        await db.collection("loans").deleteOne({ _id: new ObjectId(loanId) });
        res.redirect("/loan?msg=Loan deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting loan");
    }
});

function getInterestRate(loanType) {
    const rates = {
        Personal: 10,
        Home: 8,
        Gold: 7,
        Vehicle: 9,
    };
    return rates[loanType] || 10;
}

function calculateTotalAmount(principal, rate, months) {
    const r = rate / 100 / 12;
    const n = months;
    const totalAmount =
        ((principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)) * n;
    return parseFloat(totalAmount.toFixed(2));
}

app.get("/expenses", async (req, res) => {
    try {
        const expenses = await db.collection("expenses").find().toArray();
        res.render("expenses", { expenses, msg: req.query.msg });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching expenses");
    }
});

app.get("/addExpenses", (req, res) => {
    res.render("addExpenses");
});

app.post("/addExpensesSubmit", async (req, res) => {
    const { name, amount, dateOfPurchase, description } = req.body;
    try {
        await db.collection("expenses").insertOne({
            name,
            category: req.body.categoryType,
            amount: parseFloat(amount),
            dateOfPurchase: new Date(dateOfPurchase),
            description,
        });
        res.redirect("/expenses?msg=Expense added successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding expense");
    }
});

app.get("/editExpenses", async (req, res) => {
    const expenseId = req.query.id;
    try {
        const expense = await db
            .collection("expenses")
            .findOne({ _id: new ObjectId(expenseId) });
        res.render("editExpenses", { expense: expense });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching expense");
    }
});

app.post("/editExpensesSubmit", async (req, res) => {
    const { expenseId, name, categoryType, amount, dop, description } =
        req.body;
    try {
        await db.collection("expenses").updateOne(
            { _id: new ObjectId(expenseId) },
            {
                $set: {
                    name,
                    category: categoryType,
                    amount: parseFloat(amount),
                    dateOfPurchase: new Date(dop),
                    description,
                },
            }
        );
        res.redirect("/expenses?msg=Expense updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating expense");
    }
});

app.get("/deleteExpenses", async (req, res) => {
    const expenseId = req.query.id;
    try {
        await db
            .collection("expenses")
            .deleteOne({ _id: new ObjectId(expenseId) });
        res.redirect("/expenses?msg=Expense deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting expense");
    }
});

app.get("/emi", async (req, res) => {
    try {
        const emiList = await db.collection("emi").find().toArray();
        res.render("emi", { emiList, msg: req.query.msg });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching EMI records");
    }
});

app.get("/addEmi", (req, res) => {
    res.render("addEmi");
});

app.post("/addEmiSubmit", async (req, res) => {
    const {
        userEmail,
        dueDate,
        emi_amount,
        interestRate,
        remainingBalance,
        status,
        nextPaymentDate,
    } = req.body;
    try {
        await db.collection("emi").insertOne({
            userEmail,
            dueDate: new Date(dueDate),
            emi_amount: parseFloat(emi_amount),
            interestRate: parseFloat(interestRate),
            remainingBalance: parseFloat(remainingBalance),
            status,
            nextPaymentDate: new Date(nextPaymentDate),
            createdAt: new Date(),
        });
        res.redirect("/emi?msg=EMI record added successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error adding EMI record");
    }
});

app.get("/editEmi", async (req, res) => {
    const emiId = req.query.id;
    try {
        const emi = await db
            .collection("emi")
            .findOne({ _id: new ObjectId(emiId) });
        res.render("editEmi", { emi });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching EMI record");
    }
});

app.post("/editEmiSubmit", async (req, res) => {
    const {
        emiId,
        userEmail,
        dueDate,
        emi_amount,
        interestRate,
        remainingBalance,
        status,
        nextPaymentDate,
    } = req.body;
    try {
        await db.collection("emi").updateOne(
            { _id: new ObjectId(emiId) },
            {
                $set: {
                    userEmail,
                    dueDate: new Date(dueDate),
                    emi_amount: parseFloat(emi_amount),
                    interestRate: parseFloat(interestRate),
                    remainingBalance: parseFloat(remainingBalance),
                    status,
                    nextPaymentDate: new Date(nextPaymentDate),
                    updatedAt: new Date(),
                },
            }
        );
        res.redirect("/emi?msg=EMI record updated successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating EMI record");
    }
});

app.get("/deleteEmi", async (req, res) => {
    const emiId = req.query.id;
    try {
        await db.collection("emi").deleteOne({ _id: new ObjectId(emiId) });
        res.redirect("/emi?msg=EMI record deleted successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting EMI record");
    }
});

app.listen(PORT, () => {
    console.log(`CRUD Server running at http://localhost:${PORT}`);
});
