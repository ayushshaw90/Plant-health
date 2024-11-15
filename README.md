# Plant-health


## To run code in esp32
Add the file `ESP32-code/full-code.ino` to arduino IDE and run it in ESP32


## To install the modules and run the code
```bash
cd mqtt-node
npm install
node server.js
```


## Webapp-description

Node server uses mqtt to get data from the sensors.
It uses websockets to communicate with the front-end to send live data to the chart.
For chart, we use Charts.js
