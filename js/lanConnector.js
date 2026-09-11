/**
 * Pmail Web Client - Conector de Sincronización en Red Local (LAN)
 * Conecta la aplicación Web con la aplicación de PC cuando están en la misma red.
 */
class PmailLanConnector {
  /**
   * @param {string} [serverUrl='http://localhost:7890'] URL base del servidor de la PC
   */
  constructor(serverUrl = 'http://localhost:7890') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.isConnected = false;
    this.eventSource = null;
    this.listeners = new Set();
  }

  setServerUrl(url) {
    this.serverUrl = url.replace(/\/$/, '');
    if (this.eventSource) {
      this.disconnectEvents();
      this.connectEvents();
    }
  }

  /**
   * Verificar estado y conectividad con la app de PC
   */
  async checkStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        this.isConnected = true;
        return { connected: true, data };
      }
    } catch {
      this.isConnected = false;
    }
    return { connected: false };
  }

  /**
   * Obtener correos sincronizados desde la base de datos de la PC
   */
  async fetchEmails() {
    const response = await fetch(`${this.serverUrl}/api/emails`);
    if (!response.ok) throw new Error('Error al obtener correos del servidor LAN');
    const result = await response.json();
    return result.emails || [];
  }

  /**
   * Enviar o encolar correo a través del motor SMTP de la PC
   */
  async sendEmail(emailData) {
    const response = await fetch(`${this.serverUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });
    if (!response.ok) throw new Error('Error al despachar correo vía PC Host');
    return await response.json();
  }

  /**
   * Conectar canal de eventos push en tiempo real (Server-Sent Events)
   */
  connectEvents(onMessage) {
    if (this.eventSource) return;

    try {
      this.eventSource = new EventSource(`${this.serverUrl}/api/events`);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        if (onMessage) onMessage({ type: 'connected' });
      };

      this.eventSource.addEventListener('email_sent', (e) => {
        if (onMessage) onMessage({ type: 'email_sent', data: JSON.parse(e.data) });
      });

      this.eventSource.addEventListener('email_queued', (e) => {
        if (onMessage) onMessage({ type: 'email_queued', data: JSON.parse(e.data) });
      });

      this.eventSource.addEventListener('network_status', (e) => {
        if (onMessage) onMessage({ type: 'network_status', data: JSON.parse(e.data) });
      });

      this.eventSource.onerror = () => {
        this.isConnected = false;
        if (onMessage) onMessage({ type: 'disconnected' });
      };
    } catch (err) {
      console.warn('[PmailLanConnector] No se pudo abrir conexión de eventos:', err);
    }
  }

  disconnectEvents() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }
}

window.PmailLanConnector = PmailLanConnector;
