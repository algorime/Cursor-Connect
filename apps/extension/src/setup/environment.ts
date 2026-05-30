export function detectExtensionHostEnvironment(remoteName: string | undefined): string {
	if (!remoteName) {
		return 'Local extension host';
	}

	if (remoteName === 'wsl') {
		return 'WSL extension host';
	}

	if (remoteName === 'ssh-remote') {
		return 'Remote SSH extension host';
	}

	if (remoteName === 'dev-container' || remoteName === 'attached-container') {
		return 'Dev Container extension host';
	}

	if (remoteName === 'codespaces') {
		return 'Codespaces extension host';
	}

	return `${remoteName} extension host`;
}
