import React, { useEffect } from 'react';
import { PanelProps } from '@grafana/data';

export const SimplePanel: React.FC<PanelProps> = (props) => {
  useEffect(() => {
    // Logged-in Grafana user
    const user = (window as any).grafanaBootData?.user;
    const username = user?.login || 'unknown';

    // Try boot-data first
    let dashboardUID = (window as any).grafanaBootData?.dashboard?.uid;

    // Fallback to URL parsing if boot-data doesn't contain UID
    if (!dashboardUID) {
      const match = window.location.pathname.match(/^\/d\/([^/]+)/);
      if (match) {
        dashboardUID = match[1];
        if (process.env.NODE_ENV === 'development') {
          console.debug('Dashboard UID taken from URL fallback:', dashboardUID);
        }
      }
    }

    // If still no UID, skip sending
    if (!dashboardUID) {
      console.warn('Dashboard UID not found, cannot send usage event');
      return;
    }

    // Prevent duplicate sends in same tab session
    const key = `usage_event_sent_${dashboardUID}_${username}`;

    const sendUsageEventIfNeeded = () => {
      if (document.visibilityState === 'visible' && !sessionStorage.getItem(key)) {
        const payload = {
          dashboard_uid: dashboardUID,
          username: username,
          timestamp: new Date().toISOString(),
        };

        // Get datasource UID from props or fallback
        const datasourceUID =
          props.data?.request?.targets?.[0]?.datasource?.uid || 'det49wwwzwjy8a';

        if (!datasourceUID) {
          console.error('No datasource UID found, cannot send usage event');
          return;
        }

        fetch(`/api/datasources/uid/${datasourceUID}/resources/usage-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Grafana session cookie used automatically
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

    // Send on load (if visible) and whenever tab becomes visible
    sendUsageEventIfNeeded();
    document.addEventListener('visibilitychange', sendUsageEventIfNeeded);

    return () => {
      document.removeEventListener('visibilitychange', sendUsageEventIfNeeded);
    };
  }, [props]);

  return (
    <div>
      <h3>Dashboard View Tracker Panel</h3>
      <div>
        This panel sends a <b>usage-event</b> to the backend plugin.
        <br />
        <strong>
          Only sends when the tab becomes visible the first time for the logged-in user 5.
        </strong>
      </div>
    </div>
  );
};
