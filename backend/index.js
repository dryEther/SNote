require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { DATA_ROOT, USERS_ROOT } = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));
app.use(cookieParser());

// CORS setup
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:80",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/folders'));
app.use('/files', require('./routes/files'));
app.use('/', require('./routes/tree'));
app.use('/download', require('./routes/download'));
app.use('/', require('./routes/config'));
app.use('/', require('./routes/ai'));
app.use('/', require('./routes/export'));

// Health & root
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ message: "Server is running fine 🚀" }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Backend Server running on port', PORT));
