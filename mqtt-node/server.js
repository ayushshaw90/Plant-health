const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const webpush = require('web-push');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(bodyParser.json());

// VAPID keys for Web Push
const vapidKeys = {
    publicKey: 'BK8kkHi6PeNeeIB1NkyZv-U96j60cHlaEW-0Aq2NqJFLWtHCLoA14Rr_vYTxAE8i4TROvgJRddUnB7yUsFC4SU8',
    privateKey: 'WwUr8hkJK171W78Bh5_0MLpa5r11oRKcBcAAjqZLVGY'
};

webpush.setVapidDetails(
    'mailto:ayushshaw127@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Store client subscriptions
let subscriptions = [];

// Add a route for client subscriptions
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({ message: 'Subscription received!' });
});

// SQLite setup
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
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe(['esp32/temperature', 'esp32/humidity', 'esp32/soil1', 'esp32/soil2', 'esp32/soil3']);
});

mqttClient.on('message', (topic, message) => {
    console.log(`MQTT message from "${topic}": ${message.toString()}`);
    const timestamp = new Date().toISOString();
    const value = parseFloat(message.toString());

    let column;
    if (topic === 'esp32/temperature') column = 'temperature';
    else if (topic === 'esp32/humidity') column = 'humidity';
    else if (topic === 'esp32/soil1') column = 'soil_moisture1';
    else if (topic === 'esp32/soil2') column = 'soil_moisture2';
    else if (topic === 'esp32/soil3') column = 'soil_moisture3';
    console.log(`Column-name: ${column}`)
    if (column) {
        db.run(`INSERT INTO sensor_data (${column}, timestamp) VALUES (?, ?)`, [value, timestamp], (err) => {
            if (err) return console.error('Error inserting data:', err.message);
            console.log('Data inserted');
        });

        // Emit real-time data via Socket.IO
        io.emit(`${column}`, { [column]: value, timestamp });

        // Send notification if temperature exceeds threshold
        if (column === 'temperature' && value > 40) sendTemperatureAlert(value);
    }
});

// Function to send push notification
const sendTemperatureAlert = (temperature) => {
    const payload = JSON.stringify({
        title: 'Temperature Alert!',
        body: `Temperature exceeded 40°C! Current: ${temperature}°C`
    });

    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(error => console.error('Push Error:', error));
    });
};

// Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send last 30 entries for each sensor
    const sendInitialData = (query, event) => {
        db.all(query, (err, rows) => {
            if (err) return console.error(`Error fetching data:`, err.message);
            socket.emit(event, rows.reverse());
        });
    };

    sendInitialData(`SELECT temperature, timestamp FROM sensor_data WHERE temperature IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialTemperatureData');
    sendInitialData(`SELECT humidity, timestamp FROM sensor_data WHERE humidity IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialHumidityData');
    sendInitialData(`SELECT soil_moisture1, timestamp FROM sensor_data WHERE soil_moisture1 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture1Data');
    sendInitialData(`SELECT soil_moisture2, timestamp FROM sensor_data WHERE soil_moisture2 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture2Data');
    sendInitialData(`SELECT soil_moisture3, timestamp FROM sensor_data WHERE soil_moisture3 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture3Data');

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
