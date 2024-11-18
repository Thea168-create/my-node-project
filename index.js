// Required Modules
const express = require('express');
const ModbusRTU = require('modbus-serial');
const app = express();

// Environment Variables and Defaults
const PORT = process.env.PORT || 3000;
const RTU_IP = process.env.RTU_IP || '192.168.1.100';
const RTU_PORT = process.env.RTU_PORT || 502;

// Setup Express Server
app.get('/', (req, res) => {
    res.send('Hello, Node.js is working! RTU polling service is also running.');
});

// Start Web Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Setup Modbus RTU Client
const client = new ModbusRTU();

// Connect to RTU
client.connectTCP(RTU_IP, { port: RTU_PORT }, () => {
    console.log(`Connected to RTU at ${RTU_IP}:${RTU_PORT}`);

    // Set Modbus Slave ID
    client.setID(1);

    // Poll AIN0 Data Periodically
    setInterval(() => {
        client.readInputRegisters(0, 2) // Read AIN0 and AIN1
            .then(data => {
                const ain0 = data.data[0] / 100; // Scale by 100
                const ain1 = data.data[1] / 100; // Scale by 100
                console.log(`AIN0: ${ain0}, AIN1: ${ain1}`);
            })
            .catch(err => console.error('Error reading AIN:', err));
    }, 5000); // Poll every 5 seconds
});
