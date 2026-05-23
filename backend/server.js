const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const seedData = {
  users: [
    {
      id: 1,
      name: '테스트 사용자',
      nickname: '1111',
      email: '1111@test.com',
      password: '1111',
      code: '1111',
      certificate_number: '1111',
      phone: '010-1111-1111',
      role: 'user',
      location: '서초동',
    },
  ],
  posts: [
    {
      id: 1,
      post_id: 1,
      title: '블루투스 헤드셋',
      category: 'digital',
      location: '서초동',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200',
      description: '상태 좋은 블루투스 헤드셋입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T09:00:00.000Z',
    },
    {
      id: 2,
      post_id: 2,
      title: '사무용 키보드',
      category: 'digital',
      location: '반포동',
      image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1200',
      description: '업무용으로 쓰기 좋은 키보드입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T10:00:00.000Z',
    },
    {
      id: 3,
      post_id: 3,
      title: '여름용 반팔 티셔츠',
      category: 'fashion',
      location: '양재동',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200',
      description: '깨끗한 여름 반팔 티셔츠입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T11:00:00.000Z',
    },
    {
      id: 4,
      post_id: 4,
      title: '아동용 운동화',
      category: 'fashion',
      location: '서초동',
      image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1200',
      description: '아이들이 신기 좋은 운동화입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T12:00:00.000Z',
    },
    {
      id: 5,
      post_id: 5,
      title: '우드 미니 협탁',
      category: 'furniture',
      location: '방배동',
      image: 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?w=1200',
      description: '작은 공간에 두기 좋은 협탁입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T13:00:00.000Z',
    },
    {
      id: 6,
      post_id: 6,
      title: '초록색 1인용 소파',
      category: 'furniture',
      location: '양재동',
      image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200',
      description: '편하게 앉을 수 있는 1인용 소파입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T14:00:00.000Z',
    },
    {
      id: 7,
      post_id: 7,
      title: '자기계발 베스트셀러',
      category: 'book',
      location: '서초동',
      image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=1200',
      description: '읽기 좋은 자기계발 도서입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T15:00:00.000Z',
    },
    {
      id: 8,
      post_id: 8,
      title: '어린이 동화 전집',
      category: 'book',
      location: '반포동',
      image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200',
      description: '아이들이 보기 좋은 동화책 묶음입니다.',
      status: 'AVAILABLE',
      created_at: '2026-04-30T16:00:00.000Z',
    },
  ],
  wantedPosts: [
    {
      id: 1,
      title: '전공 서적을 구해요',
      content: '컴퓨터 공학 관련 전공 서적이 필요합니다.',
      category: 'book',
      status: 'OPEN',
      created_at: '2026-04-30T09:30:00.000Z',
    },
    {
      id: 2,
      title: '아이 신발이 필요해요',
      content: '아이 운동화를 나눔받고 싶습니다.',
      category: 'fashion',
      status: 'OPEN',
      created_at: '2026-04-30T10:30:00.000Z',
    },
  ],
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
        password: '',
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
