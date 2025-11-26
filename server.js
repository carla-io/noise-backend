const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', (error) => console.log(error));
db.once('open', () => console.log('Database Connected'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running');
});

app.use('/auth', require('./routes/auth')); // Authentication routes

app.use('/user', require('./routes/user')); // User routes
app.use('/reports', require('./routes/reportRoute')); // Noise report routes



app.listen(5000, () => console.log('Server is running'));
