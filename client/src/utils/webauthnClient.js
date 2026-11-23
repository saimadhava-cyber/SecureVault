/**
 * SecureVault WebAuthn Client Utility
 * Handles device-level biometric registration (Face ID / Touch ID / Windows Hello)
 */

export const webauthnClient = {
  // Check if WebAuthn platform authenticator is supported by browser/device
  async isPlatformAuthenticatorAvailable() {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (e) {
        return false;
      }
    }
    return false;
  },

  // Convert base64url string to Uint8Array
  base64urlToUint8Array(base64url) {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },

  // Convert ArrayBuffer to base64url
  bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  },

  // Perform passkey registration
  async registerPasskey(challengeOptions) {
    const options = {
      publicKey: {
        challenge: this.base64urlToUint8Array(challengeOptions.challenge),
        rp: challengeOptions.rp,
        user: {
          id: this.base64urlToUint8Array(challengeOptions.user.id),
          name: challengeOptions.user.name,
          displayName: challengeOptions.user.displayName
        },
        pubKeyCredParams: challengeOptions.pubKeyCredParams,
        authenticatorSelection: challengeOptions.authenticatorSelection,
        timeout: challengeOptions.timeout || 60000
      }
    };

    const credential = await navigator.credentials.create(options);
    return {
      credentialId: this.bufferToBase64url(credential.rawId),
      type: credential.type
    };
  },

  // Perform passkey assertion login
  async authenticatePasskey(challengeOptions) {
    const options = {
      publicKey: {
        challenge: this.base64urlToUint8Array(challengeOptions.challenge),
        timeout: 60000,
        userVerification: 'required'
      }
    };

    if (challengeOptions.allowCredentials && challengeOptions.allowCredentials.length > 0) {
      options.publicKey.allowCredentials = challengeOptions.allowCredentials.map(c => ({
        id: this.base64urlToUint8Array(c.id),
        type: c.type
      }));
    }

    const assertion = await navigator.credentials.get(options);
    return {
      credentialId: this.bufferToBase64url(assertion.rawId)
    };
  }
};
