/**
 * 穹弯 halfsphere - AES-256-GCM 加密模块
 * 用于加密存储用户的 Provider API Key
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 位 = 32 字节
const IV_LENGTH = 16; // 128 位 IV
const TAG_LENGTH = 16; // 128 位认证标签

/**
 * 从环境变量获取加密密钥
 * 环境变量 HALFSPHERE_ENCRYPTION_KEY 必须是 64 字符的 hex 字符串（32 字节）
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.HALFSPHERE_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("HALFSPHERE_ENCRYPTION_KEY 环境变量未设置");
  }
  if (keyHex.length !== 64) {
    throw new Error(
      `HALFSPHERE_ENCRYPTION_KEY 长度错误: 期望 64 字符 hex (32 字节), 实际 ${keyHex.length} 字符`
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * 加密明文
 * @param plaintext 要加密的字符串（如 API Key）
 * @returns 包含密文、IV、认证标签的对象
 */
export function encrypt(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

/**
 * 解密密文
 * @param ciphertext hex 格式的密文
 * @param iv hex 格式的初始化向量
 * @param tag hex 格式的认证标签
 * @returns 解密后的明文字符串
 */
export function decrypt(
  ciphertext: string,
  iv: string,
  tag: string
): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * 生成一个安全的 32 字节 hex 密钥
 * 用于初始化项目时生成 HALFSPHERE_ENCRYPTION_KEY
 * 仅在命令行或一次性脚本中使用，不要暴露到前端
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
