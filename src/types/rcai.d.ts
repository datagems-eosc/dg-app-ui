export {};

declare global {
  interface Window {
    rcaiChatSessionId?: string;
    __DG_PUBLIC_ENV__?: {
      APP_BASE_URL?: string;
      RCAI_BACKEND_URL?: string;
      RCAI_BACKEND_WEBSOCKET_URL?: string;
    };
  }
}
