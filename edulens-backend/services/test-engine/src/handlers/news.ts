/**
 * News CRUD — GET /news (public list), POST/PUT/DELETE /news/:id (admin)
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

function resp(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const newsId = event.pathParameters?.newsId;
    const db = await getDb();

    // GET /news — public list
    if (method === 'GET' && !newsId) {
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const category = event.queryStringParameters?.category;

      let where = 'WHERE is_published = true';
      const params: any[] = [];
      if (category) { params.push(category); where += ` AND category = $${params.length}`; }

      const posts = await query(
        `SELECT id, title, summary, content, category, image_url, published_at, created_at
         FROM news_posts ${where}
         ORDER BY published_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        ...params
      );

      const countResult = await query(
        `SELECT COUNT(*)::int as count FROM news_posts ${where}`,
        ...params
      );

      return resp(200, { success: true, posts, total: countResult[0]?.count || 0 });
    }

    // GET /news/:id — single post
    if (method === 'GET' && newsId) {
      const rows = await query(
        `SELECT * FROM news_posts WHERE id = $1::uuid`, newsId
      );
      if (!rows.length) return resp(404, { success: false, error: 'Post not found' });
      return resp(200, { success: true, post: rows[0] });
    }

    // POST /news — create
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await query(
        `INSERT INTO news_posts (title, summary, content, category, image_url, is_published, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
         RETURNING id`,
        body.title || '', body.summary || '', body.content || '',
        body.category || 'general', body.imageUrl || null,
        body.isPublished !== false, body.publishedAt || null
      );
      return resp(201, { success: true, id: result[0]?.id });
    }

    // PUT /news/:id — update
    if (method === 'PUT' && newsId) {
      const body = JSON.parse(event.body || '{}');
      await query(
        `UPDATE news_posts SET
          title = COALESCE($2, title),
          summary = COALESCE($3, summary),
          content = COALESCE($4, content),
          category = COALESCE($5, category),
          image_url = COALESCE($6, image_url),
          is_published = COALESCE($7, is_published),
          updated_at = NOW()
         WHERE id = $1::uuid`,
        newsId, body.title ?? null, body.summary ?? null, body.content ?? null,
        body.category ?? null, body.imageUrl ?? null, body.isPublished ?? null
      );
      return resp(200, { success: true });
    }

    // DELETE /news/:id
    if (method === 'DELETE' && newsId) {
      await query(`DELETE FROM news_posts WHERE id = $1::uuid`, newsId);
      return resp(200, { success: true });
    }

    return resp(400, { success: false, error: 'Invalid request' });
  } catch (error: any) {
    console.error('News handler error:', error);
    return resp(500, { success: false, error: error.message || 'Internal server error' });
  }
}
