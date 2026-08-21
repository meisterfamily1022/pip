const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Edge Functions are Deno, not React Native: they import from jsr: URLs and use
// Deno globals, neither of which this config can resolve. They are typechecked
// and linted by the Supabase CLI at deploy time instead.
module.exports = defineConfig([expoConfig, { ignores: ['supabase/functions/**'] }]);
