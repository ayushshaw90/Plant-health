#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// Wi-Fi credentials
const char* ssid = "Orange";
const char* password = "shawayush3";

// HiveMQ public broker details
const char* mqtt_broker = "broker.hivemq.com";
const int mqtt_port = 1883;

// MQTT topics
const char* mqtt_topic = "esp32/sensorData";
const char* temperature_topic = "esp32/temperature";
const char* humidity_topic = "esp32/humidity";
const char* soilMoisture1_topic = "esp32/soil1";
const char* soilMoisture2_topic = "esp32/soil2";
const char* soilMoisture3_topic = "esp32/soil3";

// Soil moisture sensor pins
const int soilMoisturePin1 = 34;
const int soilMoisturePin2 = 35;
const int soilMoisturePin3 = 32;

// DHT11 sensor pin and type
#define DHTPIN 14
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

// Function to connect to Wi-Fi
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
}

// Function to reconnect to MQTT broker
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32Client")) {
      Serial.println("Connected to HiveMQ broker");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(client.state());
      Serial.println(" Try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_broker, mqtt_port);
  dht.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read soil moisture sensor data from all three sensors
  float soilMoisture1 = analogRead(soilMoisturePin1);
  float soilMoisture2 = analogRead(soilMoisturePin2);
  float soilMoisture3 = analogRead(soilMoisturePin3);

  // Scale soil moisture values to percentage (assuming ADC is 12-bit resolution)
  soilMoisture1 = 100-map(soilMoisture1, 0, 4095, 0, 100);
  soilMoisture2 = 100-map(soilMoisture2, 0, 4095, 0, 100);
  soilMoisture3 = 100-map(soilMoisture3, 0, 4095, 0, 100);

  // Read temperature and humidity from DHT11 sensor
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Check if reading failed
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }

  // Create a JSON payload to send multiple data fields
  String payload = "{\"temperature\": " + String(temperature) + 
                   ", \"humidity\": " + String(humidity) + 
                   ", \"soil_moisture1\": " + String(soilMoisture1) + 
                   ", \"soil_moisture2\": " + String(soilMoisture2) + 
                   ", \"soil_moisture3\": " + String(soilMoisture3) + "}";

  // Publish individual sensor data to respective topics
  client.publish(temperature_topic, String(temperature).c_str());
  client.publish(humidity_topic, String(humidity).c_str());
  client.publish(soilMoisture1_topic, String(soilMoisture1).c_str());
  client.publish(soilMoisture2_topic, String(soilMoisture2).c_str());
  client.publish(soilMoisture3_topic, String(soilMoisture3).c_str());

  // Publish the JSON data to the combined topic
  Serial.print("Publishing message: ");
  Serial.println(payload);

  bool success = client.publish(mqtt_topic, payload.c_str());

  if (success) {
    Serial.println("Message published successfully to HiveMQ!");
  } else {
    Serial.println("Failed to publish message to HiveMQ!");
  }

  delay(20000);  // Send data every 20 seconds
}
