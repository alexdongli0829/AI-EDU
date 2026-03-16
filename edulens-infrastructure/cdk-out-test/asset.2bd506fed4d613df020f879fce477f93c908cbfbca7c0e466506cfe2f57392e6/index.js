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
 *
 * Executes the SQL as-is via a single pg.query() call so that
 * dollar-quoted PL/pgSQL function bodies ($$...$$) are not split
 * incorrectly by a naive semicolon splitter.
 */
async function runMigration(client, sql) {
  console.log('Running migration as single query...');
  try {
    await client.query(sql);
    console.log('✓ Migration query completed');
    return [{ success: true, message: 'Full migration SQL executed successfully' }];
  } catch (error) {
    console.error('✗ Migration query failed:', error.message);
    return [{ success: false, error: error.message }];
  }
}

/**
 * Lambda handler
 *
 * Handles two invocation modes:
 * 1. CloudFormation custom resource event (has RequestType field) — returns
 *    a short PhysicalResourceId response so CFN size limits are not exceeded.
 * 2. Direct Lambda invocation (manual or CLI) — returns full statement results.
 */
exports.handler = async (event) => {
  console.log('Starting database migration...');
  const isCfnEvent = !!(event && event.RequestType);

  try {
    const credentials = await getDatabaseCredentials();
    const { host, port, dbname, username, password } = credentials;

    console.log(`Connecting to database: ${host}:${port}/${dbname}`);

    const client = new Client({
      host,
      port: port || 5432,
      database: dbname,
      user: username,
      password,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('Connected to database successfully');

    // Allow overriding SQL via direct invocation payload (e.g. {"sql":"SELECT ..."})
    let sql;
    if (!isCfnEvent && event && event.sql) {
      sql = event.sql;
    } else {
      const sqlPath = path.join(__dirname, 'migration.sql');
      sql = fs.readFileSync(sqlPath, 'utf8');
    }
    console.log(`Running SQL (${sql.length} characters)...`);

    const results = await runMigration(client, sql);

    await client.end();
    console.log('Disconnected from database');

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const message = `Migration completed: ${successCount} succeeded, ${failureCount} failed`;
    console.log(message);

    // CloudFormation custom resource: return compact response to stay within 4 KB limit
    if (isCfnEvent) {
      return {
        PhysicalResourceId: `edulens-db-migration-${Date.now()}`,
        Data: { message, successCount, failureCount },
      };
    }

    // Direct invocation: return full results
    return {
      statusCode: failureCount === 0 ? 200 : 500,
      body: JSON.stringify({ message, success: failureCount === 0, results }, null, 2),
    };

  } catch (error) {
    console.error('Migration failed:', error);
    if (isCfnEvent) {
      // Throwing causes CloudFormation to mark the custom resource as FAILED
      throw error;
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Migration failed', error: error.message }, null, 2),
    };
  }
};
