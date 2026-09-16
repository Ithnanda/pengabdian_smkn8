import React, { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import * as XLSX from 'xlsx';
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ThermometerSun, Droplets, Thermometer, FlaskConical, CloudRain } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'smkn8_live_sensor_data';

// === Panel Sensor Tunggal ===
const SensorCard = ({ title, value, unit, icon: Icon, accent, data, dataKey, gradientId }) => {
  const lastPoint = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className="relative flex flex-col h-full min-h-[150px] sm:min-h-[190px] lg:min-h-[220px] px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} strokeWidth={1.75} />
        <h2 className="text-slate-400 text-[12px] sm:text-[13px] font-medium">{title}</h2>
      </div>

      <div className="flex items-baseline gap-2 mb-auto">
        <span className="font-mono text-3xl sm:text-4xl lg:text-5xl leading-none font-semibold text-white tabular-nums">
          {value}
        </span>
        <span className="text-slate-500 text-sm font-mono">{unit}</span>
      </div>

      <div className="h-12 sm:h-14 lg:h-16 -mx-1 mt-3 sm:mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
              contentStyle={{
                background: '#0a1120',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                fontSize: 11,
                padding: '4px 8px',
              }}
              labelStyle={{ display: 'none' }}
              itemStyle={{ color: accent, padding: 0 }}
              formatter={(val) => [`${val} ${unit}`, '']}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={accent}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {lastPoint && (
        <div className="mt-2 text-[11px] font-mono text-slate-600">{lastPoint.time}</div>
      )}
    </div>
  );
};

function App() {
  const [currentValues, setCurrentValues] = useState({
    suhuUdara: '--',
    kelembapan: '--',
    suhuAir: '--',
    ph: '--',
    co2: '--'
  });

  const [chartData, setChartData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Menghubungkan...');

  useEffect(() => {
    // ==========================================
    // MENGAMBIL KREDENSIAL DARI FILE .env
    // ==========================================
    const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL;
    const clientId = 'ReactDashboard_' + Math.random().toString(16).substring(2, 8);

    const options = {
      clientId: clientId,
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 5000,
    };

    const client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
      setConnectionStatus('Aktif (Terhubung)');
      client.subscribe('smkn8/sensor/#');
    });

    client.on('error', () => {
      setConnectionStatus('Gagal Terhubung');
      client.end();
    });

    client.on('offline', () => setConnectionStatus('Offline (Terputus)'));

    let tempReading = {};
    let debounceTimer;

    client.on('message', (topic, message) => {
      const payloadString = message.toString();
      const payloadNum = parseFloat(payloadString);

      setCurrentValues(prev => {
        const newData = { ...prev };
        if (topic === 'smkn8/sensor/suhu_udara') newData.suhuUdara = payloadString;
        else if (topic === 'smkn8/sensor/kelembapan') newData.kelembapan = payloadString;
        else if (topic === 'smkn8/sensor/suhu_air') newData.suhuAir = payloadString;
        else if (topic === 'smkn8/sensor/ph') newData.ph = payloadString;
        else if (topic === 'smkn8/sensor/co2') newData.co2 = payloadString;
        return newData;
      });

      if (topic === 'smkn8/sensor/suhu_udara') tempReading.suhu_udara = payloadNum;
      else if (topic === 'smkn8/sensor/kelembapan') tempReading.kelembapan = payloadNum;
      else if (topic === 'smkn8/sensor/suhu_air') tempReading.suhu_air = payloadNum;
      else if (topic === 'smkn8/sensor/ph') tempReading.ph = payloadNum;
      else if (topic === 'smkn8/sensor/co2') tempReading.co2 = payloadNum;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newDataPoint = { time: timeString, timestamp: now.getTime(), ...tempReading };

        setChartData(prevData => {
          const updatedChart = [...prevData, newDataPoint];
          if (updatedChart.length > 20) {
            return updatedChart.slice(updatedChart.length - 20);
          }
          return updatedChart;
        });

        try {
          const existingData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
          existingData.push(newDataPoint);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));
        } catch (e) {
          console.error("Gagal menyimpan ke localstorage", e);
        }

        tempReading = {};
      }, 500);
    });

    return () => {
      if (client) client.end();
      clearTimeout(debounceTimer);
    };
  }, []);

  const handleExportExcel = () => {
    try {
      const rawData = localStorage.getItem(LOCAL_STORAGE_KEY);
      const data = rawData ? JSON.parse(rawData) : [];

      if (data.length === 0) {
        alert("Belum ada data sensor yang tersimpan.");
        return;
      }

      const rows = data.map(row => {
        const dateObj = new Date(row.timestamp);
        const dateStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
        
        return {
          "Tanggal": dateStr,
          "Waktu": row.time,
          "Suhu Udara (°C)": row.suhu_udara ?? "",
          "Kelembapan (%)": row.kelembapan ?? "",
          "Suhu Air (°C)": row.suhu_air ?? "",
          "pH": row.ph ?? "",
          "CO2 (PPM)": row.co2 ?? ""
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Sensor");
      XLSX.writeFile(wb, `Data_Sensor_${new Date().getTime()}.xlsx`);

    } catch (e) {
      console.error("Gagal mengekspor data", e);
      alert("Terjadi kesalahan saat mengunduh Excel.");
    }
  };

  const handleClearData = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh data sensor yang tersimpan?")) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      alert("Data berhasil dihapus.");
    }
  };

  const isConnected = connectionStatus === 'Aktif (Terhubung)';
  const isDown = connectionStatus.includes('Gagal') || connectionStatus.includes('Offline');

  return (
    <div className="relative h-dvh w-full flex flex-col overflow-hidden bg-[#060b14] font-sans antialiased">
      <div className="pointer-events-none absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/[0.05] blur-[140px]" />

      <header className="relative z-10 h-auto sm:h-14 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-0 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate">
            Sistem Monitoring Kualitas Air dan Udara
          </h1>
          <div className="flex items-center gap-2 mt-1 sm:mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-teal-400 animate-pulse' : isDown ? 'bg-rose-400' : 'bg-amber-400'
            }`}></span>
            <span className={`text-[10px] sm:text-[11px] font-mono ${
              isConnected ? 'text-teal-300' : isDown ? 'text-rose-300' : 'text-amber-300'
            }`}>
              {connectionStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearData}
            className="flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 transition-colors active:scale-95 min-w-[100px]"
            title="Hapus Data Tersimpan"
          >
            Bersihkan Data
          </button>
          
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-medium bg-teal-500/15 border border-teal-400/30 text-teal-300 hover:bg-teal-500/25 transition-colors active:scale-95 min-w-[90px]"
          >
            Unduh Excel
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-white/[0.06] lg:divide-y-0 h-full">
          <SensorCard
            title="Suhu Udara"
            value={currentValues.suhuUdara}
            unit="°C"
            icon={ThermometerSun}
            accent="#f2994a"
            data={chartData}
            dataKey="suhu_udara"
            gradientId="gradSuhuUdara"
          />

          <SensorCard
            title="Kelembapan"
            value={currentValues.kelembapan}
            unit="%"
            icon={CloudRain}
            accent="#56ccf2"
            data={chartData}
            dataKey="kelembapan"
            gradientId="gradKelembapan"
          />

          <SensorCard
            title="Suhu Air"
            value={currentValues.suhuAir}
            unit="°C"
            icon={Thermometer}
            accent="#2dd4bf"
            data={chartData}
            dataKey="suhu_air"
            gradientId="gradSuhuAir"
          />

          <SensorCard
            title="Keasaman pH"
            value={currentValues.ph}
            unit="pH"
            icon={FlaskConical}
            accent="#6fcf97"
            data={chartData}
            dataKey="ph"
            gradientId="gradPh"
          />

          <SensorCard
            title="Gas CO2"
            value={currentValues.co2}
            unit="PPM"
            icon={Droplets}
            accent="#bb86fc"
            data={chartData}
            dataKey="co2"
            gradientId="gradCo2"
          />
        </div>
      </main>

      <footer className="relative z-10 h-10 shrink-0 flex items-center justify-center border-t border-white/[0.06] text-[11px] font-mono text-slate-600">
        © {new Date().getFullYear()} Lab Teknik Digital
      </footer>
    </div>
  );
}

export default App;