import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { exportReport } from '../utils/pdfExport';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function HistoryPanel() {
  const { user, token } = useContext(AuthContext);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !token) return;

    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok) {
          setReports(data);
        } else {
          setError(data.error || 'Failed to fetch reports');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user, token]);

  if (!user) {
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-icon">🔒</div>
        <p>Please log in to view your report history.</p>
      </div>
    );
  }

  if (loading) return <div className="sidebar-empty"><p>Loading history...</p></div>;
  if (error) return <div className="sidebar-empty"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;

  return (
    <div className="fade-in" style={{ padding: '20px' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Your Saved Reports</h2>
      {reports.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No reports saved yet. Analyze a zone to save one.</p>
      ) : (
        reports.map(report => {
          let interventions = [];
          try {
            interventions = JSON.parse(report.interventions_json);
          } catch(e) { console.error(e) }

          return (
            <div key={report.id} style={{ 
              background: 'var(--surface2)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '15px',
              marginBottom: '15px'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '5px' }}>
                {new Date(report.created_at).toLocaleString()}
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                Zone ID: {report.zone_id}
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
                {report.summary}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>
                🌡️ Projected: {report.projected_reduction}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
