const { MongoClient } = require("mongodb");

const mongoURI = "mongodb+srv://thy_thea:36pOZaZUldekOzBI@cluster0.ypn3y.mongodb.net/?retryWrites=true&w=majority&tls=true";

const client = new MongoClient(mongoURI, { useUnifiedTopology: true });

async function testConnection() {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");
        await client.db("modbus_logs").collection("test").insertOne({ message: "Test successful" });
        console.log("Test document inserted.");
    } catch (error) {
        console.error("MongoDB connection error:", error);
    } finally {
        await client.close();
    }
}

testConnection();
