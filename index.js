const ModbusRTU = require("modbus-serial");
const { MongoClient } = require("mongodb");
const moment = require("moment-timezone");

const uri = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/modbus_logs?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB connection setup
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
connectDB();

const registers = {
  1: {  // Device 1 (Slave Address 1)
    20128: 12300,
    20129: 45600,
    // Other registers...
  },
  2: {  // Device 2 (Slave Address 2)
    20140: 20200,
    20141: 20300,
    // Other registers...
  },
};

// Create Modbus TCP Server
const modbusServer = new ModbusRTU.ServerTCP(
  {
    getHoldingRegister: async (addr, unitID, numRegisters) => {
      console.log(`Read Holding Registers starting at address ${addr} from unit ${unitID}`);

      let values = [];
      for (let i = 0; i < numRegisters; i++) {
        const lowAddr = addr + (i * 2);
        const highAddr = lowAddr + 1;

        const lowValue = registers[unitID]?.[lowAddr] || 0;
        const highValue = registers[unitID]?.[highAddr] || 0;
        let value = (highValue << 16) | lowValue;

        value = Math.max(0, Math.min(1000000, value));
        values.push(value);
      }

      console.log(`Returning values: ${values} for starting address: ${addr}`);

      const database = client.db("modbus_logs");
      const collection = database.collection("logs");
      const logEntry = {
        unitID,
        functionCode: 3,
        address: addr,
        values,
        timestamp: moment().tz("Asia/Phnom_Penh").format(),
      };
      await collection.insertOne(logEntry);

      return values;
    }
  },
  {
    host: "0.0.0.0",  // Listen on all network interfaces
    port: 1234,       // Ensure this is 1234
    debug: true,      // Enable debugging
  }
);

console.log("Modbus TCP Server is running on port 1234");

modbusServer.on("error", (error) => {
  console.error("Modbus Server Error:", error);
});
