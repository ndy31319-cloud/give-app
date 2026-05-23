require('dotenv').config();

const http = require('http');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 4000;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : undefined,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      nickname VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      code VARCHAR(20) NOT NULL UNIQUE,
      certificate_number VARCHAR(20) NOT NULL UNIQUE,
      phone VARCHAR(50),
      role VARCHAR(30) NOT NULL DEFAULT 'user',
      location VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'etc',
      location VARCHAR(255),
      image_url TEXT,
      description TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_posts_category (category),
      INDEX idx_posts_status (status),
      CONSTRAINT fk_posts_member
        FOREIGN KEY (member_id) REFERENCES members(id)
        ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wanted_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      category VARCHAR(50) NOT NULL DEFAULT 'etc',
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wanted_category (category),
      INDEX idx_wanted_status (status),
      CONSTRAINT fk_wanted_member
        FOREIGN KEY (member_id) REFERENCES members(id)
        ON DELETE SET NULL
    )
  `);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getPathname(req) {
  return new URL(req.url, `http://${req.headers.host}`).pathname;
}

function getSearchParams(req) {
  return new URL(req.url, `http://${req.headers.host}`).searchParams;
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  return auth.replace(/^Bearer\s+/i, '');
}

function normalizeMember(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    role: row.role,
    location: row.location,
    code: row.code,
    certificate_number: row.certificate_number,
  };
}

function normalizePost(row) {
  return {
    id: row.id,
    post_id: row.id,
    title: row.title,
    category: row.category,
    location: row.location || '',
    image: row.image_url || '',
    img: row.image_url || '',
    description: row.description || '',
    status: row.status,
    created_at: row.created_at,
  };
}

function normalizeWantedPost(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content || '',
    category: row.category,
    status: row.status,
    created_at: row.created_at,
  };
}

async function findUserByToken(token) {
  if (!token) return null;

  const match = /^dev-token-(\d+)$/.exec(token);
  if (!match) return null;

  const [rows] = await pool.execute(
    'SELECT * FROM members WHERE id = ? LIMIT 1',
    [Number(match[1])]
  );

  return rows[0] || null;
}

async function requireAuth(req, res) {
  const user = await findUserByToken(getToken(req));

  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }

  return user;
}

async function createMemberCode() {
  for (let index = 0; index < 20; index += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const [rows] = await pool.execute(
      'SELECT id FROM members WHERE code = ? OR certificate_number = ? LIMIT 1',
      [code, code]
    );

    if (rows.length === 0) {
      return code;
    }
  }

  throw new Error('회원코드를 생성하지 못했습니다.');
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = getPathname(req);

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      await pool.query('SELECT 1');
      sendJson(res, 200, { ok: true, service: 'givegive-backend', db: 'mysql' });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      const email = body.email || body.id;
      const password = body.member_pw || body.password;
      const [rows] = await pool.execute(
        'SELECT * FROM members WHERE email = ? AND password = ? LIMIT 1',
        [email, password]
      );
      const user = rows[0];

      if (!user) {
        sendJson(res, 401, { error: '이메일 또는 비밀번호가 맞지 않습니다.' });
        return;
      }

      sendJson(res, 200, {
        accessToken: `dev-token-${user.id}`,
        tokenType: 'Bearer',
        member: normalizeMember(user),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/members/signup') {
      const body = await readBody(req);
      const email = body.email || body.id;
      const password = body.password || body.member_pw || '';

      if (!body.name || !email || !password) {
        sendJson(res, 400, { error: '이름, 아이디, 비밀번호를 입력해주세요.' });
        return;
      }

      const [duplicatedRows] = await pool.execute(
        'SELECT id FROM members WHERE email = ? LIMIT 1',
        [email]
      );

      if (duplicatedRows.length > 0) {
        sendJson(res, 409, { error: '이미 가입된 아이디입니다.' });
        return;
      }

      const code = body.certificate_number || body.code || body.member_code || await createMemberCode();
      const [result] = await pool.execute(
        `INSERT INTO members
          (name, nickname, email, password, code, certificate_number, phone, role, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.name,
          body.nickname || body.name,
          email,
          password,
          code,
          code,
          body.phone || '',
          body.role || 'user',
          body.location || '',
        ]
      );

      sendJson(res, 201, {
        id: result.insertId,
        name: body.name,
        nickname: body.nickname || body.name,
        code,
        certificate_number: code,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/code-login') {
      const body = await readBody(req);
      const code = body.code || body.certificate_number || body.member_code;
      const [rows] = await pool.execute(
        'SELECT * FROM members WHERE code = ? OR certificate_number = ? LIMIT 1',
        [code, code]
      );
      const user = rows[0];

      if (!user) {
        sendJson(res, 401, { error: '회원코드가 맞지 않습니다.' });
        return;
      }

      sendJson(res, 200, {
        accessToken: `dev-token-${user.id}`,
        tokenType: 'Bearer',
        postId: body.postId || null,
        member: normalizeMember(user),
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/members/me') {
      const user = await requireAuth(req, res);
      if (!user) return;

      sendJson(res, 200, normalizeMember(user));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/posts') {
      const searchParams = getSearchParams(req);
      const category = searchParams.get('category');
      const page = Math.max(0, Number(searchParams.get('page') || 0));
      const size = Math.max(1, Number(searchParams.get('size') || 50));
      const offset = page * size;

      const where = category && category !== 'all' ? 'WHERE category = ?' : '';
      const params = category && category !== 'all' ? [category] : [];
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS count FROM posts ${where}`,
        params
      );
      const [rows] = await pool.execute(
        `SELECT * FROM posts ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, size, offset]
      );
      const content = rows.map(normalizePost);
      const totalElements = countRows[0].count;

      sendJson(res, 200, {
        content,
        posts: content,
        totalElements,
        totalPages: Math.max(1, Math.ceil(totalElements / size)),
        page,
        size,
      });
      return;
    }

    const postDetailMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
    if (req.method === 'GET' && postDetailMatch) {
      const [rows] = await pool.execute(
        'SELECT * FROM posts WHERE id = ? LIMIT 1',
        [Number(postDetailMatch[1])]
      );

      if (!rows[0]) {
        sendJson(res, 404, { error: 'Post not found' });
        return;
      }

      sendJson(res, 200, normalizePost(rows[0]));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/posts') {
      const user = await requireAuth(req, res);
      if (!user) return;

      const body = await readBody(req);
      const [result] = await pool.execute(
        `INSERT INTO posts
          (member_id, title, category, location, image_url, description, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          body.title || '새 물품',
          body.category || 'etc',
          body.location || user.location || '',
          body.image || body.img || '',
          body.description || '',
          'AVAILABLE',
        ]
      );
      const [rows] = await pool.execute('SELECT * FROM posts WHERE id = ?', [result.insertId]);

      sendJson(res, 201, normalizePost(rows[0]));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/wanted') {
      const [rows] = await pool.execute(
        'SELECT * FROM wanted_posts ORDER BY id DESC'
      );
      const content = rows.map(normalizeWantedPost);

      sendJson(res, 200, {
        content,
        posts: content,
        totalElements: content.length,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/wanted') {
      const body = await readBody(req);
      const user = await findUserByToken(getToken(req));
      const [result] = await pool.execute(
        `INSERT INTO wanted_posts
          (member_id, title, content, category, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user?.id || null,
          body.title || '필요한 물품',
          body.content || body.description || '',
          body.category || 'etc',
          'OPEN',
        ]
      );
      const [rows] = await pool.execute('SELECT * FROM wanted_posts WHERE id = ?', [result.insertId]);

      sendJson(res, 201, normalizeWantedPost(rows[0]));
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

const server = http.createServer(handleRequest);

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      console.log(`MySQL connected to ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });
