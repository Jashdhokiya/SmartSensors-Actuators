import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useTelemetryStore } from '../store/telemetryStore';
import { useEventStore } from '../store/eventStore';

export function useLiveBackendSync() {
  const activeOrder = useTelemetryStore((s) => s.activeOrder);
  const setBackendInfo = useTelemetryStore((s) => s.setBackendInfo);
  const applyLiveTelemetry = useTelemetryStore((s) => s.applyLiveTelemetry);
  const applyLiveHistory = useTelemetryStore((s) => s.applyLiveHistory);
  const syncFromBackend = useEventStore((s) => s.syncFromBackend);

  const activeOrderIdRef = useRef(activeOrder.id);
  activeOrderIdRef.current = activeOrder.id;

  useEffect(() => {
    let isMounted = true;

    // 1. Polling sync routine for REST API
    const syncData = async () => {
      try {
        const health = await api.getHealth();
        if (!isMounted) return;

        setBackendInfo({
          connected: health.status === 'ok',
          mqttConnected: health.mqtt?.connected ?? false,
          broker: health.mqtt?.broker ?? '',
          dbConnected: health.database?.connected ?? false,
          activeAlertsCount: health.activeAlertsCount ?? 0,
          devicesCount: health.devicesCount ?? 0,
        });

        // Sync live telemetry for current device
        const currentId = activeOrderIdRef.current;
        try {
          const telemetry = await api.getLatestTelemetry(currentId);
          if (isMounted && telemetry) {
            applyLiveTelemetry(telemetry);
          }
        } catch {
          // Device not yet active on backend, skip
        }

        // Sync history
        try {
          const history = await api.getTelemetryHistory(currentId, '1h');
          if (isMounted && history.length > 0) {
            applyLiveHistory(history);
          }
        } catch {
          // Skip history if empty
        }

        // Sync alerts and events
        try {
          const alerts = await api.getAlerts();
          const events = await api.getEvents();
          if (isMounted) {
            syncFromBackend(alerts, events);
          }
        } catch {
          // Skip alerts sync
        }
      } catch {
        // Backend offline or unreachable — local simulation continues
        if (isMounted) {
          setBackendInfo(null);
        }
      }
    };

    // Initial check immediately
    syncData();

    // Poll every 3.5 seconds
    const interval = setInterval(syncData, 3500);

    // 2. Server-Sent Events (SSE) stream for zero-latency live push
    const unsubscribeSSE = api.subscribeStream((msg) => {
      if (!isMounted) return;

      if (msg.type === 'TELEMETRY_UPDATE' && msg.telemetry) {
        // If message is for currently active device or generic esp32 node
        if (
          !msg.deviceId ||
          msg.deviceId === activeOrderIdRef.current ||
          activeOrderIdRef.current.includes('DL-JP') ||
          msg.deviceId === 'cargo_esp32_01'
        ) {
          applyLiveTelemetry(msg.telemetry);
        }
      } else if (msg.type === 'ALERT_UPDATED' || msg.type === 'ALL_ALERTS_ACKNOWLEDGED' || msg.type === 'ALERT_RESOLVED') {
        api.getAlerts().then((alerts) => {
          if (isMounted) syncFromBackend(alerts);
        }).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubscribeSSE();
    };
  }, [setBackendInfo, applyLiveTelemetry, applyLiveHistory, syncFromBackend]);
}
