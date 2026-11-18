
export class EncryptionService {
  private key: CryptoKey | null = null;
  private iv: Uint8Array | null = null;
  private readonly secretKey: string;

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error("La clave de encriptación no está configurada");
    }
    this.secretKey = secretKey;
  }

  private async init() {
    if (this.key && this.iv) return;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secretKey);
    
    // Generar hash SHA-256 de la clave
    const hash = await window.crypto.subtle.digest('SHA-256', keyData);
    const hashArray = new Uint8Array(hash);

    // _key = keyBytes (32 bytes)
    // _iv = keyBytes.Take(16) -> primeros 16 bytes

    // Importar los 32 bytes como clave AES-CBC
    this.key = await window.crypto.subtle.importKey(
      'raw',
      hashArray,
      { name: 'AES-CBC' },
      false,
      ['encrypt', 'decrypt']
    );

    // Usar los primeros 16 bytes como IV
    this.iv = hashArray.slice(0, 16);
  }

  /**
   * Encripta un array de bytes y retorna un string Base64
   */
  public async encryptBytes(data: Uint8Array): Promise<string> {
    if (!data || data.length === 0) {
      throw new Error("Los datos no pueden estar vacíos");
    }

    await this.init();
    const key = this.key;
    const iv = this.iv;
    if (!key || !iv) throw new Error('Encryption not initialized');

    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv as BufferSource },
      key,
      data as BufferSource
    );

    return this.arrayBufferToBase64(encrypted);
  }

  /**
   * Desencripta un string Base64 a un array de bytes
   */
  public async decryptToBytes(encryptedData: string): Promise<Uint8Array> {
    if (!encryptedData) {
      throw new Error("Los datos encriptados no pueden estar vacíos");
    }

    await this.init();
    const key = this.key;
    const iv = this.iv;
    if (!key || !iv) throw new Error('Encryption not initialized');

    const data = this.base64ToArrayBuffer(encryptedData);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv as Uint8Array<ArrayBuffer> },
      key,
      data
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Encripta un string
   */
  public async encryptString(plainText: string): Promise<string> {
    if (!plainText) {
      throw new Error("El texto no puede estar vacío");
    }

    const encoder = new TextEncoder();
    const plainBytes = encoder.encode(plainText);
    return this.encryptBytes(plainBytes);
  }

  /**
   * Desencripta un string
   */
  public async decryptString(encryptedText: string): Promise<string> {
    const decryptedBytes = await this.decryptToBytes(encryptedText);
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
