import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Loader2,
  Sun,
} from "lucide-react";

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const iconForCode = (code) => {
  if ([0, 1].includes(code)) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
};

const valueWithUnit = (value, unit) =>
  Number.isFinite(value) ? `${Math.round(value)}${unit}` : "—";

const formatDay = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short" });
};

export function WeatherForecast({ site, weather, loading, error, onRetry }) {
  if (!site || !Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) {
    return (
      <div className="sd-section weather-panel">
        <h5>Weather outlook</h5>
        <p className="weather-message">Add GPS coordinates to this site to view its weather.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sd-section weather-panel" aria-live="polite">
        <h5>Weather outlook</h5>
        <p className="weather-message"><Loader2 size={14} className="spin" /> Loading site forecast…</p>
      </div>
    );
  }

  if (error || !weather?.current || !weather?.daily) {
    const message = error || "Weather forecast is unavailable.";
    return (
      <div className="sd-section weather-panel" aria-live="polite">
        <h5>Weather outlook</h5>
        <p className="weather-message">{message}</p>
        <button type="button" className="btn sm ghost weather-retry" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  const currentCode = weather.current.weather_code;
  const CurrentIcon = iconForCode(currentCode);
  const forecast = weather.daily.time.map((date, index) => {
    const code = weather.daily.weather_code[index];
    return {
      date,
      code,
      Icon: iconForCode(code),
      description: weatherDescriptions[code] || "Conditions unavailable",
      high: weather.daily.temperature_2m_max[index],
      low: weather.daily.temperature_2m_min[index],
      rain: weather.daily.precipitation_sum?.[index],
    };
  });

  return (
    <div className="sd-section weather-panel" aria-live="polite">
      <div className="weather-heading">
        <h5>Weather outlook</h5>
        <span title="Conditions are checked every 10 minutes; MET Norway forecast updates vary by location">
          {weather.current.time
            ? `Forecast ${weather.current.time.slice(11, 16)}${weather.timezone_abbreviation ? ` ${weather.timezone_abbreviation}` : ""}`
            : weather.timezone_abbreviation || weather.timezone || ""}
          {" · MET Norway"}
        </span>
      </div>
      <div className="weather-current">
        <CurrentIcon size={28} aria-hidden="true" />
        <div>
          <strong>{valueWithUnit(weather.current.temperature_2m, "°")}</strong>
          <span>{weatherDescriptions[currentCode] || "Conditions unavailable"}</span>
        </div>
      </div>
      <div className="weather-metrics">
        <span>Humidity <strong>{valueWithUnit(weather.current.relative_humidity_2m, "%")}</strong></span>
        <span>Wind <strong>{valueWithUnit(weather.current.wind_speed_10m, " km/h")}</strong></span>
        <span>Rain <strong>{valueWithUnit(weather.current.precipitation, " mm")}</strong></span>
        <span>Cloud cover <strong>{valueWithUnit(weather.current.cloud_cover, "%")}</strong></span>
      </div>
      <div className="weather-forecast" aria-label="Seven-day forecast">
        {forecast.map(({ date, Icon, description, high, low, rain }) => (
          <div className="weather-day" key={date} title={description}>
            <span className="weather-day-name">{formatDay(date)}</span>
            <Icon size={16} aria-hidden="true" />
            <span className="weather-day-temperatures">
              {valueWithUnit(high, "°")} <span>{valueWithUnit(low, "°")}</span>
            </span>
            <span className="weather-day-rain">
              {Number.isFinite(rain) ? `${rain.toFixed(1)} mm` : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="weather-attribution">
        Weather data by{" "}
        <a href="https://api.met.no/" target="_blank" rel="noopener noreferrer">MET Norway</a>
        {" · "}
        <a href="https://api.met.no/doc/License" target="_blank" rel="noopener noreferrer">CC BY 4.0 / NLOD 2.0</a>
      </div>
    </div>
  );
}
