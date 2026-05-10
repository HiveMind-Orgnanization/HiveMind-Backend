const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    // Validate input
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    // Store user in database (pseudo code)
    // await db.insertUser({ username, email, passwordHash });
    res.status(201).json({ message: 'User created successfully.' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});