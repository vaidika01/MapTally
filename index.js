import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
db.connect().catch((err) => console.error("Connection error", err.stack));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

async function getVisitedCities(userId) {
  const result = await db.query(
    "SELECT city_name FROM visited_cities WHERE user_id = $1;",
    [userId]
  );
  return result.rows.map((row) => row.city_name);
}

app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  const visitedCities = await getVisitedCities(currentUserId);

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
    visitedCities: visitedCities,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"].trim().toLowerCase();
  const currentUser = await getCurrentUser();

  if (!input) {
    // Handle empty input
    res.render("index.ejs", {
      countries: await checkVisited(),
      total: (await checkVisited()).length,
      users: users,
      color: currentUser.color,
      error: "Country name cannot be empty.",
      input: req.body["country"],
      visitedCities: await getVisitedCities(currentUserId),
    });
    return;
  }

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1;",
      [input]
    );

    if (result.rows.length === 0) {
      // Handle invalid country name
      res.render("index.ejs", {
        countries: await checkVisited(),
        total: (await checkVisited()).length,
        users: users,
        color: currentUser.color,
        error: "Invalid country name. Please try again.",
        input: req.body["country"],
        visitedCities: await getVisitedCities(currentUserId),
      });
      return;
    }

    const countryCode = result.rows[0].country_code;
    const visitedCountries = await checkVisited();

    if (visitedCountries.includes(countryCode)) {
      // Handle duplicate country
      res.render("index.ejs", {
        countries: await checkVisited(),
        total: (await checkVisited()).length,
        users: users,
        color: currentUser.color,
        error: "The country is already added.",
        input: req.body["country"],
        visitedCities: await getVisitedCities(currentUserId),
      });
      return;
    }

    // Add the country if all checks pass
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.render("index.ejs", {
      countries: await checkVisited(),
      total: (await checkVisited()).length,
      users: users,
      color: currentUser.color,
      error: "An error occurred. Please try again.",
      input: req.body["country"],
      visitedCities: await getVisitedCities(currentUserId),
    });
  }
});

app.post("/add-city", async (req, res) => {
  const input = req.body["city"].trim().toLowerCase();

  const currentUser = await getCurrentUser();

  if (!input) {
    res.render("index.ejs", {
      countries: await checkVisited(),
      total: (await checkVisited()).length,
      users: users,
      color: currentUser.color,
      error: "City name cannot be empty.",
      visitedCities: await getVisitedCities(currentUserId),
    });
    return;
  }

  try {
    // Check if the city already exists for the current user
    const existingCity = await db.query(
      "SELECT city_name FROM visited_cities WHERE city_name = $1 AND user_id = $2;",
      [input, currentUserId]
    );

    if (existingCity.rows.length > 0) {
      // City already exists
      res.render("index.ejs", {
        countries: await checkVisited(),
        total: (await checkVisited()).length,
        users: users,
        color: currentUser.color,
        error: "This city is already added.",
        visitedCities: await getVisitedCities(currentUserId),
      });
      return;
    }

    await db.query(
      "INSERT INTO visited_cities (city_name, user_id) VALUES ($1, $2)",
      [input, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.log("Error adding city:", err);
    res.render("index.ejs", {
      countries: await checkVisited(),
      total: (await checkVisited()).length,
      users: users,
      color: currentUser.color,
      error: "An error occurred. Please try again.",
      visitedCities: await getVisitedCities(currentUserId),
    });
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name.trim(); // Trim whitespace from the name
  const color = req.body.color;

  if (!name) {
    res.render("new.ejs", {
      error: "Name cannot be empty.",
      color: color,
    });
    return;
  }

  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    const id = result.rows[0].id;
    currentUserId = id;

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("An error occurred while creating the new user.");
  }
});

app.post("/delete-city", async (req, res) => {
  const cityName = req.body["city_name"].trim().toLowerCase();
  const currentUser = await getCurrentUser();

  if (!cityName) {
    res.redirect("/"); // Redirect if city name is empty
    return;
  }

  try {
    await db.query(
      "DELETE FROM visited_cities WHERE city_name = $1 AND user_id = $2",
      [cityName, currentUserId]
    );
    res.redirect("/"); // Redirect to avoid resubmission
  } catch (err) {
    console.log("Error deleting city:", err);
    res.redirect("/"); // Redirect if an error occurs
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
