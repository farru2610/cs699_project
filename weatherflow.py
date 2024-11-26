from flask import Flask, render_template, request, jsonify, send_file
import requests
from datetime import datetime, timedelta
import sqlite3
import os
import csv
import io

app = Flask(__name__)

API_KEY = '03de7d2806a1a531dfae34e7e14c9fb1'
WEATHER_API_KEY = '54f1ef9731344218aed124451241011'

DATABASE = 'weather.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weather (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT UNIQUE NOT NULL,
            temperature REAL NOT NULL,
            wind_speed REAL NOT NULL,
            wind_direction TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')
@app.route('/about')
def about():
    return render_template('about.html')

def fetch_weather_data(url):
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    return None

@app.route('/weather', methods=['GET'])
def get_weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not lat or not lon:
        return jsonify({'error': 'Invalid coordinates'}), 400

    weather_url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    data = fetch_weather_data(weather_url)

    if data:
        weather_info = {
            'city': data['name'],
            'temperature': data['main']['temp'],
            'wind_speed': data['wind']['speed'],
            'wind_direction': get_wind_direction(data['wind']['deg']),
            'description': data['weather'][0]['description'],
            'latitude': lat,
            'longitude': lon
        }

        save_weather_to_db(weather_info)

        return jsonify(weather_info)
    else:
        return jsonify({'error': 'Weather data not found'}), 404

@app.route('/city_weather', methods=['GET'])
def get_city_weather():
    city = request.args.get('city')

    if not city:
        return jsonify({'error': 'Invalid city name'}), 400

    weather_url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric"
    data = fetch_weather_data(weather_url)

    if data:
        weather_info = {
            'city': data['name'],
            'temperature': data['main']['temp'],
            'wind_speed': data['wind']['speed'],
            'wind_direction': get_wind_direction(data['wind']['deg']),
            'description': data['weather'][0]['description'],
            'latitude': data['coord']['lat'],
            'longitude': data['coord']['lon']
        }

        save_weather_to_db(weather_info)

        return jsonify(weather_info)
    else:
        return jsonify({'error': 'City not found'}), 404

@app.route('/stored_cities', methods=['GET'])
def get_stored_cities():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT city, temperature, wind_speed, wind_direction, description, latitude, longitude, timestamp
        FROM weather
        ORDER BY city ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    cities = [
        {
            'city': row[0],
            'temperature': row[1],
            'wind_speed': row[2],
            'wind_direction': row[3],
            'description': row[4],
            'latitude': row[5],
            'longitude': row[6],
            'timestamp': row[7]
        }
        for row in rows
    ]

    return render_template('stored_cities.html', cities=cities)


def save_weather_to_db(weather_info):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')  
    cursor.execute(''' 
        INSERT OR REPLACE INTO weather (city, temperature, wind_speed, wind_direction, description, latitude, longitude, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
    ''', (
        weather_info['city'],
        weather_info['temperature'],
        weather_info['wind_speed'],
        weather_info['wind_direction'],
        weather_info['description'],
        weather_info['latitude'],
        weather_info['longitude'],
        timestamp  
    ))
    conn.commit()
    conn.close()

@app.route('/download_csv', methods=['GET'])
def download_csv():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT city, temperature, wind_speed, wind_direction, description, latitude, longitude, timestamp
        FROM weather
        ORDER BY city ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    csv_writer = csv.writer(output)

    csv_writer.writerow(['City', 'Temperature (°C)', 'Wind Speed (m/s)', 'Wind Direction', 'Description', 'Latitude', 'Longitude', 'Timestamp'])

    for row in rows:
        city, temperature, wind_speed, wind_direction, description, latitude, longitude, timestamp = row
        if isinstance(timestamp, str):
            formatted_timestamp = timestamp
        else:
            formatted_timestamp = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S').strftime('%Y-%m-%d %H:%M:%S')

        csv_writer.writerow([city, temperature, wind_speed, wind_direction, description, latitude, longitude, formatted_timestamp])

    csv_data = output.getvalue().encode('utf-8')

    byte_output = io.BytesIO(csv_data)
    byte_output.seek(0)

    return send_file(byte_output, mimetype='text/csv', as_attachment=True, download_name='weather_data.csv')


def get_wind_direction(deg):
    directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    idx = int((deg / 45) % 8)
    return directions[idx]


if __name__ == '__main__':
    app.run(debug=True)
