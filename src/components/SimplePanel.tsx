import React, { useEffect } from 'react';
import { PanelProps } from '@grafana/data';

import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// ---- OTEL METRIC PROVIDER: singleton per tab ----
const otelSetup = (() => {
  let meter: ReturnType<MeterProvider['getMeter']>;
  let isSetup = false;
  return () => {
    if (!isSetup) {
      const exporter = new OTLPMetricExporter({
        url: 'http://localhost:4318/v1/metrics', // your collector endpoint
      });
      const meterProvider = new MeterProvider({
        readers: [new PeriodicExportingMetricReader({
          exporter,
          exportIntervalMillis: 5000,
        })],
      });
      meter = meterProvider.getMeter('grafana-frontend-metrics');
      isSetup = true;
    }
    return meter;
  };
})();

export const SimplePanel: React.FC<PanelProps> = (props) => {
  useEffect(() => {
    // Get user & dashboard info
    const user = (window as any).grafanaBootData?.user;
    const username = user?.login || 'unknown';
    const dashboardUrl = window.location.pathname;
    let dashboardId = '';
    const match = dashboardUrl.match(/^\/d\/([^\/]+)/);
    if (match) dashboardId = match[1];

    if (!dashboardId) return;

    const key = `otel_metric_sent_${dashboardId}_${username}`;
    // Function to send metric - only once per tab/session per dashboard/user
    const sendMetricIfNeeded = () => {
      if (document.visibilityState === 'visible' && !sessionStorage.getItem(key)) {
        const meter = otelSetup();
        const dashboardViewCounter = meter.createCounter('grafana_dashboard_view', {
          description: 'Dashboard view events from the frontend'
        });
        dashboardViewCounter.add(1, {
          username,
          dashboard_id: dashboardId,
          dashboard_url: dashboardUrl,
          timestamp: new Date().toISOString(),
        });
        sessionStorage.setItem(key, Date.now().toString());
      }
    };

    // Send if visible (e.g., if tab already focused on first mount)
    sendMetricIfNeeded();

    // Listen for visibility changes (dashboard/tab becoming visible)
    document.addEventListener('visibilitychange', sendMetricIfNeeded);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', sendMetricIfNeeded);
    };
  }, []);

  return (
    <div>
      <h3>Dashboard View Tracker Panel</h3>
      <div>
        This panel is sending a dashboard view metric<br />
        <strong>only when this tab actually becomes visible the first time.</strong>
      </div>
    </div>
  );
};
