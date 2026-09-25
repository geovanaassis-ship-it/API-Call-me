import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não definida. Gere uma com: openssl rand -base64 32, e defina no .env / variáveis de ambiente.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY inválida: deve ser uma string base64 de 32 bytes (openssl rand -base64 32).");
  }
  return key;
}

/** Criptografa um texto (ex: token OAuth) para guardar no banco. Formato: iv.tag.ciphertext (base64, separados por ".") */
export function encrypt(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, ciphertextB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Payload criptografado em formato inválido.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plainText.toString("utf8");
}
