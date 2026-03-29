const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config(); // .env 파일 읽어오기

// DB 연결 풀(Pool) 생성 (요청 들어올 때마다 연결하지 않고, 미리 여러 개 만들어두는 방식)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    ssl: {
        ca: fs.readFileSync('./ca.pem') // Aiven 필수 설정! ca.pem 파일 읽어오기
    },
    waitForConnections: true,
    connectionLimit: 10, // 동시 접속 10개까지 허용
    queueLimit: 0
});

// DB 연결 테스트용 코드 (서버 켤 때 한 번 실행됨)
pool.getConnection()
    .then(connection => {
        console.log('✅ Aiven MySQL DB 연결 성공!');
        connection.release(); // 연결 확인 후 다시 풀에 반납
    })
    .catch(err => {
        console.error('❌ DB 연결 실패:', err);
    });

module.exports = pool;