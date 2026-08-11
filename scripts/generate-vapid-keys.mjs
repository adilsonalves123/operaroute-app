/** Gera chaves VAPID para Web Push. Uso: node scripts/generate-vapid-keys.mjs */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\n# Cole no .env.local e nas variáveis do Vercel:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:suporte@operaroute.com.br\n`);
