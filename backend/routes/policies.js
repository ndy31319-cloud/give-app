const axios = require("axios");
const express = require("express");
const authenticateToken = require("../middlewares/authMiddleware");
const db = require("../db");

const router = express.Router();
let memberColumnsCache = null;

const normalizeAiBaseUrl = (rawUrl) => {
  let normalizedUrl = String(rawUrl || "").trim().replace(/\/+$/, "");

  if (normalizedUrl.endsWith("/docs")) {
    normalizedUrl = normalizedUrl.slice(0, -"/docs".length);
  }

  return normalizedUrl;
};

const resolveAiChatbotApiUrls = () => {
  const explicitUrl = String(process.env.AI_CHATBOT_URL || "").trim();

  if (explicitUrl) {
    return [explicitUrl.replace(/\/+$/, "")];
  }

  const baseUrl = normalizeAiBaseUrl(process.env.AI_SERVER_URL);

  if (!baseUrl) {
    const error = new Error("AI 서버 URL이 설정되어 있지 않습니다.");
    error.statusCode = 503;
    throw error;
  }

  if (
    baseUrl.endsWith("/api/policies/chatbot") ||
    baseUrl.endsWith("/api/policy/chatbot") ||
    baseUrl.endsWith("/api/chatbot") ||
    baseUrl.endsWith("/api/chat")
  ) {
    return [baseUrl];
  }

  return [
    `${baseUrl}/api/policies/chatbot`,
    `${baseUrl}/api/policy/chatbot`,
    `${baseUrl}/api/chatbot`,
    `${baseUrl}/api/chat/`,
  ];
};

const toPolicyResponse = (policy) => ({
  id: String(policy.policy_id ?? policy.id),
  title: policy.policy_name ?? policy.title ?? "",
  category: policy.category ?? "",
  agency: policy.agency ?? "",
  description: policy.summary ?? policy.description ?? "",
  content: policy.content ?? policy.summary ?? "",
  targetCriteria: policy.target_criteria ?? policy.targetCriteria ?? "",
  target: policy.target_criteria ?? policy.target ?? "",
  support: policy.support_detail ?? policy.support ?? "",
  aiSearchText: policy.ai_search_text ?? policy.aiSearchText ?? "",
});

const getMemberId = (req) => req.user.member_id || req.user.memberId || req.user.id;

const normalizeOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const loadPolicies = async (category) => {
  const params = [];
  let whereClause = "";

  if (category) {
    whereClause = "WHERE category = ?";
    params.push(category);
  }

  const [rows] = await db.query(
    `SELECT policy_id, policy_name, category, agency, summary, content,
            target_criteria, support_detail, ai_search_text
     FROM POLICY
     ${whereClause}
     ORDER BY policy_id ASC`,
    params,
  );

  return rows;
};

const loadMemberColumns = async () => {
  if (memberColumnsCache) {
    return memberColumnsCache;
  }

  const [rows] = await db.query("SHOW COLUMNS FROM MEMBER");
  memberColumnsCache = new Set(rows.map((row) => row.Field));

  return memberColumnsCache;
};

const loadCurrentMember = async (memberId) => {
  const memberColumns = await loadMemberColumns();
  const birthdateSelect = memberColumns.has("birth_date")
    ? "birth_date AS birthdate"
    : memberColumns.has("birthdate")
      ? "birthdate"
      : "NULL AS birthdate";
  const genderSelect = memberColumns.has("gender") ? "gender" : "NULL AS gender";

  const [rows] = await db.query(
    `SELECT member_id, name, nickname, email, phone, role_id, dong_name,
            latitude, longitude, ${birthdateSelect}, ${genderSelect}
     FROM MEMBER
     WHERE member_id = ?
     LIMIT 1`,
    [memberId],
  );

  return rows[0] || null;
};

const calculateAge = (birthdate) => {
  if (!birthdate) {
    return null;
  }

  const date = new Date(birthdate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
};

const loadRecommendedPolicies = async (member) => {
  if (!member) {
    return [];
  }

  const memberColumns = await loadMemberColumns();
  const ageExpression = memberColumns.has("birth_date")
    ? "TIMESTAMPDIFF(YEAR, m.birth_date, CURDATE())"
    : memberColumns.has("birthdate")
      ? "TIMESTAMPDIFF(YEAR, m.birthdate, CURDATE())"
      : "NULL";
  const genderExpression = memberColumns.has("gender") ? "m.gender" : "NULL";
  const age = calculateAge(member.birthdate);
  const minAge = age === null ? null : Math.max(age - 5, 0);
  const maxAge = age === null ? null : age + 5;
  const gender = member.gender || null;
  const roleId = member.role_id || null;
  const dongName = member.dong_name || "";

  const [rows] = await db.query(
    `SELECT p.policy_id, p.policy_name, p.category, p.agency, p.summary, p.content,
            p.target_criteria, p.support_detail, p.ai_search_text,
            COUNT(*) AS history_count
     FROM SEARCH_HISTORY sh
     JOIN MEMBER m ON m.member_id = sh.member_id
     JOIN POLICY p ON p.policy_id = sh.policy_id
     WHERE sh.policy_id IS NOT NULL
       AND m.member_id != ?
       AND (
         (? IS NOT NULL AND ${genderExpression} = ?)
         OR (? IS NOT NULL AND ${ageExpression} BETWEEN ? AND ?)
         OR (? IS NOT NULL AND m.role_id = ?)
         OR (? != '' AND m.dong_name = ?)
       )
     GROUP BY p.policy_id, p.policy_name, p.category, p.agency, p.summary, p.content,
              p.target_criteria, p.support_detail, p.ai_search_text
     ORDER BY history_count DESC, p.policy_id ASC
     LIMIT 10`,
    [
      member.member_id,
      gender,
      gender,
      age,
      minAge,
      maxAge,
      roleId,
      roleId,
      dongName,
      dongName,
    ],
  );

  return rows;
};

router.get("/", authenticateToken, async (req, res) => {
  const category = String(req.query.category || "").trim();

  try {
    const policies = await loadPolicies(category || null);

    return res.status(200).json({
      policies: policies.map(toPolicyResponse),
      message: "정책 목록 조회에 성공했습니다.",
    });
  } catch (error) {
    console.error("Policy list error:", error.message);
    return res.status(500).json({
      message: "정책 목록 조회 중 오류가 발생했습니다.",
    });
  }
});

router.post("/history", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);
  const queryText = String(req.body.query_text ?? req.body.queryText ?? "").trim();
  const recommendPolicyId = normalizeOptionalNumber(
    req.body.recommend_policy_id ?? req.body.recommendPolicyId,
  );
  const policyId = normalizeOptionalNumber(req.body.policy_id ?? req.body.policyId);

  if (!queryText && recommendPolicyId === null && policyId === null) {
    return res.status(400).json({
      message: "저장할 검색 또는 정책 선택 기록이 필요합니다.",
    });
  }

  try {
    await db.query(
      `INSERT INTO SEARCH_HISTORY
         (member_id, query_text, recommend_policy_id, policy_id, search_date)
       VALUES (?, ?, ?, ?, NOW())`,
      [memberId, queryText || null, recommendPolicyId, policyId],
    );

    return res.status(201).json({
      message: "정책 검색 또는 선택 기록 저장에 성공했습니다.",
    });
  } catch (error) {
    console.error("Policy history error:", error.message);
    return res.status(500).json({
      message: "정책 검색 또는 선택 기록 저장 중 오류가 발생했습니다.",
    });
  }
});

router.get("/recommended", authenticateToken, async (req, res) => {
  const memberId = getMemberId(req);

  try {
    const member = await loadCurrentMember(memberId);

    if (!member) {
      return res.status(404).json({
        message: "회원 정보를 찾을 수 없습니다.",
      });
    }

    let policies = await loadRecommendedPolicies(member);

    if (!policies.length) {
      policies = await loadPolicies();
      policies = policies.slice(0, 10);
    }

    return res.status(200).json({
      policies: policies.map(toPolicyResponse),
      message: "추천 정책 목록 조회에 성공했습니다.",
    });
  } catch (error) {
    console.error("Policy recommendation error:", error.message);
    return res.status(500).json({
      message: "추천 정책 목록 조회 중 오류가 발생했습니다.",
    });
  }
});

const callAiChatbot = async (payload) => {
  const urls = resolveAiChatbotApiUrls();
  let lastError = null;

  for (const url of urls) {
    try {
      const normalizedUrl = url.replace(/\/+$/, "");
      const requestPayload = normalizedUrl.endsWith("/api/chat")
        ? {
            user_message: payload.message,
            member_id: payload.user?.member_id ?? null,
          }
        : payload;

      const response = await axios.post(url, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        proxy: false,
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      lastError = error;

      if (error.response && error.response.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError || new Error("AI 챗봇 서버 응답을 받을 수 없습니다.");
};

const normalizeSuggestedPolicies = (rawSuggestedPolicies, policies) => {
  if (!Array.isArray(rawSuggestedPolicies)) {
    return [];
  }

  return rawSuggestedPolicies
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") {
        const matched = policies.find(
          (policy) => String(policy.policy_id) === String(item),
        );
        return matched ? toPolicyResponse(matched) : null;
      }

      return toPolicyResponse(item);
    })
    .filter(Boolean);
};

router.post("/chatbot", authenticateToken, async (req, res) => {
  const message = String(req.body.message || "").trim();
  const conversationHistory = Array.isArray(req.body.conversationHistory)
    ? req.body.conversationHistory
    : [];
  const memberId = req.user.member_id || req.user.id;

  if (!message) {
    return res.status(400).json({
      message: "질문 내용을 입력해주세요.",
    });
  }

  try {
    const [member, policies] = await Promise.all([
      loadCurrentMember(memberId),
      loadPolicies(),
    ]);
    const policyContext = policies.map(toPolicyResponse);
    const aiResult = await callAiChatbot({
      message,
      conversationHistory,
      user: member
        ? {
            member_id: member.member_id,
            name: member.name,
            role_id: member.role_id,
            dong_name: member.dong_name,
            birthdate: member.birthdate,
          }
        : null,
      policies: policyContext,
    });
    const responseText =
      aiResult.response ||
      aiResult.answer ||
      aiResult.reply ||
      aiResult.ai_response ||
      aiResult.message ||
      "";
    const suggestedPolicies = normalizeSuggestedPolicies(
      aiResult.suggestedPolicies ||
        aiResult.suggested_policies ||
        aiResult.recommended_policies ||
        aiResult.policies ||
        [],
      policies,
    );

    return res.status(200).json({
      response: responseText,
      suggestedPolicies,
      message: "챗봇 답변 생성에 성공했습니다.",
    });
  } catch (error) {
    console.error("Policy chatbot error:", error.response?.data || error.message);
    return res.status(error.statusCode || 500).json({
      message: "챗봇 답변 생성 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
