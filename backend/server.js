const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const seedData = {
  users: [],
  posts: [],
  wantedPosts: [],
};

function createMemberCode(db) {
  let code = '';

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (db.users.some((user) => (
    user.code === code
    || user.certificate_number === code
    || user.password === code
    || user.nickname === code
  )));

  return code;
}

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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

function getToken(req) {
  const auth = req.headers.authorization || '';
  return auth.replace(/^Bearer\s+/i, '');
}

function findUserByToken(db, token) {
  if (!token) return null;
  const match = /^dev-token-(\d+)$/.exec(token);
  if (!match) return null;
  return db.users.find((user) => user.id === Number(match[1])) || null;
}

function requireAuth(req, res, db) {
  const user = findUserByToken(db, getToken(req));
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function normalizePost(post) {
  return {
    ...post,
    post_id: post.post_id || post.id,
    img: post.image,
  };
}

function getPathname(req) {
  return new URL(req.url, `http://${req.headers.host}`).pathname;
}

function getSearchParams(req) {
  return new URL(req.url, `http://${req.headers.host}`).searchParams;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const db = readDb();
  const pathname = getPathname(req);

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'givegive-backend' });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(req);
      const email = body.email || body.id;
      const password = body.member_pw || body.password;
      const user = db.users.find((item) => item.email === email && item.password === password);

      if (!user) {
        sendJson(res, 401, { error: '이메일 또는 비밀번호가 맞지 않습니다.' });
        return;
      }

      sendJson(res, 200, {
        accessToken: `dev-token-${user.id}`,
        tokenType: 'Bearer',
        member: {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
        },
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/members/signup') {
      const body = await readBody(req);
      const code = body.certificate_number || body.code || body.member_code || createMemberCode(db);

      if (!body.name) {
        sendJson(res, 400, { error: '이름을 입력해주세요.' });
        return;
      }

      const isDuplicatedCode = db.users.some((item) => (
        item.code === code
        || item.certificate_number === code
        || item.password === code
        || item.nickname === code
      ));

      if (isDuplicatedCode) {
        sendJson(res, 409, { error: '이미 등록된 회원코드입니다.' });
        return;
      }

      const nextId = Math.max(0, ...db.users.map((user) => user.id)) + 1;
      const newUser = {
        id: nextId,
        name: body.name,
        nickname: body.nickname || body.name,
        email: body.email || `member${nextId}@givegive.local`,
        password: body.password || body.member_pw || '',
        code,
        certificate_number: code,
        phone: body.phone || '',
        role: body.role || 'user',
        location: body.location || '',
      };

      db.users.push(newUser);
      writeDb(db);
      sendJson(res, 201, {
        id: newUser.id,
        name: newUser.name,
        nickname: newUser.nickname,
        code: newUser.code,
        certificate_number: newUser.certificate_number,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/code-login') {
      const body = await readBody(req);
      const code = body.code || body.certificate_number || body.member_code;
      const user = db.users.find((item) => (
        item.code === code
        || item.certificate_number === code
        || item.password === code
        || item.nickname === code
      ));

      if (!user) {
        sendJson(res, 401, { error: '회원코드가 맞지 않습니다.' });
        return;
      }

      sendJson(res, 200, {
        accessToken: `dev-token-${user.id}`,
        tokenType: 'Bearer',
        postId: body.postId || null,
        member: {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
        },
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/members/me') {
      const user = requireAuth(req, res, db);
      if (!user) return;

      sendJson(res, 200, {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/posts') {
      const searchParams = getSearchParams(req);
      const category = searchParams.get('category');
      const page = Number(searchParams.get('page') || 0);
      const size = Number(searchParams.get('size') || db.posts.length);
      const filteredPosts = category && category !== 'all'
        ? db.posts.filter((post) => post.category === category)
        : db.posts;
      const start = page * size;
      const content = filteredPosts.slice(start, start + size).map(normalizePost);

      sendJson(res, 200, {
        content,
        posts: content,
        totalElements: filteredPosts.length,
        totalPages: Math.max(1, Math.ceil(filteredPosts.length / size)),
        page,
        size,
      });
      return;
    }

    const postDetailMatch = pathname.match(/^\/api\/posts\/(\d+)$/);
    if (req.method === 'GET' && postDetailMatch) {
      const postId = Number(postDetailMatch[1]);
      const post = db.posts.find((item) => item.id === postId || item.post_id === postId);

      if (!post) {
        sendJson(res, 404, { error: 'Post not found' });
        return;
      }

      sendJson(res, 200, normalizePost(post));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/posts') {
      const user = requireAuth(req, res, db);
      if (!user) return;

      const body = await readBody(req);
      const nextId = Math.max(0, ...db.posts.map((post) => post.id)) + 1;
      const newPost = {
        id: nextId,
        post_id: nextId,
        title: body.title || '새 물품',
        category: body.category || 'digital',
        location: body.location || user.location || '',
        image: body.image || body.img || '',
        description: body.description || '',
        status: 'AVAILABLE',
        created_at: new Date().toISOString(),
      };

      db.posts.unshift(newPost);
      writeDb(db);
      sendJson(res, 201, normalizePost(newPost));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/wanted') {
      sendJson(res, 200, {
        content: db.wantedPosts,
        posts: db.wantedPosts,
        totalElements: db.wantedPosts.length,
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/wanted') {
      const user = requireAuth(req, res, db);
      if (!user) return;

      const body = await readBody(req);
      const nextId = Math.max(0, ...db.wantedPosts.map((post) => post.id)) + 1;
      const newPost = {
        id: nextId,
        title: body.title || '필요한 물품',
        content: body.content || body.description || '',
        category: body.category || 'etc',
        status: 'OPEN',
        created_at: new Date().toISOString(),
      };

      db.wantedPosts.unshift(newPost);
      writeDb(db);
      sendJson(res, 201, newPost);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

ensureDb();

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
