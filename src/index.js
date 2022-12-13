import chalk from "chalk";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import pkg from "pg";

import extractToObjFormat from "./functions/extractToObjFormat.js";

dotenv.config();

const { Pool } = pkg;

const connection = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const app = express();
app.use(cors());
app.use(express.json());

//CRUD CATEGORIAS
app.post("/categories", async (req, res) => {
    const { name } = req.body;

    if (!name) {
        res.sendStatus(400);
        return;
    }

    const categoryExists = await connection.query(
        `SELECT * FROM categories WHERE name = $1`,
        [name]
    );

    if (categoryExists.rows[0]) {
        res.sendStatus(409);
        return;
    }

    try {
        const category = await connection.query(
            "INSERT INTO categories (name) VALUES ($1)",
            [name]
        );

        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/categories", async (req, res) => {
    try {
        const categories = await connection.query("SELECT * FROM categories;");

        res.send(categories.rows);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

//CRUD JOGOS
app.post("/games", async (req, res) => {
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body;

    const gameExists = await connection.query(
        "SELECT * FROM games WHERE name = $1",
        [name]
    );

    const categoryExists = await connection.query(
        "SELECT * FROM categories WHERE id = $1",
        [categoryId]
    );

    if (
        !name ||
        stockTotal <= 0 ||
        pricePerDay <= 0 ||
        !categoryExists.rows[0]
    ) {
        res.sendStatus(400);
        return;
    }

    if (gameExists.rows[0]) {
        console.log("2 DEU RUIM");
        res.sendStatus(409);
        return;
    }

    try {
        await connection.query(
            `INSERT INTO games
                ("name", "image", "stockTotal", "categoryId", "pricePerDay")
                VALUES ($1, $2, $3, $4, $5)`,
            [name, image, stockTotal, categoryId, pricePerDay]
        );

        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/games", async (req, res) => {
    const { game: filter } = req.query;

    try {
        if (!filter) {
            const games = await connection.query(
                `SELECT
                    games.*, categories.name as "categoryName"
                    FROM games
                    JOIN categories
                    ON games."categoryId"=categories.id`
            );
            res.send(games.rows);
            return;
        }

        const gamesFiltered = await connection.query(
            `SELECT
                    games.*, categories.name as "categoryName"
                    FROM games
                    JOIN categories
                    ON games."categoryId"=categories.id
                    WHERE (games.name) ILIKE ($1)
                    `,
            [`${filter}%`]
        );
        res.send(gamesFiltered.rows);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

//CRUD CLIENTES
app.post("/customers", async (req, res) => {
    const { name, phone, cpf, birthday } = req.body;

    const customerExists = await connection.query(
        `SELECT * FROM customers WHERE cpf=$1`,
        [cpf]
    );

    if (cpf.length !== 11 || phone.length < 10 || !name || !birthday) {
        res.sendStatus(400);
        return;
    }

    if (customerExists.rows[0]) {
        res.sendStatus(409);
        return;
    }

    try {
        await connection.query(
            `
            INSERT INTO customers
                (name, phone, cpf, birthday)
            VALUES ($1, $2, $3, $4)`,
            [name, phone, cpf, birthday]
        );

        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/customers", async (req, res) => {
    const { cpf: filter } = req.query;
    try {
        if (!filter) {
            const customers = await connection.query(`SELECT * FROM customers`);

            res.send(customers.rows);
            return;
        }

        const cpfFiltered = await connection.query(
            `SELECT * FROM customers WHERE cpf LIKE $1`,
            [`${filter}%`]
        );

        res.send(cpfFiltered.rows);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/customers/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const customer = await connection.query(
            `SELECT * FROM customers WHERE id=$1`,
            [id]
        );

        if (!customer.rows[0]) {
            res.sendStatus(404);
            return;
        }

        res.send(customer.rows[0]);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.put("/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, phone, cpf, birthday } = req.body;

    if (cpf.length !== 11 || phone.length < 10 || !name || !birthday) {
        res.sendStatus(400);
        return;
    }

    try {
        const customerExists = await connection.query(
            `SELECT * FROM customers WHERE cpf=$1`,
            [cpf]
        );

        if (customerExists.rows[0]) {
            res.sendStatus(409);
            return;
        }

        await connection.query(
            `UPDATE customers SET name=$1, phone=$2, cpf=$3, birthday=$4 WHERE id=$5`,
            [name, phone, cpf, birthday, id]
        );

        res.sendStatus(200);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

//CRUD ALUGUEIS
app.post("/rentals", async (req, res) => {
    const { customerId, gameId, daysRented } = req.body;

    try {
        const pricePerDay = await connection.query(
            `SELECT "pricePerDay" FROM games WHERE id=$1`,
            [gameId]
        );

        const { rentDate, returnDate, originalPrice, delayFee } = {
            rentDate: dayjs().format("YYYY-MM-DD"),
            originalPrice: daysRented * pricePerDay.rows[0].pricePerDay,
            returnDate: null,
            delayFee: null,
        };

        const rent = await connection.query(
            `
            INSERT INTO rentals
            ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee")
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                customerId,
                gameId,
                rentDate,
                daysRented,
                returnDate,
                originalPrice,
                delayFee,
            ]
        );

        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/rentals", async (req, res) => {
    try {
        const rentals = await connection.query(
            `
            SELECT rentals.*,
            customers.name as "customerName",
            games.name as "gameName"
            FROM rentals 
            JOIN customers
            ON rentals."customerId" = customers.id
            JOIN games
            ON rentals."gameId" = games.id`
        );

        const result = extractToObjFormat(rentals);

        res.send(result);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.post("/rentals/:id/return", async (req, res) => {
    const { id } = req.params;

    try {
        const rental = await connection.query(
            `
            SELECT * FROM rentals
            WHERE id = $1`,
            [id]
        );

        if (rental.rows[0].returnDate) {
            return res.sendStatus(400);
        } else {
            const delay =
                new Date().getTime() - new Date(rental.rentDate).getTime();
            const delayInDays = Math.floor(delay / (24 * 3600 * 1000));

            let delayFee = 0;
            if (delayInDays > rental.daysRented) {
                const addicionalDays = delayInDays - rental.daysRented;
                delayFee = addicionalDays * rental.originalPrice;
                console.log("delayFee", addicionalDays);
            }

            await connection.query(
                `
                UPDATE rentals 
                SET "returnDate" = NOW(), "delayFee" = $1
                WHERE id = $2    
                `,
                [delayFee, id]
            );

            res.sendStatus(200);
        }
    } catch (error) {
        console.log(error);
        res.sendStatus(500); // internal server error
    }
});

app.delete("/rentals/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const rental = await connection.query(
            `
        DELETE * FROM rentals
        WHERE id=$1
        `,
            [id]
        );

        if (!rental.rows[0].id) {
            res.sendStatus(404);
            return;
        }

        if (!rental.rows[0].returnDate !== null) {
            res.sendStatus(400);
            return;
        }

        res.send(rental.rows[0]);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

//CONEXÃO
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(chalk.bold.cyan(`[Listening ON] Port: ${PORT}`));
});
