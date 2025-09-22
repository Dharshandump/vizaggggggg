import { useState, useEffect, useRef } from 'react';

interface TrafficUpdate {
  location: string;
  queue: number;
  stopDensity: number;
  accidents: number;
  fatalities: number;
  congestionScore: number;
  congestionLevel: string;
  timestamp: string;
}

interface TrafficAlert {
  location: string;
  alert: string;
  severity: 'High' | 'Medium' | 'Low';
  timestamp: string;
}

interface WebSocketMessage {
  type: 'connection' | 'traffic_update' | 'traffic_alert';
  data?: TrafficUpdate[] | TrafficAlert;
  message?: string;
  timestamp: string;
}

export function useRealTimeTraffic() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [currentUpdates, setCurrentUpdates] = useState<TrafficUpdate[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<TrafficAlert[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Use polling for Vercel deployment since WebSockets aren't supported
    let pollInterval: NodeJS.Timeout;
    
    function startPolling() {
      try {
        setIsConnected(true);
        setConnectionError(null);
        
        pollInterval = setInterval(async () => {
          try {
            const response = await fetch('/api/websocket');
            if (response.ok) {
              const data = await response.json();
              
              if (data.type === 'traffic_update' && Array.isArray(data.data)) {
                setCurrentUpdates(data.data);
                setLastUpdate(data.timestamp);
              }
              
              if (data.alert) {
                setRecentAlerts(prev => {
                  const newAlerts = [data.alert, ...prev.slice(0, 4)];
                  return newAlerts;
                });
              }
            }
          } catch (error) {
            console.error('Polling error:', error);
            setConnectionError('Connection failed');
            setIsConnected(false);
          }
        }, 10000); // Poll every 10 seconds
        
      } catch (error) {
        console.error('Failed to start polling:', error);
        setConnectionError('Failed to connect');
        setIsConnected(false);
      }
    }

    startPolling();

    // Cleanup on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const getTopCongestionAreas = () => {
    return currentUpdates
      .sort((a, b) => b.congestionScore - a.congestionScore)
      .slice(0, 5);
  };

  const getTotalLiveAccidents = () => {
    return currentUpdates.reduce((sum, update) => sum + update.accidents, 0);
  };

  return {
    isConnected,
    lastUpdate,
    currentUpdates,
    recentAlerts,
    connectionError,
    getTopCongestionAreas,
    getTotalLiveAccidents
  };
}