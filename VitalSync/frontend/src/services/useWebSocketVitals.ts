import { useEffect, useRef, useState } from 'react';
import { WebSocketTelemetry } from '../types';
import { useToastStore } from '../store/useToastStore';

export interface UseWebSocketVitalsOptions {
  patientId: number;
  enabled?: boolean;
  onUpdate?: (data: WebSocketTelemetry) => void;
}

export const useWebSocketVitals = ({
  patientId,
  enabled = true,
  onUpdate,
}: UseWebSocketVitalsOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastReading, setLastReading] = useState<WebSocketTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!enabled || !patientId) return;

    let isUnmounted = false;

    const connect = () => {
      // Determine ws protocol and host
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/vitals/${patientId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: WebSocketTelemetry = JSON.parse(event.data);
            if (data.event === 'vital_update') {
              setLastReading(data);
              if (onUpdate) onUpdate(data);

              // Check if any real-time breaches were triggered and raise toasts
              if (data.alerts_triggered && data.alerts_triggered.length > 0) {
                data.alerts_triggered.forEach((alert) => {
                  addToast({
                    title: `Patient #${data.patient_id}: ${alert.type.replace('_', ' ').toUpperCase()}`,
                    message: alert.message,
                    type: alert.severity === 'critical' ? 'error' : 'warning',
                  });
                });
              }
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        ws.onerror = () => {
          if (isUnmounted) return;
          setError('WebSocket connection error');
          setIsConnected(false);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsConnected(false);
          // Try reconnecting after 3 seconds
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (!isUnmounted) connect();
          }, 3000);
        };
      } catch (err: any) {
        setError(err.message || 'Failed to initiate WebSocket');
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [patientId, enabled, onUpdate, addToast]);

  return { isConnected, lastReading, error };
};
