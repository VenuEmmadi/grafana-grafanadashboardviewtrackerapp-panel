import React, { useEffect } from 'react';
import { PanelProps } from '@grafana/data';

export const SimplePanel: React.FC<PanelProps> = (props) => {
  useEffect(() => {
    // User and dashboard info
    const user = (window as any).grafanaBootData?.user;
    const username = user?.login || 'unknown';
    const dashboardUrl = window.location.pathname;
    let dashboardId = '';
    const match = dashboardUrl.match(/^\/d\/([^\/]+)/);
    if (match) dashboardId = match[1];

    // Remove dashboard name logic entirely

    if (!dashboardId) return;

    const key = `otel_log_sent_${dashboardId}_${username}`;

    const sendLogIfNeeded = () => {
      if (document.visibilityState === 'visible' && !sessionStorage.getItem(key)) {
        // Compose log according to OTLP Log v1 schema (without dashboard_name)
        const otlpLog = {
          resourceLogs: [
            {
              resource: {
                attributes: [
                  { key: 'service.name', value: { stringValue: 'grafana-frontend-logs' } }
                ]
              },
              scopeLogs: [
                {
                  scope: {
                    name: 'grafana.panel',
                    version: '1.0.0'
                  },
                  logRecords: [
                    {
                      timeUnixNano: Date.now() * 1e6 + '',
                      severityNumber: 9, // INFO
                      severityText: 'INFO',
                      body: { stringValue: 'Dashboard viewed (frontend)' },
                      attributes: [
                        { key: 'username', value: { stringValue: username } },
                        { key: 'dashboard_id', value: { stringValue: dashboardId } },
                        { key: 'dashboard_url', value: { stringValue: dashboardUrl } },
                        { key: 'timestamp', value: { stringValue: new Date().toISOString() } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

        // Send the log using fetch
        fetch('http://localhost:4318/v1/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(otlpLog)
        });

        sessionStorage.setItem(key, Date.now().toString());
      }
    };

    sendLogIfNeeded();
    document.addEventListener('visibilitychange', sendLogIfNeeded);
    return () => {
      document.removeEventListener('visibilitychange', sendLogIfNeeded);
    };
  }, [props]);

  return (
    <div>
      <h3>Dashboard View Tracker Panel</h3>
      <div>
        This panel is sending a dashboard <b>log</b> (not metric) via OTLP HTTP<br />
        <strong>
          Only sends when this tab becomes visible the first time, including user, dashboard id, and url.
        </strong>
      </div>
    </div>
  );
};
