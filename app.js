const express = require("express");
const path = require("path");
const app = express();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//authentication with Token

const authenticateWithToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "helloVenky", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login existed user API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "helloVenky");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//list of all states API 2

const convertDbObjectWithStateTable = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};

app.get("/states/", authenticateWithToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT
       *
    FROM state;`;
  const statesArray = await db.all(getAllStatesQuery);
  response.send(statesArray.map(convertDbObjectWithStateTable));
});

//get state name based on state_id API 3

app.get(
  "/states/:stateId/",
  authenticateWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateNameQuery = `
    SELECT
       *
    FROM state
    WHERE
        state_id = ${stateId};`;
    const stateObj = await db.get(getStateNameQuery);
    response.send(convertDbObjectWithStateTable(stateObj));
  }
);

//create new district API 4

app.post("/districts/", authenticateWithToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createNewDistrictQuery = `
    INSERT INTO
       district (district_name, state_id, cases, cured, active, deaths)
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
        );`;
  await db.run(createNewDistrictQuery);
  response.send("District Successfully Added");
});

//get district based on district_id API 5

app.get(
  "/districts/:districtId/",
  authenticateWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictBasedOnIdQuery = `
    SELECT
       district_id AS districtId,
       district_name AS districtName, 
       state_id AS stateId,
       cases, cured, active, deaths
    FROM district
    WHERE
       district_id = ${districtId};`;
    const districtObj = await db.get(getDistrictBasedOnIdQuery);
    response.send(districtObj);
  }
);

//delete a district API 6

app.delete(
  "/districts/:districtId/",
  authenticateWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE
       district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update the district details API 7

app.put(
  "/districts/:districtId/",
  authenticateWithToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE district
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE
      district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//get statistics of covid cases API 8

app.get(
  "/states/:stateId/stats/",
  authenticateWithToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `
    SELECT
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
    FROM
      district
    WHERE
      state_id = ${stateId};`;
    const covidStats = await db.get(getStatisticsQuery);
    response.send(covidStats);
  }
);

module.exports = app;
