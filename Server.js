const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const dbPool = require('D:/passwordManagerRz/Backend/Config/Database.js');
const nodemailer = require('nodemailer');
const cors = require('cors'); // Importa la librería cors
const app = express();
app.use(express.static('public'));
const path = require('path');
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave_super_secreta';

// Configuración del transportador de correo electrónico
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.use(cors({
    origin: 'http://127.0.0.1:5500' // Permite las peticiones desde tu frontend
}));
app.use(express.json());
app.use(express.json());

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public' ,'Frontend', 'reset-password.html')); // Ajusta la ruta
});

// 🔑 Middleware de autenticación para proteger rutas
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// 📝 Middlewares de validación para registro y login
const validateRegistration = [
    body('username').notEmpty().withMessage('El nombre de usuario es requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('email').optional().isEmail().withMessage('Formato de correo electrónico inválido'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ validationErrors: errors.array() });
        }
        next();
    }
];

const validateLogin = [
    body('username').notEmpty().withMessage('El nombre de usuario es requerido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// 🔓 Ruta pública para prueba (sin autenticación)
app.get('/api/public', (req, res) => {
    res.json({ message: 'Esta es una ruta pública.' });
});

// 🔐 Ruta protegida para prueba (requiere autenticación)
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Esta es una ruta protegida.', userId: req.user.userId });
});

// 🧾 Ruta para registro de usuarios
app.post('/api/register', validateRegistration, async (req, res) => {
    const { username, password, email } = req.body;
    let connection;

    try {
        connection = await dbPool.getConnection();

        let query = 'SELECT id FROM users WHERE username = ?';
        let params = [username];

        if (email) {
            query += ' OR email = ?';
            params.push(email);
        }

        const [existingUsers] = await connection.execute(query, params);

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'El nombre de usuario o el correo electrónico ya están registrados' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await connection.execute(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email]
        );

        return res.status(201).json({ message: 'Usuario registrado exitosamente', userId: result.insertId });

    } catch (error) {
        console.error('Error durante el registro:', error);
        return res.status(500).json({ message: 'Ocurrió un error interno. Intenta más tarde.' });
    } finally {
        if (connection) connection.release();
    }
});

// 🔐 Ruta para login
app.post('/api/login', validateLogin, async (req, res) => {
    const { username, password } = req.body;
    let connection;

    try {
        connection = await dbPool.getConnection();

        const [users] = await connection.execute(
            'SELECT id, password_hash, email FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (passwordMatch) {
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
            return res.status(200).json({ message: 'Inicio de sesión exitoso', token, userId: user.id, email: user.email });
        } else {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

    } catch (error) {
        console.error('Error durante el inicio de sesión:', error);
        return res.status(500).json({ message: 'Ocurrió un error interno. Intenta más tarde.' });
    } finally {
        if (connection) connection.release();
    }
});

// 📬 Ruta para solicitar el restablecimiento de contraseña
app.post('/api/forgot-password', [
    body('email').isEmail().withMessage('Formato de correo electrónico inválido')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    let connection;

    try {
        connection = await dbPool.getConnection();

        const [users] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'No se encontró ningún usuario con ese correo electrónico.' });
        }

        const userId = users[0].id;

        // Eliminar tokens de restablecimiento expirados existentes para este usuario
        await connection.execute(
            'DELETE FROM password_reset_tokens WHERE user_id = ? AND expiry_date <= NOW()',
            [userId]
        );

        const resetToken = uuidv4();
        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + 1);

        await connection.execute(
            'INSERT INTO password_reset_tokens (user_id, token, expiry_date) VALUES (?, ?, ?)',
            [userId, resetToken, expiryTime]
        );

        const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset for your RzPasswordManager',
            html: `<p>Hello,</p>
                <p>You are receiving this email because you requested a password reset for your account.</p>
                <p>Please click on the following link to reset your password:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>This link is valid for 1 hour.</p>
                <p>If you did not request this password reset, you can ignore this email.</p>
                <p>Regards,</p>
                <p>The RzPasswordManager Team</p>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error al enviar el correo electrónico:', error);
                return res.status(500).json({ message: 'Ocurrió un error al enviar el correo electrónico de restablecimiento.' });
            } else {
                console.log('Correo electrónico enviado:', info.response);
                return res.status(200).json({ message: 'Se ha enviado un enlace de restablecimiento a tu correo electrónico.' });
            }
        });

    } catch (error) {
        console.error('Error al solicitar restablecimiento de contraseña:', error);
        return res.status(500).json({ message: 'Ocurrió un error al procesar tu solicitud.' });
    } finally {
        if (connection) connection.release();
    }
});

// 🔄 Ruta para restablecer la contraseña
app.post('/api/reset-password', [
    body('token').notEmpty().withMessage('El token es requerido'),
    body('newPassword').isLength({ min: 8, max: 20 }).withMessage('La nueva contraseña debe tener entre 8 y 20 caracteres'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Las contraseñas no coinciden');
        }
        return true;
    }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;
    let connection;

    try {
        connection = await dbPool.getConnection();

        const [resetTokenData] = await connection.execute(
            'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expiry_date > NOW()',
            [token]
        );

        if (resetTokenData.length === 0) {
            return res.status(400).json({ message: 'El enlace de restablecimiento es inválido o ha expirado.' });
        }

        const userId = resetTokenData[0].user_id;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await connection.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        await connection.execute(
            'DELETE FROM password_reset_tokens WHERE token = ?',
            [token]
        );

        return res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });

    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        return res.status(500).json({ message: 'Ocurrió un error al procesar tu solicitud.' });
    } finally {
        if (connection) connection.release();
    }
});

// 🔐 Rutas protegidas para la gestión de contraseñas
app.get('/api/passwords', authenticateToken, async (req, res) => { /* ... */ });
app.post('/api/passwords', authenticateToken, [/* ... */], async (req, res) => { /* ... */ });
app.put('/api/passwords/:id', authenticateToken, [/* ... */], async (req, res) => { /* ... */ });
app.delete('/api/passwords/:id', authenticateToken, async (req, res) => { /* ... */ });

// 🟢 Escuchar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});