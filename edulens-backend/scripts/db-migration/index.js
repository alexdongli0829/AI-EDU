/**
 * Database Migration Lambda
 * Runs SQL migrations against Aurora PostgreSQL from within VPC
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Get database credentials from Secrets Manager
 */
async function getDatabaseCredentials() {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is not set');
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );

  if (!response.SecretString) {
    throw new Error('Secret string is empty');
  }

  return JSON.parse(response.SecretString);
}

/**
 * Run SQL migration
 */
async function runMigration(client, sql) {
  console.log('Running migration...');

  // Split SQL into individual statements (separated by semicolons)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const results = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`Executing statement ${i + 1}/${statements.length}...`);

    try {
      const result = await client.query(statement);
      results.push({
        statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
        success: true,
        rowCount: result.rowCount,
      });
      console.log(`✓ Statement ${i + 1} completed (${result.rowCount} rows affected)`);
    } catch (error) {
      console.error(`✗ Statement ${i + 1} failed:`, error.message);
      results.push({
        statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
        success: false,
        error: error.message,
      });
      // Continue with other statements even if one fails
    }
  }

  return results;
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Starting database migration...');

  try {
    // Get database credentials
    console.log('Fetching database credentials...');
    const credentials = await getDatabaseCredentials();
    const { host, port, dbname, username, password } = credentials;

    console.log(`Connecting to database: ${host}:${port}/${dbname}`);

    // Create PostgreSQL client
    const client = new Client({
      host,
      port,
      database: dbname,
      user: username,
      password,
      ssl: {
        rejectUnauthorized: false, // Aurora uses self-signed certs
      },
    });

    await client.connect();
    console.log('Connected to database successfully');

    // Read migration SQL file
    const sqlPath = path.join(__dirname, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Read migration file (${sql.length} characters)`);

    // Run migration
    const results = await runMigration(client, sql);

    // Disconnect
    await client.end();
    console.log('Disconnected from database');

    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    const response = {
      statusCode: failureCount === 0 ? 200 : 500,
      body: JSON.stringify({
        message: `Migration completed: ${successCount} succeeded, ${failureCount} failed`,
        success: failureCount === 0,
        results,
      }, null, 2),
    };

    console.log('Migration completed:', response.body);
    return response;

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Migration failed',
        success: false,
        error: error.message,
        stack: error.stack,
      }, null, 2),
    };
  }
};
