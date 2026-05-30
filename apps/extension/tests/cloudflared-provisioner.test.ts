import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';

import { CLOUDFLARED_SUPPLY_CHAIN_DECISION, CloudflaredProvisioner } from '../src/setup/cloudflared-provisioner.js';

describe('CloudflaredProvisioner', () => {
	it('records the pinned supply-chain decision before tunnel execution code', () => {
		expect(CLOUDFLARED_SUPPLY_CHAIN_DECISION).toMatchObject({
			strategy: 'pinned-extension-owned-download',
			version: '2026.5.1',
			updatePolicy: 'explicit-repair-only'
		});
	});

	it('maps supported platforms to pinned cloudflared assets', async () => {
		const provisioner = new CloudflaredProvisioner({
			platform: 'linux',
			arch: 'x64',
			cacheDir: '/tmp/codex-cloudflared',
			fileExists: async () => false,
			download: async () => Buffer.from('binary'),
			sha256: async () => CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets['linux-x64'].sha256,
			writeExecutable: async () => undefined
		});

		await expect(provisioner.provision()).resolves.toMatchObject({
			status: 'ready',
			asset: expect.objectContaining({ name: expect.stringContaining('linux-amd64') })
		});
	});

	it('fails closed on checksum mismatch and unsupported platforms', async () => {
		const badChecksum = new CloudflaredProvisioner({
			platform: 'linux',
			arch: 'x64',
			cacheDir: '/tmp/codex-cloudflared',
			fileExists: async () => false,
			download: async () => Buffer.from('binary'),
			sha256: async () => 'wrong',
			writeExecutable: async () => undefined
		});
		const unsupported = new CloudflaredProvisioner({
			platform: 'aix',
			arch: 'ppc64',
			cacheDir: '/tmp/codex-cloudflared'
		});

		await expect(badChecksum.provision()).resolves.toMatchObject({ status: 'integrity_failed' });
		await expect(unsupported.provision()).resolves.toMatchObject({ status: 'unsupported_platform' });
	});

	it('verifies cached binaries before returning ready', async () => {
		const writes: string[] = [];
		const provisioner = new CloudflaredProvisioner({
			platform: 'linux',
			arch: 'x64',
			cacheDir: '/tmp/codex-cloudflared',
			fileExists: async () => true,
			readFile: async () => Buffer.from('cached-binary'),
			download: async () => Buffer.from('fresh-binary'),
			sha256: async (bytes) => bytes.toString() === 'cached-binary'
				? 'bad-cache'
				: CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets['linux-x64'].sha256,
			writeExecutable: async (file) => { writes.push(file); }
		});

		await expect(provisioner.provision()).resolves.toMatchObject({ status: 'ready' });
		expect(writes).toHaveLength(1);
	});

	it('extracts darwin tgz assets and writes the executable, not the archive', async () => {
		const archive = createTarGz('cloudflared', Buffer.from('darwin-binary'));
		let writtenFile = '';
		let writtenBytes = Buffer.alloc(0);
		let cachedFile = '';
		const provisioner = new CloudflaredProvisioner({
			platform: 'darwin',
			arch: 'arm64',
			cacheDir: '/tmp/codex-cloudflared',
			fileExists: async () => false,
			download: async () => archive,
			sha256: async () => CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets['darwin-arm64'].sha256,
			writeCacheFile: async (file) => {
				cachedFile = file;
			},
			writeExecutable: async (file, bytes) => {
				writtenFile = file;
				writtenBytes = bytes;
			}
		});

		await expect(provisioner.provision()).resolves.toMatchObject({
			status: 'ready',
			binaryPath: expect.stringMatching(/cloudflared-darwin-arm64$/)
		});
		expect(writtenFile).toMatch(/cloudflared-darwin-arm64$/);
		expect(cachedFile).toMatch(/cloudflared-darwin-arm64\.tgz$/);
		expect(writtenBytes.toString()).toBe('darwin-binary');
	});

	it('uses verified darwin archive cache without redownloading stale extracted binaries', async () => {
		const archive = createTarGz('cloudflared', Buffer.from('darwin-binary'));
		let downloaded = false;
		let restoredBytes = Buffer.alloc(0);
		const provisioner = new CloudflaredProvisioner({
			platform: 'darwin',
			arch: 'arm64',
			cacheDir: '/tmp/codex-cloudflared',
			fileExists: async (file) => file.endsWith('.tgz') || file.endsWith('cloudflared-darwin-arm64'),
			readFile: async (file) => file.endsWith('.tgz') ? archive : Buffer.from('tampered-binary'),
			download: async () => {
				downloaded = true;
				return archive;
			},
			sha256: async (bytes) => bytes.equals(archive)
				? CLOUDFLARED_SUPPLY_CHAIN_DECISION.assets['darwin-arm64'].sha256
				: 'not-the-archive',
			writeExecutable: async (_file, bytes) => {
				restoredBytes = bytes;
			}
		});

		await expect(provisioner.provision()).resolves.toMatchObject({ status: 'ready' });
		expect(downloaded).toBe(false);
		expect(restoredBytes.toString()).toBe('darwin-binary');
	});
});

function createTarGz(name: string, bytes: Buffer): Buffer {
	const header = Buffer.alloc(512);
	header.write(name);
	header.write('0000700', 100);
	header.write('0000000', 108);
	header.write('0000000', 116);
	header.write(bytes.length.toString(8).padStart(11, '0'), 124);
	header.write('00000000000', 136);
	header.fill(' ', 148, 156);
	header[156] = '0'.charCodeAt(0);
	header.write('ustar', 257);
	let sum = 0;
	for (const byte of header) sum += byte;
	header.write(sum.toString(8).padStart(6, '0'), 148);
	header[154] = 0;
	header[155] = 32;

	const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512);
	return gzipSync(Buffer.concat([header, bytes, padding, Buffer.alloc(1024)]));
}
