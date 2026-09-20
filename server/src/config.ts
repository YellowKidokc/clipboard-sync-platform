function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value === "change-me") {
    throw new Error("JWT_SECRET is required and must not use the default value");
  }
  return value;
}

export const jwtSecret = requireJwtSecret();
