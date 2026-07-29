export interface InstallationTokenVerifier {
  verify(token: string): Promise<boolean>;
}

/** Local-only verifier. Production must use server-issued/signed credentials. */
export class LocalInstallationTokenVerifier implements InstallationTokenVerifier {
  async verify(token: string): Promise<boolean> {
    return /^inst_[A-Za-z0-9_-]{16,128}$/.test(token);
  }
}
