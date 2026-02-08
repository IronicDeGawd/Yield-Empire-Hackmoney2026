import '@testing-library/jest-dom';

// Mock WebSocket globally
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {}
  send(_data: string) {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
