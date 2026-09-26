const path = require("path");
const dotenv = require("dotenv");

// Load Server/.env explicitly so it is found no matter which directory the server is started from
dotenv.config({ path: path.join(__dirname, ".env") });

const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set. Add JWT_SECRET=<random string> to Server/.env or authentication will fail."
  );
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});