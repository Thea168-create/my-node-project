const ModbusRTU = require("modbus-serial");

// Create Modbus TCP Server
const server = new ModbusRTU.ServerTCP({
  // Handle read request for holding registers
  getHoldingRegister: async (addr, unitID, numRegisters) => {
    console.log(`Received request to read Holding Registers starting at address ${addr} from unit ${unitID}`);

    let values = [];

    // Simulate sensor data based on register address
    if (addr === 20128) { // Sensor 1, first 32-bit register
      for (let i = 0; i < numRegisters; i++) {
        const register = Math.floor(Math.random() * 10000);  // Simulated sensor data
        values.push(register);
      }
    } else {
      console.log("Unknown register address, returning default data.");
      values.push(0);  // Return default data for unknown registers
    }

    console.log(`Returning values: ${values} for starting address: ${addr}`);
    return values;  // Return the simulated values to the client
  },

}, {
  host: '0.0.0.0',  // Listen on all available network interfaces
  port: 502,        // Modbus TCP default port
  debug: true,      // Enable debugging for requests/responses
});

console.log("Modbus TCP Server running on port 502");
