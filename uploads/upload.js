// middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 서버가 켜질 때 'uploads' 폴더가 없으면 자동으로 만들어주는 코드
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 파일 저장 위치와 파일명 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // 프로젝트 폴더 안의 uploads 폴더에 저장
    },
    filename: function (req, file, cb) {
        // 원래 파일명에 현재 시간을 붙여서 이름이 겹치지 않게 함 (예: 167890123.jpg)
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext); 
    }
});

// 파일 크기 제한 (옵션: 현재 5MB로 설정)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

module.exports = upload;