import { test } from 'node:test';
import assert from 'node:assert';
import { greet } from '../../src/servers/example/greet.js';

test('greet tool - English greeting', async () => {
  const result = await greet.call({
    name: 'John',
    language: 'en'
  });

  assert.strictEqual(result.greeting, 'Hello, John!');
  assert.ok(result.timestamp);
  assert.ok(new Date(result.timestamp).getTime() > 0);
});

test('greet tool - Polish greeting', async () => {
  const result = await greet.call({
    name: 'Anna',
    language: 'pl'
  });

  assert.strictEqual(result.greeting, 'Cześć, Anna!');
  assert.ok(result.timestamp);
});

test('greet tool - Spanish greeting', async () => {
  const result = await greet.call({
    name: 'Maria',
    language: 'es'
  });

  assert.strictEqual(result.greeting, '¡Hola, Maria!');
  assert.ok(result.timestamp);
});

test('greet tool - default language is English', async () => {
  const result = await greet.call({
    name: 'Bob'
  });

  assert.strictEqual(result.greeting, 'Hello, Bob!');
});

test('greet tool - invalid input throws validation error', async () => {
  await assert.rejects(
    async () => {
      await greet.call({
        name: 123 // Invalid: should be string
      });
    },
    {
      name: 'ToolError',
      message: /Validation failed/
    }
  );
});
