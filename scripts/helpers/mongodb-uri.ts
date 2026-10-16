export class ScriptMongoConfigError extends Error {}

/** Resolve the Docker MongoDB hostname for operator scripts running on the host. */
export function resolveScriptMongoUri(uri: string | undefined, containerHostname = 'mongodb'): string {
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new ScriptMongoConfigError('Configure MONGODB_URI no .env antes de executar o script.');
  }
  if (!uri.startsWith('mongodb://')) return uri;

  // Match the authority without parsing/re-encoding credentials or query parameters.
  const authority = /^(mongodb:\/\/)([^/?#]*)(.*)$/.exec(uri);
  if (!authority) return uri;
  const [, scheme, value, suffix] = authority;
  const separator = value.lastIndexOf('@');
  const credentials = value.slice(0, separator + 1);
  const hosts = value.slice(separator + 1);
  // Preserve SRV/replica-set topology and all hosts other than the configured container.
  if (hosts.includes(',')) return uri;
  const [hostname, port] = hosts.split(':');
  if (hostname.toLowerCase() !== containerHostname.toLowerCase()) return uri;
  return `${scheme}${credentials}127.0.0.1${port === undefined ? '' : `:${port}`}${suffix}`;
}
