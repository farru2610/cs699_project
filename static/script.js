const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

let currentMarker = null;

map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    fetchWeather(lat, lon);
});

function fetchWeather(lat, lon) {
    document.getElementById('loadingSpinner').style.display = 'block';

    fetch(`/weather?lat=${lat}&lon=${lon}`)
    .then(response => {
        if (!response.ok) {
            throw new Error('Weather data not found');
        }
        return response.json();
    })
    .then(data => {
        document.getElementById('loadingSpinner').style.display = 'none';

        displayWeather(data);
        placeMarker(lat, lon, data.city); 
        updateWeather(data.city);
    })
    .catch(error => {
        document.getElementById('loadingSpinner').style.display = 'none';
        alert(error.message);
    });
}

document.getElementById('citySearch').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchCity();
    }
});

function searchCity() {
    const city = document.getElementById('citySearch').value;

    if (city) {
        document.getElementById('loadingSpinner').style.display = 'block';

        fetch(`/city_weather?city=${city}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('City not found');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('loadingSpinner').style.display = 'none';

            if (data.latitude && data.longitude) {
                displayWeather(data);
                
                map.setView([data.latitude, data.longitude], 10); 
                
                placeMarker(data.latitude, data.longitude, data.city);
                
                updateWeather(data.city);
            } else {
                alert("Coordinates for the city could not be found.");
            }
        })
        .catch(error => {
            document.getElementById('loadingSpinner').style.display = 'none';
            alert(error.message);
        });
    } else {
        alert("Please enter a city name.");
    }
}

function placeMarker(lat, lon, city) {
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    currentMarker = L.marker([lat, lon]).addTo(map).bindPopup(`
        <b>${city}</b><br>
        Clicked Location: ${lat.toFixed(2)}, ${lon.toFixed(2)}
    `).openPopup();
}

function clearWeatherEffects() {
    const existingEffects = document.querySelectorAll('.weather-effect');
    existingEffects.forEach(effect => {
        effect.remove();
    });
}

function displayWeather(data) {
    const weatherDisplay = document.getElementById('weatherDisplay');

    let weatherIconClass = "";
    const weatherDesc = data.description.toLowerCase();

    if (weatherDesc.includes("clear")) {
        weatherIconClass = "wi wi-day-sunny"; // sunny icon
    } else if (weatherDesc.includes("cloud")) {
        weatherIconClass = "wi wi-cloudy"; // cloudy icon
    } else if (weatherDesc.includes("rain")) {
        weatherIconClass = "wi wi-rain"; // rainy icon
    } else if (weatherDesc.includes("snow")) {
        weatherIconClass = "wi wi-snow"; // snowy icon
    } else if (weatherDesc.includes("thunderstorm")) {
        weatherIconClass = "wi wi-thunderstorm"; // thunderstorm icon
    } else {
        weatherIconClass = "wi wi-thermometer"; // default weather icon (thermometer)
    }
    clearWeatherEffects();

    if (data.description.includes('rain')) {
        generateRain(); // Rain animation
    }
    else if (data.description.includes('snow')) {
        generateSnow(); // Snow animation
    }

    weatherDisplay.innerHTML = `
        <div class="weather-card">
            <h2>
                <span class="city-name">${data.city}</span>
                <i class="${weatherIconClass}"></i> <!-- Weather Icon -->
            </h2>
            <p class="temperature">Temperature: <span>${data.temperature}°C</span></p>
            <p class="wind">Wind: <span>${data.wind_speed} m/s</span> (${data.wind_direction})</p>
            <p class="description">Condition: <span>${data.description}</span></p>
            <div class="additional-info">
                <p>Latitude: <span>${data.latitude}</span></p>
                <p>Longitude: <span>${data.longitude}</span></p>
            </div>
        </div>
    `;
}

let temperatureChart = null;
let windSpeedChart = null;

async function updateWeather(city) {
    const weatherData = await fetchWeatherData(city);
    
    document.getElementById('cityName').textContent = city;
    clearCharts(); 
    renderTemperatureChart(weatherData);
    renderWindSpeedChart(weatherData);
}

function clearCharts() {
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    if (windSpeedChart) {
        windSpeedChart.destroy();
    }
    
    document.getElementById('temperatureChart').innerHTML = '';
    document.getElementById('windSpeedChart').innerHTML = '';
}

function renderTemperatureChart(data) {
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    const labels = data.map(item => item.time);  
    const temperatureData = data.map(item => item.temp);  
    
    temperatureChart = new Chart(ctx, {
        type: 'line',  
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temperatureData,
                borderColor: 'rgba(255, 99, 132, 1)',
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function renderWindSpeedChart(data) {
    const ctx = document.getElementById('windSpeedChart').getContext('2d');
    const windSpeedData = data.map(item => item.windSpeed);  
    
    windSpeedChart = new Chart(ctx, {
        type: 'bar',  
        data: {
            labels: data.map(item => item.time),
            datasets: [{
                label: 'Wind Speed (m/s)',
                data: windSpeedData,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function fetchWeatherData(city) {
    const apiKey = '03de7d2806a1a531dfae34e7e14c9fb1';
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.list.map(item => ({
            time: item.dt_txt,  
            temp: item.main.temp,  
            windSpeed: item.wind.speed  
        }));
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}

function fetchUserLocationWeather() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            fetchWeather(lat, lon);
        }, function(error) {
            console.error("Error fetching geolocation:", error);
            alert("Unable to retrieve your location. Please enable location access.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

window.onload = function() {
    fetchUserLocationWeather();
};

function toggleMode() {
    const body = document.body;
    const header = document.querySelector('header');
    const button = document.getElementById('modeToggle');
    
    if (body.classList.contains('day-mode')) {
        body.classList.remove('day-mode');
        body.classList.add('night-mode');
        header.classList.remove('day-mode');
        header.classList.add('night-mode');
        button.classList.remove('day-mode');
        button.classList.add('night-mode');
        button.textContent = "Day Mode";
    } else {
        body.classList.remove('night-mode');
        body.classList.add('day-mode');
        header.classList.remove('night-mode');
        header.classList.add('day-mode');
        button.classList.remove('night-mode');
        button.classList.add('day-mode');
        button.textContent = "Night Mode";
    }
}

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    toggleMode();  
} else {
    document.body.classList.add('day-mode'); 
}

function generateRain() {
    clearWeatherEffects(); 

    const rainContainer = document.createElement('div');
    rainContainer.classList.add('weather-effect', 'rain'); 
    document.body.appendChild(rainContainer);

    for (let i = 0; i < 100; i++) {
        const drop = document.createElement('div');
        drop.classList.add('drop');
        drop.style.left = `${Math.random() * 100}vw`; 
        drop.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`; 
        rainContainer.appendChild(drop);
    }
}

function generateSnow() {
    clearWeatherEffects(); 

    const snowContainer = document.createElement('div');
    snowContainer.classList.add('weather-effect', 'snow'); 
    document.body.appendChild(snowContainer);

    for (let i = 0; i < 100; i++) {
        const flake = document.createElement('div');
        flake.classList.add('flake');
        flake.style.left = `${Math.random() * 100}vw`; 
        flake.style.animationDuration = `${Math.random() * 3 + 4}s`; 
        snowContainer.appendChild(flake);
    }
}

function clearWeatherEffects() {
    const existingEffects = document.querySelectorAll('.weather-effect');
    existingEffects.forEach(effect => {
        effect.remove();
    });
}
