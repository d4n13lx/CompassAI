export function isModeratorAuthorized(request: Request): boolean {
  const token = process.env.MODERATOR_TOKEN;
  if (!token) return false;
  const incoming = request.headers.get("x-moderator-token");
  return incoming === token;
}

