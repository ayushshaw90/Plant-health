const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

// Initialize Express and create an HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve the static HTML file
app.use(express.static('public'));

// Set up SQLite database
const db = new sqlite3.Database('mydb.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL,
        humidity REAL,
        soil_moisture1 REAL,
        soil_moisture2 REAL,
        soil_moisture3 REAL,
        timestamp DATETIME
    )`);
});

// MQTT setup
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com'); // Use your broker URL here

mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('esp32/sensorData'); // Subscribe to a topic
});

mqttClient.on('message', (topic, message) => {
    console.log(`MQTT message received from topic "${topic}": ${message.toString()}`);
    try {
        const data = JSON.parse(message.toString());
        const { temperature, humidity, soil_moisture1, soil_moisture2, soil_moisture3 } = data;
        
        // Get the current timestamp
        const timestamp = new Date().toISOString(); // Store in ISO format

        // Insert data along with timestamp into the SQLite database
        db.run(
            `INSERT INTO sensor_data (temperature, humidity, soil_moisture1, soil_moisture2, soil_moisture3, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
            [temperature, humidity, soil_moisture1, soil_moisture2, soil_moisture3, timestamp],
            (err) => {
                if (err) {
                    return console.error('Error inserting data:', err.message);
                }
                console.log('Data inserted into database');
            }
        );

        // Broadcast the message to all connected web clients via Socket.IO, including the timestamp
        io.emit('mqttMessage', { ...data, timestamp });
    } catch (error) {
        console.error('Error parsing MQTT message:', error);
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Retrieve the last 30 entries from the database and send them to the client
    db.all(`SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 3
    
    0`, (err, rows) => {
        if (err) {
            return console.error('Error retrieving data:', err.message);
        }
        // Send the last 30 entries in chronological order
        socket.emit('initialData', rows.reverse());
    });

    // Send live data to the client as it arrives
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Define an API endpoint to retrieve the last 6 responses
app.get('/api/last-6-entries', (req, res) => {
    db.all(`SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 6`, (err, rows) => {
        if (err) {
            console.error('Error retrieving data:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data' });
        } else {
            res.json(rows.reverse()); // Send data in chronological order
        }
    });
});

// Define an API endpoint to retrieve data within a date range
app.get('/api/entries-in-range', (req, res) => {
    const { start, end } = req.query;

    db.all(
        `SELECT * FROM sensor_data WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC`,
        [start, end],
        (err, rows) => {
            if (err) {
                console.error('Error retrieving data:', err.message);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

// Start the server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
