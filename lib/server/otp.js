import { json, rateLimit, clientIp } from '../api-helpers.js';
import { getCollection } from '../mongodb.js';
import {
  generateOTP,
  normalizePhoneNumber,
  isValidFrenchPhone,
  shouldBypassVerification,
  sendOTPSMS,
  calculateExpirationTime
} from '../otp-service.js';
import { ensureIndexes } from './leads.js';

// Création puis envoi d'un code OTP (partagé par send-otp et resend-otp)
export async function issueOTP(request, phone) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (shouldBypassVerification(phone)) {
    return json(request, { success: true, bypass: true, message: 'Verification bypassed for this number' });
  }

  if (!isValidFrenchPhone(normalizedPhone)) {
    return json(request, { error: 'Numéro de téléphone invalide. Format attendu : 06 12 34 56 78' }, 400);
  }

  // Anti-abus : limite les envois de SMS (coût) par IP et par numéro
  const ip = clientIp(request);
  if (!rateLimit(`otp-ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 }) ||
      !rateLimit(`otp-phone:${normalizedPhone}`, { limit: 5, windowMs: 60 * 60 * 1000 })) {
    return json(request, { error: 'Trop de demandes. Réessayez plus tard.' }, 429);
  }

  await ensureIndexes();
  const collection = await getCollection('otp_verifications');

  const recentOTP = await collection.findOne({
    phone: normalizedPhone,
    verified: false,
    createdAt: { $gt: new Date(Date.now() - 30 * 1000) }
  });
  if (recentOTP) {
    return json(request, { error: 'Veuillez patienter 30 secondes avant de demander un nouveau code.' }, 429);
  }

  await collection.deleteMany({ phone: normalizedPhone, verified: false });

  const code = generateOTP(6);
  await collection.insertOne({
    phone: normalizedPhone,
    code,
    createdAt: new Date(),
    expiresAt: calculateExpirationTime(5),
    verified: false,
    attempts: 0
  });

  const smsResult = await sendOTPSMS(normalizedPhone, code);
  if (!smsResult.success) {
    await collection.deleteOne({ phone: normalizedPhone, code });
    return json(request, { error: "L'envoi du code a échoué. Veuillez réessayer." }, 500);
  }

  return json(request, { success: true, message: 'Verification code sent', expiresInSeconds: 5 * 60 });
}
