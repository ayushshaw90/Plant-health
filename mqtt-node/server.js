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
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('esp32/temperature');
    mqttClient.subscribe('esp32/humidity');
    mqttClient.subscribe('esp32/soil1');
    mqttClient.subscribe('esp32/soil2');
    mqttClient.subscribe('esp32/soil3');
    mqttClient.subscribe('esp32/sensorData'); // Combined topic
});

mqttClient.on('message', (topic, message) => {
    console.log(`MQTT message received from topic "${topic}": ${message.toString()}`);
    const timestamp = new Date().toISOString();

    try {
        let data;

        // Parse JSON from the combined topic or handle individual topics
        if (topic === 'esp32/sensorData') {
            data = JSON.parse(message.toString());
        } else {
            data = {};
            data.timestamp = timestamp;

            // Assign values based on the topic
            if (topic === 'esp32/temperature') data.temperature = parseFloat(message);
            if (topic === 'esp32/humidity') data.humidity = parseFloat(message);
            if (topic === 'esp32/soil1') data.soil_moisture1 = parseFloat(message);
            if (topic === 'esp32/soil2') data.soil_moisture2 = parseFloat(message);
            if (topic === 'esp32/soil3') data.soil_moisture3 = parseFloat(message);
        }

        const { temperature = null, humidity = null, soil_moisture1 = null, soil_moisture2 = null, soil_moisture3 = null } = data;

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

        // Broadcast real-time data to specific Socket.IO channels based on the sensor
        if (topic === 'esp32/temperature') {
            io.emit('temperatureData', { temperature, timestamp });
        } else if (topic === 'esp32/humidity') {
            io.emit('humidityData', { humidity, timestamp });
        } else if (topic === 'esp32/soil1') {
            io.emit('soilMoisture1Data', { soil_moisture1, timestamp });
        } else if (topic === 'esp32/soil2') {
            io.emit('soilMoisture2Data', { soil_moisture2, timestamp });
        } else if (topic === 'esp32/soil3') {
            io.emit('soilMoisture3Data', { soil_moisture3, timestamp });
        }
    } catch (error) {
        console.error('Error parsing MQTT message:', error);
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Retrieve the last 30 entries for each sensor and send them to the client
    const sendInitialData = (sensor, query, event) => {
        db.all(query, (err, rows) => {
            if (err) {
                return console.error(`Error retrieving ${sensor} data:`, err.message);
            }
            // Send data in chronological order
            socket.emit(event, rows.reverse());
        });
    };

    sendInitialData('temperature', `SELECT temperature, timestamp FROM sensor_data WHERE temperature IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialTemperatureData');
    sendInitialData('humidity', `SELECT humidity, timestamp FROM sensor_data WHERE humidity IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialHumidityData');
    sendInitialData('soil1', `SELECT soil_moisture1, timestamp FROM sensor_data WHERE soil_moisture1 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture1Data');
    sendInitialData('soil2', `SELECT soil_moisture2, timestamp FROM sensor_data WHERE soil_moisture2 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture2Data');
    sendInitialData('soil3', `SELECT soil_moisture3, timestamp FROM sensor_data WHERE soil_moisture3 IS NOT NULL ORDER BY timestamp DESC LIMIT 30`, 'initialSoilMoisture3Data');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
