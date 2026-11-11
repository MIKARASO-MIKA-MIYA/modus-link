import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, digest] = hash.split("$");
  if (algorithm !== "scrypt" || !salt || !digest || digest.length !== 128)
    return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(digest, "hex"));
}
