import { describe, expect, it } from 'vitest';
import { resolveScriptMongoUri, ScriptMongoConfigError } from '../mongodb-uri.js';

describe('URI MongoDB dos scripts locais', () => {
  it.each([
    ['mongodb://mongodb:27017/shekinah', 'mongodb://127.0.0.1:27017/shekinah'],
    ['mongodb://mongodb/shekinah', 'mongodb://127.0.0.1/shekinah'],
    ['mongodb://mongodb:27018', 'mongodb://127.0.0.1:27018'],
    ['mongodb://MONGODB:27017/shekinah', 'mongodb://127.0.0.1:27017/shekinah'],
    ['mongodb://operator:p%40ss%3Aword@mongodb:27017/shekinah?authSource=admin&retryWrites=true', 'mongodb://operator:p%40ss%3Aword@127.0.0.1:27017/shekinah?authSource=admin&retryWrites=true'],
  ])('adapta somente o hostname em %s', (uri, expected) => {
    expect(resolveScriptMongoUri(uri)).toBe(expected);
  });
  it.each([
    'mongodb://127.0.0.1:27017/shekinah',
    'mongodb://localhost:27017/shekinah',
    'mongodb://db.example.com:27017/shekinah',
    'mongodb://mongodb.example.com:27017/shekinah',
    'mongodb+srv://operator:secret@mongodb/shekinah?authSource=admin',
    'mongodb://mongodb:27017,secondary:27017/shekinah?replicaSet=rs0',
    'mongodb://[::1]:27017/shekinah',
    'mongodb://mongodb:secret@remote.example.com:27017/mongodb?appName=mongodb',
  ])('preserva a URI que não deve ser redirecionada: %s', uri => {
    expect(resolveScriptMongoUri(uri)).toBe(uri);
  });
  it('permite reutilização com outro nome de contêiner explícito', () => {
    expect(resolveScriptMongoUri('mongodb://mongo-local:27017/db', 'mongo-local')).toBe('mongodb://127.0.0.1:27017/db');
  });
  it.each([undefined, '', 'https://mongodb/shekinah'])('rejeita configuração ausente ou protocolo incorreto', uri => {
    expect(() => resolveScriptMongoUri(uri)).toThrow(ScriptMongoConfigError);
  });
  it('não altera a variável original de ambiente', () => {
    const env = { MONGODB_URI: 'mongodb://mongodb:27017/shekinah' };
    resolveScriptMongoUri(env.MONGODB_URI);
    expect(env.MONGODB_URI).toBe('mongodb://mongodb:27017/shekinah');
  });
});
