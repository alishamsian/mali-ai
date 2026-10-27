/**
 * Replaces process.env.<NAME> with a string literal at build time, for an allow-list
 * of names, reading values from the environment first and then from .env.
 * Metro caches transformed files: after editing .env run `npm start -- --reset-cache`.
 */
const fs = require('fs');
const path = require('path');

function parseDotEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

module.exports = function inlineEnv({ types: t }, options = {}) {
  const names = new Set(options.names ?? []);
  const fromFile = parseDotEnv(options.envFile ?? path.join(__dirname, '..', '.env'));
  const valueOf = name => process.env[name] ?? fromFile[name] ?? '';

  return {
    name: 'inline-env',
    visitor: {
      MemberExpression(nodePath) {
        const { node } = nodePath;
        const object = node.object;
        if (
          !t.isMemberExpression(object) ||
          !t.isIdentifier(object.object, { name: 'process' }) ||
          !t.isIdentifier(object.property, { name: 'env' }) ||
          object.computed
        ) {
          return;
        }
        const name = node.computed
          ? t.isStringLiteral(node.property) && node.property.value
          : t.isIdentifier(node.property) && node.property.name;
        if (name && names.has(name)) {
          nodePath.replaceWith(t.stringLiteral(valueOf(name)));
        }
      },
    },
  };
};

module.exports.parseDotEnv = parseDotEnv;
