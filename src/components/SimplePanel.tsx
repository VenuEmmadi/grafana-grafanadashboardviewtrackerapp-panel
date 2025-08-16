import React, { useEffect } from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from '../types';

export const SimplePanel: React.FC<PanelProps<SimpleOptions>> = (props) => {
  const { datasourceUid, text } = props.options;

  // Inform the user if the UID is missing
  if (!datasourceUid) {
    return (
      <div style={{ color: 'red', padding: '10px' }}>
        Please enter the Usage Event Backend datasource UID in the panel options.
      </div>
    );
  }

  useEffect(() => {
    // Get logged-in Grafana user info from boot data
    const user = (window as any).grafanaBootData?.user;
    const username = user?.login || 'unknown';
    const userId = user?.uid || null;

    // Get dashboard UID from boot data or fallback to URL parsing
    let dashboardUID = (window as any).grafanaBootData?.dashboard?.uid;
    if (!dashboardUID) {
      const match = window.location.pathname.match(/^\/d\/([^/]+)/);
      if (match) {
        dashboardUID = match[1];
        if (process.env.NODE_ENV === 'development') {
          console.debug('Dashboard UID taken from URL fallback:', dashboardUID);
        }
      }
    }

    if (!dashboardUID) {
      console.warn('Dashboard UID not found, cannot send usage event');
      return;
    }

    const key = `usage_event_sent_${dashboardUID}_${username}`;

    const sendUsageEventIfNeeded = () => {
      if (document.visibilityState === 'visible' && !sessionStorage.getItem(key)) {
        const payload = {
          dashboard_uid: dashboardUID,
          username: username,
          user_id: userId,
          timestamp: new Date().toISOString(),
        };

        fetch(`/api/datasources/uid/${datasourceUid}/resources/usage-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
          .then((res) => {
            if (!res.ok) {
              console.error('Failed to send usage event', res.status, res.statusText);
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.debug('Usage event sent successfully');
              }
              sessionStorage.setItem(key, Date.now().toString());
            }
          })
          .catch((err) => console.error('Error sending usage event', err));
      }
    };

    sendUsageEventIfNeeded();
    document.addEventListener('visibilitychange', sendUsageEventIfNeeded);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', sendUsageEventIfNeeded);
    };
  }, [datasourceUid, text]);

  return (
    <div>
      <p>This panel sends a <b>usage-event</b> to the backend plugin 17</p>
    </div>
  );
};
