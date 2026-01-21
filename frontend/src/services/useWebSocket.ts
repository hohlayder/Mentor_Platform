// src/hooks/useWebSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { websocketService, IncomingMessage, OutgoingMessage } from '../services/websocket';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    websocketService.onConnectionChange(handleConnectionChange);

    return () => {
      websocketService.offConnectionChange(handleConnectionChange);
    };
  }, []);

  const connect = useCallback((token: string) => {
    websocketService.setToken(token);
    websocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  const sendTextMessage = useCallback((chatId: string, content: string, replyTo?: string) => {
    websocketService.sendTextMessage(chatId, content, replyTo);
  }, []);

  const sendMessage = useCallback((message: OutgoingMessage) => {
    websocketService.sendMessage(message);
  }, []);

  const onChatMessage = useCallback((handler: (message: IncomingMessage) => void) => {
    websocketService.onChatMessage(handler);
    return () => websocketService.offMessage('message', handler);
  }, []);

  const onNotification = useCallback((handler: (notification: any) => void) => {
    websocketService.onNotification(handler);
    return () => websocketService.offMessage('notification', handler);
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    sendTextMessage,
    sendMessage,
    onChatMessage,
    onNotification
  };
};