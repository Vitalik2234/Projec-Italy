const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const express = require("express");
const multer = require("multer");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

program
    .option('-h, --host <address>')
    .option('-p, --port <number>', 'Port number', parseInt)
    .option('-c, --cache <path>');

program.parse();
const options = program.opts();

// Парсери тіла запиту
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Для PUT /notes/:noteName приймаємо plain text
app.use('/notes/:noteName', express.text());

app.use('/', express.static('public'));

// Swagger конфігурація
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Notes API',
            version: '1.0.0',
            description: 'Сервіс для зберігання нотаток'
        },
    },
    apis: ['./main.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /notes/{noteName}:
 *   get:
 *     summary: Отримати вміст однієї нотатки
 *     parameters:
 *       - in: path
 *         name: noteName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Успішне отримання нотатки
 *       404:
 *         description: Нотатку не знайдено
 */
app.get('/notes/:noteName', (req, res) => {
    const notePath = path.join(options.cache, `${req.params.noteName}.txt`);

    if (!fs.existsSync(notePath)) {
        return res.status(404).send();
    }

    const noteContent = fs.readFileSync(notePath, 'utf8');
    res.send(noteContent);
});

/**
 * @swagger
 * /notes/{noteName}:
 *   put:
 *     summary: Редагувати нотатку
 *     parameters:
 *       - in: path
 *         name: noteName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: Нотатку оновлено
 *       404:
 *         description: Нотатку не знайдено
 */
app.put('/notes/:noteName', (req, res) => {
    const notePath = path.join(options.cache, `${req.params.noteName}.txt`);

    if (!fs.existsSync(notePath)) {
        return res.status(404).send();
    }

    if (typeof req.body !== 'string') {
        return res.status(400).send('Invalid request body');
    }

    try {
        fs.writeFileSync(notePath, req.body);
        res.status(200).send();
    } catch (err) {
        console.error(" Error writing note:", err);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * @swagger
 * /notes/{noteName}:
 *   delete:
 *     summary: Видалити нотатку
 *     parameters:
 *       - in: path
 *         name: noteName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Нотатку видалено
 *       404:
 *         description: Нотатку не знайдено
 */
app.delete('/notes/:noteName', (req, res) => {
    const notePath = path.join(options.cache, `${req.params.noteName}.txt`);

    if (!fs.existsSync(notePath)) {
        return res.status(404).send();
    }
    fs.unlinkSync(notePath);
    res.status(200).send();
});

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Отримати список усіх нотаток
 *     responses:
 *       200:
 *         description: Список нотаток
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   text:
 *                     type: string
 */
app.get('/notes', (req, res) => {
    const notes = fs.readdirSync(options.cache)
        .filter((name) => name.endsWith('.txt'))
        .map((file) => {
            const noteName = file.replace('.txt', '');
            const noteText = fs.readFileSync(path.join(options.cache, file), 'utf8');
            return { name: noteName, text: noteText };
        });
    res.status(200).json(notes);
});

/**
 * @swagger
 * /write:
 *   post:
 *     summary: Створити нову нотатку
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               note_name:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Нотатку створено
 *       400:
 *         description: Нотатка з таким іменем вже існує або пропущені дані
 */
app.post('/write', multer().none(), (req, res) => {
    const name = req.body.note_name;
    const note = req.body.note;

    if (!name || !note) {
        console.error(" Missing fields in POST /write:", req.body);
        return res.status(400).send('Missing note_name or note');
    }

    const filePath = path.join(options.cache, `${name}.txt`);
    if (fs.existsSync(filePath)) {
        return res.status(400).send('Note already exists');
    }

    try {
        fs.writeFileSync(filePath, note);
        res.status(201).send();
    } catch (err) {
        console.error(" Error writing note:", err);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(options.port, options.host, () => {
    console.log(` Server running at http://${options.host}:${options.port}`);
});





