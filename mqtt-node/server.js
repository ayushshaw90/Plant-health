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
    publicKey: 'BF8lUY6R8JV5NxJh6nQyJ4C4MTMYaelyj1E_WDHJZuJyArrkuSK3Y2latYwky3DaSmN9_oJS-wXuUPvo_fCXomc',
    privateKey: 'KDjsTlaPwhIyJOyldG-ybcDgeiS8WHND8hJP7kRzrEk>'
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
    mqttClient.subscribe(['esp32/temperature', 'esp32/humidity', 'esp32/soil1', 'esp32/soil2', 'esp32/soil3', 'esp32/sensorData']);
});

mqttClient.on('message', (topic, message) => {
    console.log(`MQTT message from "${topic}": ${message.toString()}`);
    const timestamp = new Date().toISOString();

    let data;
    try {
        data = (topic === 'esp32/sensorData') ? JSON.parse(message) : { [topic.split('/')[1]]: parseFloat(message), timestamp };
        const { temperature = null, humidity = null, soil_moisture1 = null, soil_moisture2 = null, soil_moisture3 = null } = data;

        // Insert into database
        db.run(`INSERT INTO sensor_data (temperature, humidity, soil_moisture1, soil_moisture2, soil_moisture3, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
            [temperature, humidity, soil_moisture1, soil_moisture2, soil_moisture3, timestamp], (err) => {
                if (err) return console.error('Error inserting data:', err.message);
                console.log('Data inserted');
            });

        // Real-time data via Socket.IO
        if (temperature) io.emit('temperatureData', { temperature, timestamp });
        if (humidity) io.emit('humidityData', { humidity, timestamp });
        if (soil_moisture1) io.emit('soilMoisture1Data', { soil_moisture1, timestamp });
        if (soil_moisture2) io.emit('soilMoisture2Data', { soil_moisture2, timestamp });
        if (soil_moisture3) io.emit('soilMoisture3Data', { soil_moisture3, timestamp });

        // Send notification if temperature exceeds threshold
        if (temperature > 40) sendTemperatureAlert(temperature);
    } catch (error) {
        console.error('Error parsing MQTT message:', error);
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
