import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AdminAIForecast = () => {
  const [prediction, setPrediction] = useState<any>(null);
  const [anomaly, setAnomaly] = useState<any>(null);
  const [overcommitment, setOvercommitment] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runAllAI();
  }, []);

  const runAllAI = async () => {
    setLoading(true);
    try {
      // ✅ GIGAMIT OG BACKTICKS
      const res = await axios.get(`http://${window.location.hostname}:8000/api/ai/run/`);
      const data = res.data;
      setPrediction(data.forecast);
      setAnomaly(data.anomaly);
      setOvercommitment(data.overcommitment);
      toast.success('✅ AI analysis complete');
    } catch (error) {
      toast.error('Failed to run AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">🔮 AI Insights</h1>
        <button onClick={runAllAI} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">
          {loading ? 'Analyzing...' : '🔄 Refresh Analysis'}
        </button>
      </div>

      <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl shadow-xl p-6 lg:p-8">
        <h2 className="text-lg lg:text-xl font-bold mb-4">📈 Tomorrow's Forecast</h2>
        {prediction ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-blue-100 text-sm">Predicted Eggs</p>
              <p className="text-4xl lg:text-5xl font-bold">{prediction.predicted_eggs}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">Confidence</p>
              <p className="text-4xl lg:text-5xl font-bold">{(prediction.confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">Date</p>
              <p className="text-2xl lg:text-3xl font-bold">{prediction.date}</p>
            </div>
          </div>
        ) : (
          <p className="text-blue-100">Not enough data to make a prediction. Record more production data.</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 lg:p-8">
        <h2 className="text-lg lg:text-xl font-bold mb-4 dark:text-white">⚠️ Anomaly Detection</h2>
        {anomaly?.detected ? (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
            <p className="font-bold text-red-800 dark:text-red-300">🚨 Production Drop Detected!</p>
            <ul className="mt-2 text-sm text-red-700 dark:text-red-400">
              <li>Today's production: <strong>{anomaly.today}</strong></li>
              <li>14-day average: <strong>{anomaly.average}</strong></li>
              <li>Drop: <strong>{anomaly.drop_percent}%</strong></li>
            </ul>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-800 dark:text-green-300">✅ No anomalies detected. Production is normal.</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 lg:p-8">
        <h2 className="text-lg lg:text-xl font-bold mb-4 dark:text-white">📊 Order vs Forecast</h2>
        {overcommitment?.detected ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-4 rounded">
            <p className="font-bold text-yellow-800 dark:text-yellow-300">⚠️ Overcommitment Warning!</p>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
              <li>Total orders tomorrow: <strong>{overcommitment.total_orders}</strong></li>
              <li>Forecasted production: <strong>{overcommitment.forecasted}</strong></li>
              <li>Shortage: <strong>{overcommitment.shortage} eggs</strong></li>
            </ul>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-800 dark:text-green-300">✅ Orders are within forecasted production.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAIForecast;