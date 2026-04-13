const jwt = require('jsonwebtoken');

// .env 파일에 있는 비밀키를 똑같이 사용.
const JWT_SECRET = process.env.JWT_SECRET || '비밀키_입력하세요';

const authenticateToken = (req, res, next) => {
    // 1. 프론트엔드가 보낸 헤더에서 토큰 꺼내기 (보통 "Bearer [토큰값]" 형태)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // 토큰이 아예 안 넘어왔으면 컷
    if (!token) {
        return res.status(401).json({ message: '로그인이 필요한 서비스입니다.' });
    }

    // 2. 토큰이 진짜인지(유효한지) 검사
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
        }

        // 3. 검사 통과
        // 토큰 안에 들어있던 유저 정보(id, phone, role_id)를 req.user에 담아둠
        req.user = user; 
        
        // 다음 작업(게시글 작성 등)으로 넘어가라는 뜻
        next(); 
    });
};

module.exports = authenticateToken;