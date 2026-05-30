import { generateSecret } from '@codex-auth-ext/shared';
import type * as vscode from 'vscode';

const LOCAL_API_KEY_KEY = 'codexAuthExt.localApiKey';
const INTERNAL_CONTROL_SECRET_KEY = 'codexAuthExt.internalControlSecret';

export interface CredentialStore {
	getLocalApiKey(): Promise<string>;
	rotateLocalApiKey(): Promise<string>;
	getInternalControlSecret(): Promise<string>;
}

export class SecretStorageCredentialStore implements CredentialStore {
	constructor(private readonly secrets: vscode.SecretStorage) {}

	async getLocalApiKey(): Promise<string> {
		const existing = await this.secrets.get(LOCAL_API_KEY_KEY);

		if (existing) {
			return existing;
		}

		const created = generateSecret();
		await this.secrets.store(LOCAL_API_KEY_KEY, created);

		return created;
	}

	async rotateLocalApiKey(): Promise<string> {
		const created = generateSecret();
		await this.secrets.store(LOCAL_API_KEY_KEY, created);
		return created;
	}

	async getInternalControlSecret(): Promise<string> {
		const existing = await this.secrets.get(INTERNAL_CONTROL_SECRET_KEY);

		if (existing) {
			return existing;
		}

		const created = generateSecret();
		await this.secrets.store(INTERNAL_CONTROL_SECRET_KEY, created);

		return created;
	}
}

export class InMemoryCredentialStore implements CredentialStore {
	private localApiKey: string;
	private internalControlSecret: string;

	constructor(secrets?: { localApiKey?: string; internalControlSecret?: string }) {
		this.localApiKey = secrets?.localApiKey ?? generateSecret();
		this.internalControlSecret = secrets?.internalControlSecret ?? generateSecret();
	}

	async getLocalApiKey(): Promise<string> {
		return this.localApiKey;
	}

	async rotateLocalApiKey(): Promise<string> {
		this.localApiKey = generateSecret();
		return this.localApiKey;
	}

	async getInternalControlSecret(): Promise<string> {
		return this.internalControlSecret;
	}
}
