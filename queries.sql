
CREATE TABLE users(
id SERIAL PRIMARY KEY,
name VARCHAR(15) UNIQUE NOT NULL,
color VARCHAR(15)
);

CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) ,
    country_name VARCHAR(255)
);

CREATE TABLE visited_countries(
id SERIAL PRIMARY KEY,
country_code CHAR(2) NOT NULL,
user_id INTEGER REFERENCES users(id)
);

CREATE TABLE visited_cities (
id SERIAL PRIMARY KEY,
city_name VARCHAR(255) NOT NULL,
user_id INTEGER REFERENCES users(id)
);

INSERT INTO users (name, color)
VALUES ('Ava', 'teal'), ('Jack', 'pink');

INSERT INTO visited_countries (country_code, user_id)
VALUES ('IN', 1), ('FR', 1), ('CA', 2), ('FR', 2 );

SELECT *
FROM visited_countries
JOIN users
ON users.id = user_id;