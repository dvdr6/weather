const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const suggestions = document.getElementById('suggestions');
const weatherCard = document.getElementById('weatherCard');
const skeleton = document.getElementById('skeleton');
const errorMsg = document.getElementById('errorMsg');
const errorText = document.getElementById('errorText');
const btnC = document.getElementById('btnC');
const btnF = document.getElementById('btnF');

let currentTempC = null;
let currentFeelsC = null;
let forecastHighsC = [];
let forecastLowsC = [];
let isCelsius = true;
let debounceTimer = null;

const WMO_CODES = {
  0:  { label: 'Clear Sky',            icon: '☀️' },
  1:  { label: 'Mainly Clear',         icon: '🌤️' },
  2:  { label: 'Partly Cloudy',        icon: '⛅' },
  3:  { label: 'Overcast',             icon: '☁️' },
  45: { label: 'Foggy',                icon: '🌫️' },
  48: { label: 'Icy Fog',              icon: '🌫️' },
  51: { label: 'Light Drizzle',        icon: '🌦️' },
  53: { label: 'Drizzle',              icon: '🌦️' },
  55: { label: 'Heavy Drizzle',        icon: '🌧️' },
  56: { label: 'Freezing Drizzle',     icon: '🌨️' },
  57: { label: 'Heavy Freezing Drizzle', icon: '🌨️' },
  61: { label: 'Light Rain',           icon: '🌧️' },
  63: { label: 'Rain',                 icon: '🌧️' },
  65: { label: 'Heavy Rain',           icon: '🌧️' },
  66: { label: 'Freezing Rain',        icon: '🌨️' },
  67: { label: 'Heavy Freezing Rain',  icon: '🌨️' },
  71: { label: 'Light Snow',           icon: '🌨️' },
  73: { label: 'Snow',                 icon: '❄️' },
  75: { label: 'Heavy Snow',           icon: '❄️' },
  77: { label: 'Snow Grains',          icon: '🌨️' },
  80: { label: 'Light Showers',        icon: '🌦️' },
  81: { label: 'Showers',              icon: '🌧️' },
  82: { label: 'Heavy Showers',        icon: '⛈️' },
  85: { label: 'Snow Showers',         icon: '🌨️' },
  86: { label: 'Heavy Snow Showers',   icon: '❄️' },
  95: { label: 'Thunderstorm',         icon: '⛈️' },
  96: { label: 'Thunderstorm w/ Hail', icon: '⛈️' },
  99: { label: 'Thunderstorm w/ Heavy Hail', icon: '⛈️' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toF(c) {
  return ((c * 9) / 5 + 32).toFixed(1);
}

function showError(msg) {
  errorText.textContent = msg;
  errorMsg.classList.remove('hidden');
  weatherCard.classList.add('hidden');
  skeleton.classList.add('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}

function showSkeleton() {
  skeleton.classList.remove('hidden');
  weatherCard.classList.add('hidden');
  hideError();
}

function hideSkeleton() {
  skeleton.classList.add('hidden');
}

function formatTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

async function geocodeCity(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

async function fetchWeather(lat, lon) {
  const params = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'weather_code',
    'wind_speed_10m',
    'pressure_msl',
    'visibility',
    'uv_index',
    'is_day',
  ].join(',');

  const dailyParams = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'sunrise',
    'sunset',
  ].join(',');

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${params}&daily=${dailyParams}&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

function getWMO(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' };
}

function renderForecast(daily) {
  const list = document.getElementById('forecastList');
  list.innerHTML = '';
  forecastHighsC = daily.temperature_2m_max;
  forecastLowsC = daily.temperature_2m_min;

  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i] + 'T12:00:00');
    const dayLabel = i === 0 ? 'Today' : DAYS[date.getDay()];
    const wmo = getWMO(daily.weather_code[i]);
    const high = isCelsius
      ? `${daily.temperature_2m_max[i].toFixed(0)}°C`
      : `${toF(daily.temperature_2m_max[i])}°F`;
    const low = isCelsius
      ? `${daily.temperature_2m_min[i].toFixed(0)}°C`
      : `${toF(daily.temperature_2m_min[i])}°F`;

    const item = document.createElement('div');
    item.className = 'forecast-item';
    item.innerHTML = `
      <span class="forecast-day">${dayLabel}</span>
      <span class="forecast-icon">${wmo.icon}</span>
      <span class="forecast-desc">${wmo.label}</span>
      <div class="forecast-temps">
        <span class="forecast-high">${high}</span>
        <span class="forecast-low">${low}</span>
      </div>
    `;
    list.appendChild(item);
  }
}

function updateTemperatureDisplay() {
  if (currentTempC === null) return;

  const tempEl = document.getElementById('temperature');
  const feelsEl = document.getElementById('feelsLike');

  if (isCelsius) {
    tempEl.textContent = `${currentTempC.toFixed(1)}°`;
    feelsEl.textContent = `${currentFeelsC.toFixed(1)}°C`;
    btnC.classList.add('active');
    btnF.classList.remove('active');
  } else {
    tempEl.textContent = `${toF(currentTempC)}°`;
    feelsEl.textContent = `${toF(currentFeelsC)}°F`;
    btnF.classList.add('active');
    btnC.classList.remove('active');
  }

  const forecastItems = document.querySelectorAll('.forecast-item');
  forecastItems.forEach((item, i) => {
    const temps = item.querySelector('.forecast-temps');
    const high = isCelsius
      ? `${forecastHighsC[i].toFixed(0)}°C`
      : `${toF(forecastHighsC[i])}°F`;
    const low = isCelsius
      ? `${forecastLowsC[i].toFixed(0)}°C`
      : `${toF(forecastLowsC[i])}°F`;
    temps.innerHTML = `
      <span class="forecast-high">${high}</span>
      <span class="forecast-low">${low}</span>
    `;
  });
}

function renderWeather(data, cityLabel, countryLabel) {
  const cur = data.current;
  const daily = data.daily;
  const wmo = getWMO(cur.weather_code);

  currentTempC = cur.temperature_2m;
  currentFeelsC = cur.apparent_temperature;

  document.getElementById('cityName').textContent = cityLabel;
  document.getElementById('countryName').textContent = countryLabel;
  document.getElementById('weatherIcon').textContent = wmo.icon;
  document.getElementById('weatherDesc').textContent = wmo.label;
  document.getElementById('humidity').textContent = `${cur.relative_humidity_2m}%`;
  document.getElementById('windSpeed').textContent = `${cur.wind_speed_10m} km/h`;
  document.getElementById('pressure').textContent = `${Math.round(cur.pressure_msl)} hPa`;

  const visKm = (cur.visibility / 1000).toFixed(1);
  document.getElementById('visibility').textContent = `${visKm} km`;

  const uv = cur.uv_index;
  let uvLabel = uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : uv <= 10 ? 'Very High' : 'Extreme';
  document.getElementById('uvIndex').textContent = `${uv} (${uvLabel})`;

  document.getElementById('sunrise').textContent = formatTime(daily.sunrise[0]);
  document.getElementById('sunset').textContent = formatTime(daily.sunset[0]);

  renderForecast(daily);
  updateTemperatureDisplay();

  hideSkeleton();
  weatherCard.classList.remove('hidden');
}

async function search(query) {
  if (!query.trim()) return;
  suggestions.classList.add('hidden');
  showSkeleton();

  try {
    const places = await geocodeCity(query);
    if (!places.length) {
      showError('City not found. Please try a different name.');
      return;
    }

    const place = places[0];
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    const addr = place.address || {};
    const cityLabel =
      addr.city || addr.town || addr.village || addr.county || place.display_name.split(',')[0];
    const countryLabel = addr.country || '';

    const data = await fetchWeather(lat, lon);
    renderWeather(data, cityLabel, countryLabel);
    hideError();
  } catch (err) {
    showError('Something went wrong. Please check your connection and try again.');
  }
}

async function populateSuggestions(query) {
  if (query.length < 2) {
    suggestions.classList.add('hidden');
    return;
  }
  try {
    const places = await geocodeCity(query);
    if (!places.length) {
      suggestions.classList.add('hidden');
      return;
    }
    suggestions.innerHTML = '';
    places.slice(0, 5).forEach((place) => {
      const addr = place.address || {};
      const name =
        addr.city || addr.town || addr.village || addr.county || place.display_name.split(',')[0];
      const country = addr.country || '';
      const state = addr.state || '';
      const display = state ? `${name}, ${state}` : name;

      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C8.69 2 6 4.69 6 8c0 5 6 13 6 13s6-8 6-13c0-3.31-2.69-6-6-6z"/>
          <circle cx="12" cy="8" r="2"/>
        </svg>
        <span>${display}</span>
        <span class="suggestion-country">${country}</span>
      `;
      item.addEventListener('click', () => {
        cityInput.value = display;
        suggestions.classList.add('hidden');
        search(place.display_name);
      });
      suggestions.appendChild(item);
    });
    suggestions.classList.remove('hidden');
  } catch {
    suggestions.classList.add('hidden');
  }
}

cityInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const val = cityInput.value.trim();
  debounceTimer = setTimeout(() => populateSuggestions(val), 300);
});

cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    search(cityInput.value);
  }
});

searchBtn.addEventListener('click', () => {
  clearTimeout(debounceTimer);
  search(cityInput.value);
});

document.addEventListener('click', (e) => {
  if (!suggestions.contains(e.target) && e.target !== cityInput) {
    suggestions.classList.add('hidden');
  }
});

btnC.addEventListener('click', () => {
  if (!isCelsius) {
    isCelsius = true;
    updateTemperatureDisplay();
  }
});

btnF.addEventListener('click', () => {
  if (isCelsius) {
    isCelsius = false;
    updateTemperatureDisplay();
  }
});

(async () => {
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
    );
    const { latitude, longitude } = pos.coords;
    showSkeleton();
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const geoRes = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' } });
    const geoData = await geoRes.json();
    const addr = geoData.address || {};
    const cityLabel = addr.city || addr.town || addr.village || addr.county || 'Your Location';
    const countryLabel = addr.country || '';
    cityInput.value = cityLabel;
    const data = await fetchWeather(latitude, longitude);
    renderWeather(data, cityLabel, countryLabel);
  } catch {
  }
})();
