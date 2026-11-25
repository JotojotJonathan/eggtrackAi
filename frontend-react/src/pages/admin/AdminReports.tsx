import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const AdminReports = () => {
  const [data, setData] = useState<any>({ production: [], sales: [], totals: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      // ✅ GIGAMIT OG BACKTICKS
      const res = await axios.get(`http://${window.location.hostname}:8000/api/reports/`);
      setData(res.data);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('🥚 EggTrack AI Report', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });

    doc.setFontSize(14);
    doc.text('Summary', 20, 45);
    doc.setFontSize(11);
    doc.text(`Total Eggs Produced: ${data.totals.total_eggs}`, 20, 55);
    doc.text(`Total Orders: ${data.totals.total_orders}`, 20, 62);
    doc.text(`Total Revenue: PHP ${data.totals.total_revenue?.toFixed(2)}`, 20, 69);

    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Eggs', 'Good']],
      body: data.production.map((p: any) => [p.date, p.eggs, p.good]),
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
    });

    doc.save('eggtrack-report.pdf');
    toast.success('Report downloaded');
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">📊 Reports & Analytics</h1>
        <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">📄 Export PDF</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Total Eggs (30 days)</h3>
          <p className="text-3xl font-bold text-green-600">{data.totals.total_eggs}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Total Orders</h3>
          <p className="text-3xl font-bold text-blue-600">{data.totals.total_orders}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</h3>
          <p className="text-3xl font-bold text-yellow-600">₱{data.totals.total_revenue?.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <h2 className="text-lg font-bold mb-4 dark:text-white">🥚 Production Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.production}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }} />
            <Legend />
            <Line type="monotone" dataKey="eggs" stroke="#22c55e" name="Total Eggs" />
            <Line type="monotone" dataKey="good" stroke="#3b82f6" name="Good Eggs" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <h2 className="text-lg font-bold mb-4 dark:text-white">💰 Sales Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.sales}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }} />
            <Legend />
            <Bar dataKey="revenue" fill="#f59e0b" name="Revenue (PHP)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminReports;