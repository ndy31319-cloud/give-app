const getRequestProtocol = (req) => {
  const forwardedProto = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();

  return forwardedProto || req.protocol || "http";
};

const getRequestHost = (req) =>
  String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();

const buildUploadUrl = (req, imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  const rawUrl = String(imageUrl);
  const protocol = getRequestProtocol(req);
  const host = getRequestHost(req);

  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsedUrl = new URL(rawUrl);
      if (protocol === "https" && parsedUrl.protocol === "http:" && parsedUrl.host === host) {
        parsedUrl.protocol = "https:";
      }
      return parsedUrl.toString();
    } catch {
      return rawUrl;
    }
  }

  const filename = rawUrl.split(/[\\/]/).pop();
  return `${protocol}://${host}/uploads/${filename}`;
};

module.exports = { buildUploadUrl };
