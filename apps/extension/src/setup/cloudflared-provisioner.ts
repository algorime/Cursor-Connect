import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export interface CloudflaredAsset {
	name: string;
	url: string;
	sha256: string;
	executableName?: string;
}

export const CLOUDFLARED_SUPPLY_CHAIN_DECISION = {
	strategy: 'pinned-extension-owned-download',
	version: '2026.5.1',
	checksumSource: 'GitHub release asset digest fields for cloudflare/cloudflared 2026.5.1',
	installScope: 'extension-owned globalStorage cache',
	updatePolicy: 'explicit-repair-only',
	assets: {
		'linux-x64': {
			name: 'cloudflared-linux-amd64',
			url: 'https://github.com/cloudflare/cloudflared/releases/download/2026.5.1/cloudflared-linux-amd64',
			sha256: '3c6a5ba995a258dbe90f98e5fdb2c2620b7be72c3ca761614f6eb52aee252cea'
		},
		'linux-arm64': {
			name: 'cloudflared-linux-arm64',
			url: 'https://github.com/cloudflare/cloudflared/releases/download/2026.5.1/cloudflared-linux-arm64',
			sha256: '7b7a8b9a2764acab0fecda633cb54a6c0df42d7f8ca1ec45c78333c2227d8d91'
		},
		'darwin-x64': {
			name: 'cloudflared-darwin-amd64.tgz',
			url: 'https://github.com/cloudflare/cloudflared/releases/download/2026.5.1/cloudflared-darwin-amd64.tgz',
			sha256: '1389ce2cff3ec7ee777d7bed43253e433aa2521b9b00cc42ccf0066a4d971149',
			executableName: 'cloudflared-darwin-amd64'
		},
		'darwin-arm64': {
			name: 'cloudflared-darwin-arm64.tgz',
			url: 'https://github.com/cloudflare/cloudflared/releases/download/2026.5.1/cloudflared-darwin-arm64.tgz',
			sha256: 'af75f2fa11a42de1ceaa0345537c51d3c86915748e65bc2c6680983dfd36ae74',
			executableName: 'cloudflared-darwin-arm64'
		},
		'win32-x64': {
			name: 'cloudflared-windows-amd64.exe',
			url: 'https://github.com/cloudflare/cloudflared/releases/download/2026.5.1/cloudflared-windows-amd64.exe',
			sha256: '8b97b5af442651e07c52caa9c79c6f60032bc10b675c2b36dd11c7690d9942e3'
		}
	} satisfies Record<string, CloudflaredAsset>
} as const;

export type ProvisionResultStatus = 'ready' | 'unsupported_platform' | 'download_failed' | 'integrity_failed' | 'permission_failed';

export interface ProvisionResult {
	status: ProvisionResultStatus;
	binaryPath?: string;
	asset?: CloudflaredAsset;
	message?: string;
}

export interface CloudflaredProvisionerOptions {
	platform?: string;
	arch?: string;
	cacheDir: string;
	fileExists?: (file: string) => Promise<boolean>;
	readFile?: (file: string) => Promise<Buffer>;
	download?: (asset: CloudflaredAsset) => Promise<Buffer>;
	sha256?: (bytes: Buffer) => Promise<string>;
	writeExecutable?: (file: string, bytes: Buffer) => Promise<void>;
	writeCacheFile?: (file: string, bytes: Buffer) => Promise<void>;
}

export class CloudflaredProvisioner {
	constructor(private readonly options: CloudflaredProvisionerOptions) {}

	async provision(): Promise<ProvisionResult> {
		const asset = resolveAsset(this.options.platform ?? process.platform, this.options.arch ?? process.arch);
		if (!asset) {
			return { status: 'unsupported_platform', message: 'cloudflared is not pinned for this platform/architecture' };
		}

		const versionCacheDir = path.join(this.options.cacheDir, CLOUDFLARED_SUPPLY_CHAIN_DECISION.version);
		const assetPath = path.join(versionCacheDir, asset.name);
		const binaryPath = path.join(versionCacheDir, asset.executableName ?? asset.name);
		const cached = await this.tryUseVerifiedCache(asset, assetPath, binaryPath);
		if (cached) {
			return cached;
		}

		let bytes: Buffer;
		try {
			bytes = await (this.options.download ?? defaultDownload)(asset);
		} catch {
			return { status: 'download_failed', asset, message: 'cloudflared download failed' };
		}

		const digest = await (this.options.sha256 ?? defaultSha256)(bytes);
		if (digest !== asset.sha256) {
			return { status: 'integrity_failed', asset, message: 'cloudflared checksum mismatch' };
		}

		try {
			if (asset.executableName) {
				await (this.options.writeCacheFile ?? defaultWriteCacheFile)(assetPath, bytes);
			}
			await (this.options.writeExecutable ?? defaultWriteExecutable)(binaryPath, extractExecutable(asset, bytes));
		} catch {
			return { status: 'permission_failed', asset, message: 'cloudflared could not be written to extension cache' };
		}

		return { status: 'ready', binaryPath, asset };
	}

	private async tryUseVerifiedCache(asset: CloudflaredAsset, assetPath: string, binaryPath: string): Promise<ProvisionResult | null> {
		const fileExists = this.options.fileExists ?? defaultFileExists;
		const read = this.options.readFile ?? defaultReadFile;
		const sha256 = this.options.sha256 ?? defaultSha256;

		if (!asset.executableName) {
			if (!await fileExists(binaryPath)) {
				return null;
			}
			const cached = await read(binaryPath);
			return await sha256(cached) === asset.sha256 ? { status: 'ready', binaryPath, asset } : null;
		}

		if (!await fileExists(assetPath)) {
			return null;
		}
		const archive = await read(assetPath);
		if (await sha256(archive) !== asset.sha256) {
			return null;
		}

		const executableBytes = extractExecutable(asset, archive);
		if (await fileExists(binaryPath)) {
			const binary = await read(binaryPath);
			if (binary.equals(executableBytes)) {
				return { status: 'ready', binaryPath, asset };
			}
		}

		try {
			await (this.options.writeExecutable ?? defaultWriteExecutable)(binaryPath, executableBytes);
		} catch {
			return { status: 'permission_failed', asset, message: 'cloudflared could not be restored from verified cache' };
		}
		return { status: 'ready', binaryPath, asset };
	}
}

export function resolveAsset(platform: string, arch: string): CloudflaredAsset | null {
	const key = `${platform}-${arch}`;
	return CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets[key as keyof typeof CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets] ?? null;
}

async function defaultFileExists(file: string): Promise<boolean> {
	return existsSync(file);
}

async function defaultDownload(asset: CloudflaredAsset): Promise<Buffer> {
	const response = await fetch(asset.url);
	if (!response.ok) throw new Error('download failed');
	return Buffer.from(await response.arrayBuffer());
}

async function defaultReadFile(file: string): Promise<Buffer> {
	return readFile(file);
}

async function defaultSha256(bytes: Buffer): Promise<string> {
	return createHash('sha256').update(bytes).digest('hex');
}

async function defaultWriteExecutable(file: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, bytes, { mode: 0o700 });
	await chmod(file, 0o700);
}

async function defaultWriteCacheFile(file: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, bytes, { mode: 0o600 });
}

function extractExecutable(asset: CloudflaredAsset, bytes: Buffer): Buffer {
	if (!asset.name.endsWith('.tgz')) {
		return bytes;
	}

	const tar = gunzipSync(bytes);
	for (let offset = 0; offset + 512 <= tar.length;) {
		const header = tar.subarray(offset, offset + 512);
		const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
		const sizeText = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
		const size = Number.parseInt(sizeText || '0', 8);
		offset += 512;

		if (!name && size === 0) {
			break;
		}

		const fileBytes = tar.subarray(offset, offset + size);
		if (path.basename(name) === 'cloudflared') {
			return Buffer.from(fileBytes);
		}

		offset += Math.ceil(size / 512) * 512;
	}

	throw new Error('cloudflared executable missing from archive');
}
