const properties = require('./json/properties.json');
const users = require('./json/users.json');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  const query = {
    text: `
    SELECT * 
    FROM users
    WHERE email = $1`,
    values: [email || 'null']
  };
  return pool.query(query)
    .then(res => res.rows[0])
    .catch(err => console.error('getUserEmail failed', err.stack));
};
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  const query = {
    text: `
    SELECT * 
    FROM users
    WHERE id = $1`,
    values: [id || 'null']
  };
  return pool.query(query)
    .then(res => res.rows[0])
    .catch(err => console.error('getUserId failed', err.stack));
};
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser =  function(user) {
  const query = {
    text: `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *`,
    values: [user.name, user.email, user.password]
  };

  return pool.query(query)
    .then(res => res.rows)
    .catch(err => console.error('addUser failed', err.stack));
};
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  const query = {
    text: `
    SELECT properties.*, reservations.*, avg(rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id 
    WHERE reservations.guest_id = $1
    AND reservations.end_date < now()::date
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2;`,
    values: [guest_id, limit]
  };

  return pool.query(query)
    .then(res => res.rows)
    .catch(err => console.error('getAllRes failed', err.stack));
};

exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  // 1
  const queryParams = [];
  // 2
  let queryString = `
    SELECT properties.*, avg(property_reviews.rating) as average_rating
    FROM properties
    LEFT JOIN property_reviews ON properties.id = property_id
    `;
  
  // Add options if specified
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE city LIKE $${queryParams.length} `;
  }

  if (options.owner_id) {
    queryParams.push(`${options.owner_id}`);
      
    if (queryParams.length > 1) {
      queryString += `AND owner_id LIKE $${queryParams.length} `;
    } else {
      queryString += `WHERE owner_id LIKE $${queryParams.length} `;
    }
  }
    
  if (options.minimum_price_per_night) {
    queryParams.push(Number(options.minimum_price_per_night) * 100);
      
    if (queryParams.length > 1) {
      queryString += `AND cost_per_night >= $${queryParams.length} `;
    } else {
      queryString += `WHERE cost_per_night >= $${queryParams.length} `;
    }
  }

  if (options.maximum_price_per_night) {
    queryParams.push(Number(options.maximum_price_per_night) * 100);
      
    if (queryParams.length > 1) {
      queryString += `AND cost_per_night <= $${queryParams.length} `;
    } else {
      queryString += `WHERE cost_per_night <= $${queryParams.length} `;
    }
  }

  queryString += `GROUP BY properties.id `;

  if (options.minimum_rating) {
    queryParams.push(Number(options.minimum_rating));
    queryString += `HAVING avg(property_reviews.rating) >= $${queryParams.length} `;
  }
  
  // 4
  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
    `;
  
  console.log(queryString, queryParams)
  // 6
  return pool.query(queryString, queryParams)
    .then(res => res.rows)
    .catch(err => console.error('getAllProperties failed', err.stack));
};
exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  
  // Converts necessary fields to numbers first
  if(property.number_of_bathrooms) {
    property.number_of_bathrooms = Number(property.number_of_bathrooms);
  }

   if(property.number_of_bedrooms) {
    property.number_of_bedrooms = Number(property.number_of_bedrooms);
  }

   if(property.parking_spaces) {
    property.parking_spaces = Number(property.parking_spaces);
  }

  property.cost_per_night = Number(property.cost_per_night) * 100;
  
  const queryKeys = Object.keys(property).filter(x => property[x]); //filters out keys without values
  const queryParams = Object.values(property).filter(x => x); // filters out empty values
  const queryVals = Array.from({length: queryParams.length}, (_, i) => '$' + (i + 1)); //creates an array of the indices
  let queryString = `
  INSERT INTO properties(${queryKeys.join(', ')})
  VALUES(${queryVals.join(', ')})
  RETURNING *`;

  // console.log(queryString, queryParams)
  return pool.query(queryString, queryParams)
    .then(res => res.rows[0])
    .catch(err => console.error('addProperty failed', err.stack));
};

exports.addProperty = addProperty;
