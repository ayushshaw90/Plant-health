# Plant-health-monitoring-system-using-MQTT


![Node.js](https://img.shields.io/badge/Node.js-374151?style=for-the-badge&logo=node.js&logoColor=61DA0B)
![CSS3](https://img.shields.io/badge/CSS-334151?style=for-the-badge&logo=css3&logoColor=green)
![HTML](https://img.shields.io/badge/HTML-334151?style=for-the-badge&logo=html5&logoColor=facc15)
![Javascript](https://img.shields.io/badge/JavaScript-334151?style=for-the-badge&logo=javascript&logoColor=fb923c)
![MQTT](https://img.shields.io/badge/MQTT-334151?style=for-the-badge&logo=mqtt&logoColor=f0123c)
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
