const express = require('express');
const db = require('../db');
const authenticateToken = require('../middlewares/authMiddleware');
const router = express.Router();

// ==========================================
// 1. 게시글 전체 목록 조회 API (GET /api/posts)
// ==========================================
router.get('/', async (req, res) => {
    try {
        // 기부 글과 요청 글을 합쳐서 최신순(created_at DESC)으로 정렬하여 가져옵니다.
        const sql = `
            SELECT donate_id AS post_id, member_id, title, status, created_at, 'donate' AS post_type 
            FROM ITEM_DONATE
            UNION ALL
            SELECT request_id AS post_id, member_id, title, status, created_at, 'request' AS post_type 
            FROM ITEM_REQUEST
            ORDER BY created_at DESC
        `;
        
        const [rows] = await db.query(sql);
        res.status(200).json(rows);
        
    } catch (error) {
        console.error('목록 조회 에러:', error);
        res.status(500).json({ message: '목록을 불러오는데 실패했습니다.' });
    }
});

// ==========================================
// 2. 게시글(물품) 등록 API (POST /api/posts)
// ==========================================
router.post('/', authenticateToken, async (req, res) => {
   
    const { title, content, item_name, item_condition, product_id } = req.body; 
    
    const member_id = req.user.member_id || req.user.id; 
    const role_id = req.user.role_id; 

    try {
        const isDonate = (role_id === 'general' || role_id === 'USER');
        let postId;
        let postType;

        if (isDonate) {
            postType = 'donate';
            // 1. 기부 게시글 저장
            const [postResult] = await db.query(
                'INSERT INTO ITEM_DONATE (member_id, title, content, status) VALUES (?, ?, ?, ?)',
                [member_id, title, content, 'open']
            );
            postId = postResult.insertId;

            // 2. 기부 물품 상세 저장
            await db.query(
                'INSERT INTO ITEM (donate_id, product_id, item_name, item_condition) VALUES (?, ?, ?, ?)',
                [postId, product_id, item_name, item_condition]
            );
        } else {
            postType = 'request';
            // 1. 요청 게시글 저장
            const [postResult] = await db.query(
                'INSERT INTO ITEM_REQUEST (member_id, title, content, status) VALUES (?, ?, ?, ?)',
                [member_id, title, content, 'open']
            );
            postId = postResult.insertId;

            // 2. 요청 물품 상세 저장 
            await db.query(
                'INSERT INTO ITEM (request_id, product_id, item_name, item_condition) VALUES (?, ?, ?, ?)',
                [postId, product_id, item_name, item_condition]
            );
        }

        res.status(201).json({ 
            message: "게시글이 성공적으로 등록되었습니다.", 
            post_id: postId,
            post_type: postType 
        });

    } catch (error) {
        console.error('게시글 등록 에러:', error);
        res.status(500).json({ message: '게시글 등록에 실패했습니다.' });
    }
});

// ==========================================
// 3. 게시글 상세 조회 API (GET /api/posts/:id)
// ==========================================
router.get('/:id', async (req, res) => {
    // 주소의 :id 값과, 쿼리스트링으로 보낼 글 종류(type=donate 또는 request)를 받습니다.
    const postId = req.params.id;
    const postType = req.query.type; 

    try {
        let sql = '';
        if (postType === 'donate') {
            // 기부 글 + 물품 정보 조인해서 가져오기
            sql = `
                SELECT d.*, i.product_id, i.item_name, i.item_condition 
                FROM ITEM_DONATE d
                LEFT JOIN ITEM i ON d.donate_id = i.donate_id
                WHERE d.donate_id = ?
            `;
        } else if (postType === 'request') {
            // 요청 글 + 물품 정보 조인해서 가져오기
            sql = `
                SELECT r.*, i.product_id, i.item_name, i.item_condition 
                FROM ITEM_REQUEST r
                LEFT JOIN ITEM i ON r.request_id = i.request_id
                WHERE r.request_id = ?
            `;
        } else {
            return res.status(400).json({ message: "게시글 타입(type=donate 또는 request)을 주소에 포함해주세요." });
        }

        const [rows] = await db.query(sql, [postId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
        }

        res.status(200).json(rows[0]);

    } catch (error) {
        console.error('상세 조회 에러:', error);
        res.status(500).json({ message: '상세 정보를 불러오는데 실패했습니다.' });
    }
});
// ==========================================
// 4. 게시글(물품) 수정 API (PUT /api/posts/:id)
// ==========================================
router.put('/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const postType = req.query.type; 
    
    // 수정할 내용들 (프론트에서 받아옴)
    const { title, content, item_name, item_condition, product_id } = req.body;
    
    // 현재 로그인한 사람의 번호
    const member_id = req.user.member_id || req.user.id;

    if (!postType || (postType !== 'donate' && postType !== 'request')) {
        return res.status(400).json({ message: "type(donate/request)을 주소에 정확히 입력해주세요." });
    }

    try {
        const tableName = postType === 'donate' ? 'ITEM_DONATE' : 'ITEM_REQUEST';
        const idColumn = postType === 'donate' ? 'donate_id' : 'request_id';

        // 1. 수정하려는 글이 존재하는지 & 내 글이 맞는지 확인
        const [checkRows] = await db.query(
            `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
            [postId]
        );

        if (checkRows.length === 0) {
            return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
        }

        if (checkRows[0].member_id !== member_id) {
            return res.status(403).json({ message: "내가 작성한 글만 수정할 수 있습니다." });
        }

        // 2. 게시글 테이블 수정 (제목, 내용, 수정시간 갱신)
        await db.query(
            `UPDATE ${tableName} SET title = ?, content = ?, updated_at = NOW() WHERE ${idColumn} = ?`,
            [title, content, postId]
        );

        // 3. 물품(ITEM) 테이블 상세 정보 수정
        await db.query(
            `UPDATE ITEM SET product_id = ?, item_name = ?, item_condition = ? WHERE ${idColumn} = ?`,
            [product_id, item_name, item_condition, postId]
        );

        res.status(200).json({ message: "게시글이 성공적으로 수정되었습니다." });

    } catch (error) {
        console.error('게시글 수정 에러:', error);
        res.status(500).json({ message: '게시글 수정에 실패했습니다.' });
    }
});

// ==========================================
// 5. 게시글(물품) 삭제 API (DELETE /api/posts/:id)
// ==========================================
router.delete('/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const postType = req.query.type; 
    const member_id = req.user.member_id || req.user.id;

    if (!postType || (postType !== 'donate' && postType !== 'request')) {
        return res.status(400).json({ message: "type(donate/request)을 주소에 정확히 입력해주세요." });
    }

    try {
        const tableName = postType === 'donate' ? 'ITEM_DONATE' : 'ITEM_REQUEST';
        const idColumn = postType === 'donate' ? 'donate_id' : 'request_id';

        // 1. 게시글 존재 여부 및 작성자 본인 확인
        const [checkRows] = await db.query(
            `SELECT member_id FROM ${tableName} WHERE ${idColumn} = ?`,
            [postId]
        );

        if (checkRows.length === 0) {
            return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
        }

        if (checkRows[0].member_id !== member_id) {
            return res.status(403).json({ message: "내가 작성한 글만 삭제할 수 있습니다." });
        }

        // 2. 자식 테이블(ITEM) 물품 상세 데이터 먼저 삭제 (외래키 에러 방지)
        await db.query(`DELETE FROM ITEM WHERE ${idColumn} = ?`, [postId]);

        // 3. 부모 테이블(게시글) 데이터 삭제
        await db.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [postId]);

        res.status(200).json({ message: "게시글이 성공적으로 삭제되었습니다." });

    } catch (error) {
        console.error('게시글 삭제 에러:', error);
        res.status(500).json({ message: '게시글 삭제에 실패했습니다.' });
    }
});

module.exports = router;