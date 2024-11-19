const ModbusRTU = require('modbus-serial');
const net = require('net');

// Create a Modbus TCP server
const server = net.createServer();
const modbus = new ModbusRTU();

// Define register data (e.g., AIN0, AIN1)
const registers = {
    0x0000: 123, // Example value for AIN0
    0x0001: 456, // Example value for AIN1
};

// Handle incoming connections
server.on('connection', (socket) => {
    console.log(`RTU connected: ${socket.remoteAddress} : ${socket.remotePort}`);

    socket.on('data', (data) => {
        console.log(`Received data: ${data.toString('hex')}`);

        // Decode the Modbus request
        try {
            const unitId = data.readUInt8(6); // Extract Unit ID
            const functionCode = data.readUInt8(7); // Extract Function Code
            const startAddress = data.readUInt16BE(8); // Extract Start Address
            const quantity = data.readUInt16BE(10); // Extract Quantity

            console.log(`Unit ID: ${unitId}, Function Code: ${functionCode}, Start Address: ${startAddress}, Quantity: ${quantity}`);

            // Check Function Code
            if (functionCode === 0x04) { // Read Input Registers
                const response = Buffer.alloc(3 + quantity * 2);
                response.writeUInt8(unitId, 0); // Unit ID
                response.writeUInt8(functionCode, 1); // Function Code
                response.writeUInt8(quantity * 2, 2); // Byte Count

                for (let i = 0; i < quantity; i++) {
                    const registerValue = registers[startAddress + i] || 0; // Default to 0 if not set
                    response.writeUInt16BE(registerValue, 3 + i * 2);
                }

                socket.write(response);
                console.log(`Sent response: ${response.toString('hex')}`);
            } else {
                console.log('Unsupported function code.');
            }
        } catch (error) {
            console.error(`Error processing data: ${error.message}`);
        }
    });

    socket.on('close', () => {
        console.log('RTU disconnected.');
    });

    socket.on('error', (error) => {
        console.error(`Socket error: ${error.message}`);
    });
});

// Start the server
const PORT = 1234;
server.listen(PORT, () => {
    console.log(`Modbus TCP server listening on port ${PORT}`);
});
